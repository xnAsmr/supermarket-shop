/**
 * 订单管理服务（销售订单 / 退货退款 / 取消恢复删除）
 *
 * 与后端语义保持一致：
 * - 取消订单 = 逻辑取消（状态置为 cancelled），回滚库存、支付账户余额、会员累计消费，可恢复
 * - 删除订单 = 物理删除记录（仅允许删除已取消的订单），并清理明细与支付记录
 * - 退货退款 = 按商品部分退货，回补库存、冲减支付账户与会员累计消费
 */
import { getDb, persistDb, nextSerial, type MockDatabase } from './core/db'
import {
  delay,
  formatDateTime,
  genId,
  genNo,
  includesKeyword,
  money,
  paginate
} from './core/helpers'
import { addShelfStock, pushFlow, reduceShelfStock } from './core/effects'
import { fail } from './core/result'
import { useTenantStore } from '@/store/modules/tenant'

const currentTid = (): string => useTenantStore().currentId

const PAY_LABEL: Record<Api.Order.PayMethod, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  bank: '银行卡',
  stored: '储值卡'
}

/** 销售订单列表 */
export async function fetchSalesList(
  params: Api.Order.SalesSearchParams
): Promise<Api.Order.SalesList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const keyword = params.keyword?.trim()
  const list = db.orders
    .filter((o) => {
      if (o.tenantId !== tenantId) return false
      if (params.orderNo && !includesKeyword(o.orderNo, params.orderNo)) return false
      if (keyword) {
        const hit =
          includesKeyword(o.orderNo, keyword) ||
          includesKeyword(o.memberName, keyword) ||
          includesKeyword(o.cashier, keyword) ||
          o.items.some(
            (it) => includesKeyword(it.name, keyword) || includesKeyword(it.barcode, keyword)
          )
        if (!hit) return false
      }
      if (params.status && o.status !== params.status) return false
      if (params.warehouseId && o.warehouseId !== params.warehouseId) return false
      if (params.cashier && !includesKeyword(o.cashier, params.cashier)) return false
      const date = o.createTime.slice(0, 10)
      if (params.startTime && date < params.startTime) return false
      if (params.endTime && date > params.endTime) return false
      return true
    })
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
  return paginate(list, params)
}

/** 销售订单详情 */
export async function fetchSalesDetail(id: string): Promise<Api.Order.SalesOrder> {
  await delay(80)
  const order = getDb().orders.find((o) => o.id === id && o.tenantId === currentTid())
  if (!order) fail('订单不存在或已删除')
  return order
}

/**
 * 取消订单（逻辑取消，可恢复）
 * 回滚：货架库存、支付账户余额、会员储值余额与累计消费/积分
 */
export async function fetchCancelOrder(id: string, reason?: string): Promise<void> {
  await delay(160)
  const db = getDb()
  const tenantId = currentTid()
  const order = db.orders.find((o) => o.id === id && o.tenantId === tenantId)
  if (!order) fail('订单不存在或已删除')
  if (order.status === 'cancelled') fail('该订单已取消，请勿重复操作')
  if (order.status === 'refunded') fail('该订单已退款，无法取消')

  // 1. 回补货架库存
  order.items.forEach((item) => {
    addShelfStock(db, tenantId, order.warehouseId, item.productId, item.quantity)
  })

  // 2. 回退支付账户与会员储值余额
  order.payments.forEach((payment) => {
    if (payment.method === 'stored') {
      const member = findMemberByName(db, tenantId, order.memberName)
      if (member) {
        member.balance = money(member.balance + payment.amount)
      }
    } else {
      const account = db.paymentMethods.find(
        (a) => a.tenantId === tenantId && a.code === payment.method
      )
      if (account) {
        account.balance = money(Math.max(0, account.balance - payment.amount))
      }
    }
  })

  // 3. 回退会员累计消费与积分（记录实际冲减量，恢复时精确回加）
  const member = findMemberByName(db, tenantId, order.memberName)
  if (member) {
    const beforeConsume = member.totalConsume
    const beforePoints = member.totalPoints
    member.totalConsume = money(Math.max(0, member.totalConsume - order.payAmount))
    member.totalPoints = Math.max(0, member.totalPoints - Math.trunc(order.payAmount))
    order.revertConsume = money(beforeConsume - member.totalConsume)
    order.revertPoints = beforePoints - member.totalPoints
  }

  // 4. 财务冲减流水
  pushFlow(db, {
    tenantId,
    type: 'expense',
    category: '订单取消',
    amount: order.payAmount,
    method: order.payments.map((p) => PAY_LABEL[p.method]).join('+'),
    relatedNo: order.orderNo,
    operator: order.cashier,
    remark: reason || '取消订单冲减'
  })

  order.status = 'cancelled'
  order.cancelReason = reason || ''
  order.cancelTime = formatDateTime()
  order.restoreTime = undefined

  persistDb()
}

/**
 * 恢复已取消的订单
 * 重新扣减：货架库存、支付账户余额、会员储值余额与累计消费/积分
 */
export async function fetchRestoreOrder(id: string): Promise<void> {
  await delay(160)
  const db = getDb()
  const tenantId = currentTid()
  const order = db.orders.find((o) => o.id === id && o.tenantId === tenantId)
  if (!order) fail('订单不存在或已删除')
  if (order.status !== 'cancelled') fail('只有已取消的订单才能恢复')

  // 1. 重新扣减货架库存
  order.items.forEach((item) => {
    reduceShelfStock(
      db,
      tenantId,
      order.warehouseId,
      item.productId,
      item.quantity,
      `商品「${item.name}」`
    )
  })

  // 2. 恢复支付账户与会员储值余额
  order.payments.forEach((payment) => {
    if (payment.method === 'stored') {
      const member = findMemberByName(db, tenantId, order.memberName)
      if (member) {
        if (member.balance < payment.amount) {
          fail('会员储值卡余额不足，无法恢复订单')
        }
        member.balance = money(member.balance - payment.amount)
      }
    } else {
      const account = db.paymentMethods.find(
        (a) => a.tenantId === tenantId && a.code === payment.method
      )
      if (account) {
        account.balance = money(account.balance + payment.amount)
      }
    }
  })

  // 3. 恢复会员累计消费与积分（按取消时实际冲减的量精确回加）
  const member = findMemberByName(db, tenantId, order.memberName)
  if (member) {
    member.totalConsume = money(member.totalConsume + (order.revertConsume ?? order.payAmount))
    member.totalPoints += order.revertPoints ?? Math.trunc(order.payAmount)
    order.revertConsume = undefined
    order.revertPoints = undefined
  }

  // 4. 财务冲增流水
  pushFlow(db, {
    tenantId,
    type: 'income',
    category: '订单恢复',
    amount: order.payAmount,
    method: order.payments.map((p) => PAY_LABEL[p.method]).join('+'),
    relatedNo: order.orderNo,
    operator: order.cashier,
    remark: '恢复订单冲增'
  })

  order.status = 'paid'
  order.cancelReason = undefined
  order.cancelTime = undefined
  order.restoreTime = formatDateTime()

  persistDb()
}

/**
 * 彻底删除订单（物理删除）
 * 仅允许删除已取消的订单，并清理关联的退货单
 */
export async function fetchDeleteOrder(id: string): Promise<void> {
  await delay(140)
  const db = getDb()
  const tenantId = currentTid()
  const idx = db.orders.findIndex((o) => o.id === id && o.tenantId === tenantId)
  if (idx < 0) fail('订单不存在或已删除')
  const order = db.orders[idx]
  if (order.status !== 'cancelled') fail('只有已取消的订单才能删除，请先取消订单')

  // 清理关联的退货单（避免留下指向已删订单的孤儿记录）
  const refundIds = db.returns.filter((r) => r.orderId === order.id).map((r) => r.id)
  db.returns = db.returns.filter((r) => r.orderId !== order.id)

  db.orders.splice(idx, 1)
  persistDb()
  // 引用 refundIds 仅为语义清晰：关联退货单已随订单一并清除
  void refundIds
}

/** 退货单列表 */
export async function fetchReturnList(
  params: Api.Order.ReturnSearchParams
): Promise<Api.Order.ReturnList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const list = db.returns
    .filter(
      (r) =>
        r.tenantId === tenantId &&
        includesKeyword(r.returnNo, params.returnNo) &&
        includesKeyword(r.orderNo, params.orderNo) &&
        (!params.status || r.status === params.status)
    )
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
  return paginate(list, params)
}

export interface CreateReturnPayload {
  orderId: string
  items: Array<{ productId: string; quantity: number }>
  refundMethod: Api.Order.PayMethod
  reason: string
}

/** 新建退货单：校验可退数量 → 回补库存 → 财务冲减 → 更新订单状态 */
export async function fetchCreateReturn(
  payload: CreateReturnPayload
): Promise<Api.Order.ReturnOrder> {
  await delay(240)
  const db = getDb()
  const tenantId = currentTid()
  const order = db.orders.find((o) => o.id === payload.orderId && o.tenantId === tenantId)
  if (!order) fail('原订单不存在')
  if (order.status === 'cancelled') fail('该订单已取消，无法退货')
  if (order.status === 'refunded') fail('该订单已全额退款，无法继续退货')

  const selected = (payload.items ?? []).filter((it) => Number(it.quantity) > 0)
  if (!selected.length) fail('请选择要退货的商品及数量')
  if (!payload.reason?.trim()) fail('请填写退货原因')

  const returnItems: Api.Order.ReturnItem[] = []
  selected.forEach((sel) => {
    const origin = order.items.find((it) => it.productId === sel.productId)
    if (!origin) fail('退货商品不在该订单中')
    const quantity = Number(sel.quantity)
    const refundable = origin.quantity - origin.refundedQty
    if (quantity > refundable) {
      fail(`商品「${origin.name}」最多可退 ${refundable}${origin.unit}`)
    }
    origin.refundedQty += quantity
    returnItems.push({
      productId: origin.productId,
      barcode: origin.barcode,
      name: origin.name,
      unit: origin.unit,
      price: origin.price,
      quantity,
      amount: money(origin.price * quantity)
    })
  })

  const refundAmount = money(returnItems.reduce((sum, it) => sum + it.amount, 0))
  const fullRefund = order.items.every((it) => it.refundedQty >= it.quantity)
  order.status = fullRefund ? 'refunded' : 'partial_refund'

  // 库存回补（货架）
  returnItems.forEach((it) => {
    addShelfStock(db, tenantId, order.warehouseId, it.productId, it.quantity)
  })

  // 退款金额按「实收」口径：整单有优惠时只退实际支付过的部分，避免多扣支付账户
  const paidRefundAmount =
    order.payAmount > 0 && order.payAmount < refundAmount
      ? money((refundAmount * order.payAmount) / order.totalAmount)
      : refundAmount

  // 支付账户冲减：储值卡退回会员余额，其余按退款方式从对应账户支出
  const member = findMemberByName(db, tenantId, order.memberName)
  const storedAmount = order.payments
    .filter((p) => p.method === 'stored')
    .reduce((sum, p) => sum + p.amount, 0)
  const storedRefund =
    storedAmount > 0
      ? Math.min(
          money(paidRefundAmount * (storedAmount / (order.payAmount || 1))),
          paidRefundAmount
        )
      : 0
  const nonStoredRefund = money(paidRefundAmount - storedRefund)

  if (storedRefund > 0) {
    if (member) {
      member.balance = money(member.balance + storedRefund)
    }
  }
  if (nonStoredRefund > 0) {
    const account = db.paymentMethods.find((a) => a.tenantId === tenantId && a.code === 'cash')
    if (account) {
      account.balance = money(Math.max(0, account.balance - nonStoredRefund))
    }
  }

  // 会员累计消费与积分冲减（记录实际冲减量，作废时精确回加）
  let appliedConsume = 0
  let appliedPoints = 0
  if (member) {
    const beforeConsume = member.totalConsume
    const beforePoints = member.totalPoints
    member.totalConsume = money(Math.max(0, member.totalConsume - paidRefundAmount))
    member.totalPoints = Math.max(0, member.totalPoints - Math.trunc(paidRefundAmount))
    appliedConsume = money(beforeConsume - member.totalConsume)
    appliedPoints = beforePoints - member.totalPoints
  }

  const record: Api.Order.ReturnOrder = {
    id: genId('RT'),
    tenantId,
    returnNo: genNo('TH', nextSerial(db, 'TH')),
    orderId: order.id,
    orderNo: order.orderNo,
    warehouseId: order.warehouseId,
    warehouseName: order.warehouseName,
    items: returnItems,
    refundAmount: paidRefundAmount,
    refundMethod: payload.refundMethod,
    status: 'completed',
    reason: payload.reason.trim(),
    operator: order.cashier,
    createTime: formatDateTime(),
    revertConsume: appliedConsume,
    revertPoints: appliedPoints
  }
  db.returns.push(record)

  pushFlow(db, {
    tenantId,
    type: 'expense',
    category: '销售退款',
    amount: paidRefundAmount,
    method: PAY_LABEL[payload.refundMethod],
    relatedNo: order.orderNo,
    operator: order.cashier,
    remark: `退货单 ${record.returnNo}`
  })

  persistDb()
  return record
}

/**
 * 作废退货单（取消退货，恢复原订单）
 * 回退：库存回扣、支付账户恢复、会员累计消费与积分恢复、订单状态恢复
 */
export async function fetchCancelReturn(id: string): Promise<void> {
  await delay(180)
  const db = getDb()
  const tenantId = currentTid()
  const idx = db.returns.findIndex((r) => r.id === id && r.tenantId === tenantId)
  if (idx < 0) fail('退货单不存在或已删除')
  const record = db.returns[idx]
  if (record.status !== 'completed') fail('只有已完成的退货单才能作废')

  const order = db.orders.find((o) => o.id === record.orderId && o.tenantId === tenantId)
  if (!order) fail('原订单不存在，无法作废退货单')

  // 1. 回扣货架库存
  record.items.forEach((it) => {
    reduceShelfStock(
      db,
      tenantId,
      order.warehouseId,
      it.productId,
      it.quantity,
      `商品「${it.name}」`
    )
  })

  // 2. 恢复订单明细已退数量
  order.items.forEach((orderItem) => {
    const returned = record.items.find((it) => it.productId === orderItem.productId)
    if (returned) {
      orderItem.refundedQty = Math.max(0, orderItem.refundedQty - returned.quantity)
    }
  })

  // 3. 恢复支付账户与会员储值余额
  const member = findMemberByName(db, tenantId, order.memberName)
  const storedAmount = order.payments
    .filter((p) => p.method === 'stored')
    .reduce((sum, p) => sum + p.amount, 0)
  const storedRefund =
    storedAmount > 0
      ? Math.min(
          money(record.refundAmount * (storedAmount / (order.payAmount || 1))),
          record.refundAmount
        )
      : 0
  const nonStoredRefund = money(record.refundAmount - storedRefund)

  if (storedRefund > 0) {
    if (member) {
      member.balance = money(Math.max(0, member.balance - storedRefund))
    }
  }
  if (nonStoredRefund > 0) {
    const account = db.paymentMethods.find((a) => a.tenantId === tenantId && a.code === 'cash')
    if (account) {
      account.balance = money(account.balance + nonStoredRefund)
    }
  }

  // 4. 恢复会员累计消费与积分（按退款时实际冲减的量精确回加）
  if (member) {
    member.totalConsume = money(member.totalConsume + (record.revertConsume ?? record.refundAmount))
    member.totalPoints += record.revertPoints ?? Math.trunc(record.refundAmount)
  }

  // 5. 恢复订单状态
  const anyRefunded = order.items.some((it) => it.refundedQty > 0)
  order.status = anyRefunded ? 'partial_refund' : 'paid'

  record.status = 'cancelled'

  pushFlow(db, {
    tenantId,
    type: 'income',
    category: '退货作废',
    amount: record.refundAmount,
    method: PAY_LABEL[record.refundMethod],
    relatedNo: order.orderNo,
    operator: record.operator,
    remark: `作废退货单 ${record.returnNo}`
  })

  persistDb()
}

/** 按会员姓名查找会员（Mock 订单只记录会员姓名） */
function findMemberByName(
  db: MockDatabase,
  tenantId: string,
  memberName?: string
): Api.Member.MemberItem | undefined {
  if (!memberName) return undefined
  return db.members.find((m) => m.tenantId === tenantId && m.name === memberName)
}

/** 订单状态标签映射（页面复用） */
export const ORDER_STATUS_MAP: Record<Api.Order.OrderStatus, { type: string; text: string }> = {
  paid: { type: 'success', text: '已完成' },
  partial_refund: { type: 'warning', text: '部分退款' },
  refunded: { type: 'info', text: '已全额退款' },
  cancelled: { type: 'danger', text: '已取消' }
}

/** 退货单状态标签映射 */
export const RETURN_STATUS_MAP: Record<Api.Order.ReturnStatus, { type: string; text: string }> = {
  pending: { type: 'warning', text: '待处理' },
  completed: { type: 'success', text: '已完成' },
  rejected: { type: 'danger', text: '已驳回' },
  cancelled: { type: 'info', text: '已作废' }
}

/** 支付方式中文 */
export const PAY_METHOD_LABEL = PAY_LABEL

/** 订单成本金额（按商品进价，供利润统计使用） */
export const orderCostAmount = (db: MockDatabase, order: Api.Order.SalesOrder): number =>
  money(
    order.items.reduce((sum, it) => {
      const product = db.products.find((p) => p.id === it.productId)
      return sum + (product?.purchasePrice ?? 0) * it.quantity
    }, 0)
  )
