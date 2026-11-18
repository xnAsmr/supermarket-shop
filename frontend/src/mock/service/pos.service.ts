/**
 * 收银台（POS）服务：商品搜索 / 结算 / 挂单
 */
import { getDb, persistDb, nextSerial, type MockDatabase } from './core/db'
import { delay, formatDateTime, genId, genNo, money, includesKeyword } from './core/helpers'
import { pushFlow, reduceShelfStock } from './core/effects'
import { shelfQtyOf } from './core/inventory'
import { fail } from './core/result'
import { MEMBER_LEVELS } from './core/seed'
import { useTenantStore } from '@/store/modules/tenant'

const currentTid = (): string => useTenantStore().currentId

const PAY_LABEL: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  bank: '银行卡',
  card: '银行卡',
  stored: '储值卡'
}

/** 支付账户编码 → 展示名称（未知编码回退编码本身） */
const payLabel = (code: string): string => (PAY_LABEL as Record<string, string>)[code] ?? code

/** 支付账户编码 → 订单支付记录类型（展示用） */
const toOrderPay = (code: string): Api.Order.PayMethod => {
  if (code === 'cash' || code === 'wechat' || code === 'alipay' || code === 'stored') return code
  if (code === 'card' || code === 'bank') return 'bank'
  return 'cash'
}

/** 收银台上下文（门店/收银员/分类） */
export interface PosContext {
  tenantName: string
  cashier: string
  warehouseId: string
  warehouses: Api.Warehouse.WarehouseItem[]
  categories: Api.Product.CategoryItem[]
}

export async function fetchPosContext(): Promise<PosContext> {
  await delay(80)
  const db = getDb()
  const tenantId = currentTid()
  const warehouses = db.warehouses.filter((w) => w.tenantId === tenantId && w.status === '1')
  const defaultWarehouse = warehouses.find((w) => w.isDefault) || warehouses[0]
  if (!defaultWarehouse) fail('当前租户还没有可用仓库，请先在库存管理中配置')

  // 分类树：一级分类 + 嵌套二级分类（对齐后端 /categories/tree 结构）
  const cats = db.categories.filter((c) => c.tenantId === tenantId).sort((a, b) => a.sort - b.sort)

  return {
    tenantName: db.tenants.find((t) => t.id === tenantId)?.name ?? '',
    cashier: '收银台',
    warehouseId: defaultWarehouse.id,
    warehouses,
    categories: cats
      .filter((c) => !c.parentId)
      .map((root) => ({
        ...root,
        children: cats.filter((c) => c.parentId === root.id)
      }))
  }
}

/** 将商品转换为购物车项（含指定门店货架可售库存） */
const toCartItem = (
  db: MockDatabase,
  product: Api.Product.ProductItem,
  warehouseId: string
): Api.Pos.CartItem => {
  const stockRow = db.stocks.find(
    (s) => s.productId === product.id && s.warehouseId === warehouseId
  )
  return {
    productId: product.id,
    barcode: product.barcode,
    name: product.name,
    unit: product.unit,
    categoryId: product.categoryId,
    price: product.salePrice,
    memberPrice: product.memberPrice,
    image: product.image ?? '',
    quantity: 1,
    stock: stockRow ? shelfQtyOf(stockRow) : 0
  }
}

/** 搜索可销售商品（条码精确优先，其次名称/条码模糊） */
export async function fetchPosProducts(
  keyword: string,
  warehouseId: string
): Promise<Api.Pos.CartItem[]> {
  await delay(100)
  const db = getDb()
  const tenantId = currentTid()
  const kw = (keyword || '').trim()
  if (!kw) return []

  const pool = db.products.filter((p) => p.tenantId === tenantId && p.status === '1')
  const exact = pool.filter((p) => p.barcode === kw)
  const fuzzy = pool.filter(
    (p) => !exact.includes(p) && (includesKeyword(p.name, kw) || includesKeyword(p.barcode, kw))
  )

  return [...exact, ...fuzzy].slice(0, 20).map((p) => toCartItem(db, p, warehouseId))
}

/** 结算 */
export async function fetchCheckout(
  params: Api.Pos.CheckoutParams
): Promise<Api.Pos.CheckoutResult> {
  await delay(320)
  const db = getDb()
  const tenantId = currentTid()

  const items = (params.items ?? []).filter((it) => it.quantity > 0)
  if (!items.length) fail('购物车为空，请先添加商品')

  const warehouse = db.warehouses.find(
    (w) => w.id === params.warehouseId && w.tenantId === tenantId
  )
  if (!warehouse) fail('请选择销售门店/仓库')

  const payments = (params.payments ?? []).filter((p) => Number(p.amount) > 0)
  if (!payments.length) fail('请至少选择一种支付方式并输入金额')

  const totalAmount = money(items.reduce((sum, it) => sum + it.price * it.quantity, 0))

  // 会员优惠：优先按商品会员价差额计算；未享受会员价的商品再按等级折扣（对齐后端 PosServiceImpl）
  const member = params.memberId
    ? db.members.find((m) => m.id === params.memberId && m.tenantId === tenantId)
    : undefined
  if (params.memberId && !member) fail('关联会员不存在或已删除')
  if (member && member.status !== '1') fail('该会员已停用，不能享受会员价')
  const levelRate = member ? (MEMBER_LEVELS.find((l) => l.id === member.levelId)?.discount ?? 1) : 1
  let vipDiscount = 0
  let plainAmount = 0
  items.forEach((it) => {
    const vip = Number(it.memberPrice) || 0
    if (vip > 0 && vip < it.price) vipDiscount += (it.price - vip) * it.quantity
    else plainAmount += it.price * it.quantity
  })
  const levelDiscount = levelRate < 1 ? money(plainAmount * (1 - levelRate)) : 0
  const memberDiscount = member ? money(vipDiscount) + levelDiscount : 0

  const discountAmount = money(
    Math.min((Number(params.discountAmount) || 0) + memberDiscount, totalAmount)
  )
  const payAmount = money(totalAmount - discountAmount)
  if (payAmount < 0) fail('优惠金额不能超过应收总额')

  const paidSum = money(payments.reduce((sum, p) => sum + Number(p.amount), 0))
  if (paidSum + 0.001 < payAmount) fail(`收款金额不足，还差 ${money(payAmount - paidSum)} 元`)

  let changeAmount = 0
  let finalPayments = payments
  const isSingleCash = payments.length === 1 && payments[0].method === 'cash'
  if (isSingleCash) {
    changeAmount = money(paidSum - payAmount)
    finalPayments = [{ method: 'cash', amount: payAmount }]
  } else if (paidSum - payAmount > 0.001) {
    fail('微信/支付宝/银行卡支付金额需与应付金额一致')
  }

  // 会员卡（储值卡）支付：需关联会员并校验余额（对齐后端 stored 支付）
  const storedPayment = finalPayments.find((p) => p.method === 'stored')
  if (storedPayment) {
    if (!member) fail('会员卡（储值卡）支付需要先关联会员')
    const balance = member.balance ?? 0
    if (balance < storedPayment.amount) {
      fail(`会员卡余额不足，当前余额 ¥ ${money(balance).toFixed(2)}`)
    }
    member.balance = money(balance - storedPayment.amount)
  }

  // 非储值支付：累加对应支付账户余额（对齐后端 PaymentMethod.balance 更新）
  finalPayments.forEach((p) => {
    if (p.method === 'stored') return
    const account = db.paymentMethods.find((a) => a.tenantId === tenantId && a.code === p.method)
    if (account) account.balance = money(account.balance + Number(p.amount))
  })

  // 预校验货架库存（POS 销售扣减的是货架可售库存，避免部分扣减）
  items.forEach((it) => {
    const row = db.stocks.find(
      (s) => s.warehouseId === warehouse.id && s.productId === it.productId
    )
    if (!row) fail(`商品「${it.name}」在当前门店无货架库存`)
    const available = shelfQtyOf(row)
    if (available < it.quantity) {
      fail(`商品「${it.name}」货架库存不足（剩余 ${available}${it.unit}）`)
    }
  })

  // 扣减货架库存
  items.forEach((it) => {
    reduceShelfStock(db, tenantId, warehouse.id, it.productId, it.quantity, `商品「${it.name}」`)
    const product = db.products.find((p) => p.id === it.productId)
    if (product) product.salesNum += it.quantity
  })

  const order: Api.Order.SalesOrder = {
    id: genId('OID'),
    tenantId,
    orderNo: genNo('SO', nextSerial(db, 'SO')),
    source: 'pos',
    warehouseId: warehouse.id,
    warehouseName: warehouse.name,
    items: items.map((it) => ({
      productId: it.productId,
      barcode: it.barcode,
      name: it.name,
      unit: it.unit,
      price: it.price,
      quantity: it.quantity,
      amount: money(it.price * it.quantity),
      refundedQty: 0
    })),
    quantity: items.reduce((sum, it) => sum + it.quantity, 0),
    totalAmount,
    discountAmount,
    payAmount,
    payments: finalPayments.map((p) => ({ method: toOrderPay(p.method), amount: p.amount })),
    status: 'paid',
    memberName: member?.name || params.memberName || '',
    cashier: params.cashier || '收银员',
    createTime: formatDateTime(),
    remark: params.remark || ''
  }
  db.orders.push(order)

  // 会员累计消费/积分（对齐后端：按实收金额计入）
  if (member) {
    member.totalConsume = money(member.totalConsume + payAmount)
    member.totalPoints += Math.trunc(payAmount)
  }

  pushFlow(db, {
    tenantId,
    type: 'income',
    category: '销售收款',
    amount: payAmount,
    method: finalPayments.map((p) => payLabel(p.method)).join('+'),
    relatedNo: order.orderNo,
    operator: order.cashier,
    remark: discountAmount > 0 ? `整单优惠 ${discountAmount} 元` : ''
  })

  persistDb()
  return { order, changeAmount }
}

/* ------------------------------ 挂单 ------------------------------ */

/** 挂单列表 */
export async function fetchHoldList(): Promise<Api.Pos.HoldItem[]> {
  await delay(60)
  const tenantId = currentTid()
  return getDb()
    .holds.filter((h) => h.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** 保存挂单（member/remark/payment 为挂单时的快照，取单后直接恢复） */
export async function fetchSaveHold(
  items: Api.Pos.CartItem[],
  options?: {
    name?: string
    member?: Api.Member.MemberItem
    remark?: string
    payment?: Api.Pos.HoldPayment
  }
): Promise<Api.Pos.HoldItem> {
  await delay(140)
  if (!items.length) fail('购物车为空，无法挂单')
  const db = getDb()
  const tenantId = currentTid()
  const defaultName = `挂单${db.holds.filter((h) => h.tenantId === tenantId).length + 1}`
  const hold: Api.Pos.HoldItem = {
    id: genId('H'),
    tenantId,
    name: options?.name?.trim() || defaultName,
    items: items.map((it) => ({ ...it })),
    totalAmount: money(items.reduce((sum, it) => sum + it.price * it.quantity, 0)),
    quantity: items.reduce((sum, it) => sum + it.quantity, 0),
    // 会员快照：仅保留结算所需字段，避免整份会员对象随挂单长期堆积
    member: options?.member ? { ...options.member } : undefined,
    remark: options?.remark || '',
    // 支付方式快照：组合支付需深拷贝各行金额，避免与页面表单共享引用
    payment: options?.payment
      ? {
          ...options.payment,
          split: options.payment.split?.map((r) => ({ ...r }))
        }
      : undefined,
    createdAt: formatDateTime()
  }
  db.holds.push(hold)
  persistDb()
  return hold
}

/** 删除挂单 */
export async function fetchRemoveHold(id: string): Promise<void> {
  await delay(80)
  const db = getDb()
  const idx = db.holds.findIndex((h) => h.id === id && h.tenantId === currentTid())
  if (idx < 0) fail('挂单不存在')
  db.holds.splice(idx, 1)
  persistDb()
}

/** 取单（返回挂单商品并删除记录） */
export async function fetchRestoreHold(id: string): Promise<Api.Pos.HoldItem> {
  await delay(120)
  const db = getDb()
  const tenantId = currentTid()
  const idx = db.holds.findIndex((h) => h.id === id && h.tenantId === tenantId)
  if (idx < 0) fail('挂单不存在')
  const hold = db.holds[idx]
  db.holds.splice(idx, 1)
  // 会员快照按 ID 刷新为最新数据（余额/积分可能已变动），会员已删除时保留原快照
  if (hold.member) {
    const latest = db.members.find((m) => m.id === hold.member!.id)
    if (latest) hold.member = { ...latest }
  }
  persistDb()
  return hold
}

/** 最近交易（本次会话展示小票/流水） */
export async function fetchRecentOrders(limit = 6): Promise<Api.Order.SalesOrder[]> {
  await delay(60)
  const tenantId = currentTid()
  return getDb()
    .orders.filter((o) => o.tenantId === tenantId)
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
    .slice(0, limit)
}
