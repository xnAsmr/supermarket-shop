/**
 * 采购业务 Mock 服务（采购订单 / 采购退货单）
 *
 * 状态机与库存联动：
 * - 采购订单：草稿 → 待审核 → 已审核（可撤销审核）→ 收货入库 → 部分收货/已完成 → 取消
 *   收货入库：加库存、生成入库台账（入库管理页可见）、回写采购明细 receivedQty、重算采购单状态
 * - 采购退货单：草稿 → 待审核 → 已退货（减库存、回写 returnedQty、重算采购单状态）
 * - 作废已生效单据时反向回滚库存与数量
 *
 * 数量不变量：
 * - receivedQty + 本次收货量 <= orderedQty
 * - returnedQty + 本次退货量 <= receivedQty
 */
import { getDb, nextSerial, persistDb, type MockDatabase } from './core/db'
import {
  delay,
  formatDateTime,
  genId,
  genNo,
  includesKeyword,
  money,
  paginate
} from './core/helpers'
import { addStock, reduceStock } from './core/effects'
import { fail } from './core/result'
import { useTenantStore } from '@/store/modules/tenant'

const currentTid = (): string => useTenantStore().currentId

/** 数量保留两位小数 */
const qty = (n: number): number => Math.round((Number(n) || 0) * 100) / 100

/* ------------------------------------------------------------------ *
 * 通用工具
 * ------------------------------------------------------------------ */

/** 采购单状态重算：按明细汇总自动推导（不手工维护） */
const recomputeOrderStatus = (order: Api.Purchase.PurchaseOrderDetail): void => {
  // 草稿/待审核/已取消为人工状态，不参与自动推导
  if (
    order.status === 'draft' ||
    order.status === 'pending_review' ||
    order.status === 'canceled'
  ) {
    return
  }

  const ordered = order.totalOrderedQty
  const received = order.totalReceivedQty
  const returned = order.totalReturnedQty

  if (returned > 0) {
    order.status = returned >= received ? 'returned' : 'partially_returned'
    return
  }
  if (received <= 0) {
    order.status = 'approved'
    return
  }
  order.status = received >= ordered ? 'completed' : 'partially_received'
}

/** 重算采购单的数量与金额汇总 */
const syncOrderTotals = (order: Api.Purchase.PurchaseOrderDetail): void => {
  order.totalOrderedQty = qty(order.items.reduce((s, it) => s + it.orderedQty, 0))
  order.totalReceivedQty = qty(order.items.reduce((s, it) => s + it.receivedQty, 0))
  order.totalReturnedQty = qty(order.items.reduce((s, it) => s + it.returnedQty, 0))
  order.totalAmount = money(order.items.reduce((s, it) => s + it.totalPrice, 0))
}

/** 查找采购订单（按租户隔离） */
const findOrder = (
  db: MockDatabase,
  tenantId: string,
  id: string
): Api.Purchase.PurchaseOrderDetail => {
  const order = db.purchaseOrders.find((o) => o.id === id && o.tenantId === tenantId)
  if (!order) fail('采购订单不存在')
  return order
}

/** 查找采购退货单（按租户隔离） */
const findReturn = (db: MockDatabase, tenantId: string, id: string) => {
  const ret = db.purchaseReturns.find((r) => r.id === id && r.tenantId === tenantId)
  if (!ret) fail('采购退货单不存在')
  return ret
}

/** 按商品查找采购订单明细（手工单据无 orderItemId 时兜底） */
const findOrderItemByProduct = (
  order: Api.Purchase.PurchaseOrderDetail,
  productId: string
): Api.Purchase.PurchaseOrderItem | undefined =>
  order.items.find((it) => it.productId === productId) ||
  order.items.find((it) => it.productId === productId && it.orderedQty > it.receivedQty)

/* ------------------------------------------------------------------ *
 * 采购订单
 * ------------------------------------------------------------------ */

/** 采购订单列表 */
export async function fetchPurchaseOrderList(
  params: Api.Purchase.PurchaseOrderSearchParams
): Promise<Api.Purchase.PurchaseOrderList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const list = db.purchaseOrders
    .filter((o) => {
      if (o.tenantId !== tenantId) return false
      if (params.orderNo && !includesKeyword(o.orderNo, params.orderNo)) return false
      if (params.supplierId && o.supplierId !== params.supplierId) return false
      if (params.storeId && o.storeId !== params.storeId) return false
      if (params.status && o.status !== params.status) return false
      const date = o.createTime.slice(0, 10)
      if (params.startTime && date < params.startTime) return false
      if (params.endTime && date > params.endTime) return false
      return true
    })
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
  return paginate(list, params)
}

/** 采购订单详情 */
export async function fetchPurchaseOrderDetail(
  id: string
): Promise<Api.Purchase.PurchaseOrderDetail> {
  await delay()
  const db = getDb()
  return findOrder(db, currentTid(), id)
}

/** 组装采购订单明细（写入订单前） */
const buildOrderItems = (
  db: MockDatabase,
  tenantId: string,
  items: Api.Purchase.PurchaseOrderItem[]
): Api.Purchase.PurchaseOrderItem[] => {
  const result: Api.Purchase.PurchaseOrderItem[] = []
  items.forEach((it) => {
    const orderedQty = qty(it.orderedQty)
    if (orderedQty <= 0) return
    const product = db.products.find((p) => p.id === it.productId && p.tenantId === tenantId)
    if (!product) fail('采购明细中包含不存在的商品')
    const purchasePrice = money(it.purchasePrice || product.purchasePrice)
    result.push({
      id: genId('POI'),
      productId: product.id,
      productName: product.name,
      barcode: product.barcode,
      spec: product.spec,
      unit: product.unit,
      orderedQty,
      receivedQty: 0,
      returnedQty: 0,
      purchasePrice,
      totalPrice: money(purchasePrice * orderedQty),
      remark: it.remark || ''
    })
  })
  if (!result.length) fail('请至少添加一个采购商品')
  return result
}

/** 新建采购订单（草稿） */
export async function fetchCreatePurchaseOrder(
  data: Partial<Api.Purchase.PurchaseOrderDetail>
): Promise<Api.Purchase.PurchaseOrderDetail> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()

  const supplier = db.suppliers.find((s) => s.id === data.supplierId && s.tenantId === tenantId)
  if (!supplier) fail('请选择供应商')
  const store = db.warehouses.find((w) => w.id === data.storeId && w.tenantId === tenantId)
  if (!store) fail('请选择收货门店')

  const order: Api.Purchase.PurchaseOrderDetail = {
    id: genId('PO'),
    tenantId,
    orderNo: genNo('PO', nextSerial(db, 'PO')),
    supplierId: supplier.id,
    supplierName: supplier.name,
    storeId: store.id,
    storeName: store.name,
    totalAmount: 0,
    totalOrderedQty: 0,
    totalReceivedQty: 0,
    totalReturnedQty: 0,
    status: 'draft',
    operatorName: data.operatorName || '当前用户',
    reviewerName: '',
    reviewTime: '',
    reviewRemark: '',
    finishTime: '',
    remark: data.remark || '',
    createTime: formatDateTime(),
    items: buildOrderItems(db, tenantId, data.items ?? [])
  }
  syncOrderTotals(order)
  db.purchaseOrders.push(order)
  persistDb()
  return order
}

/** 编辑采购订单（仅草稿） */
export async function fetchUpdatePurchaseOrder(
  id: string,
  data: Partial<Api.Purchase.PurchaseOrderDetail>
): Promise<Api.Purchase.PurchaseOrderDetail> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()
  const order = findOrder(db, tenantId, id)
  if (order.status !== 'draft') fail('仅草稿状态的采购订单可以编辑')

  if (data.supplierId) {
    const supplier = db.suppliers.find((s) => s.id === data.supplierId && s.tenantId === tenantId)
    if (!supplier) fail('供应商不存在')
    order.supplierId = supplier.id
    order.supplierName = supplier.name
  }
  if (data.storeId) {
    const store = db.warehouses.find((w) => w.id === data.storeId && w.tenantId === tenantId)
    if (!store) fail('收货门店不存在')
    order.storeId = store.id
    order.storeName = store.name
  }
  if (data.remark !== undefined) order.remark = data.remark
  if (data.items) {
    order.items = buildOrderItems(db, tenantId, data.items)
  }
  syncOrderTotals(order)
  persistDb()
  return order
}

/** 删除采购订单（仅草稿） */
export async function fetchDeletePurchaseOrder(id: string): Promise<void> {
  await delay(150)
  const db = getDb()
  const tenantId = currentTid()
  const order = findOrder(db, tenantId, id)
  if (order.status !== 'draft') fail('仅草稿状态的采购订单可以删除')
  db.purchaseOrders = db.purchaseOrders.filter((o) => o.id !== id)
  persistDb()
}

/** 提交采购订单审核（草稿 → 待审核） */
export async function fetchSubmitPurchaseOrder(id: string): Promise<void> {
  await delay(150)
  const db = getDb()
  const order = findOrder(db, currentTid(), id)
  if (order.status !== 'draft') fail('仅草稿状态的采购订单可以提交审核')
  if (!order.items.length) fail('采购订单没有明细，无法提交审核')
  order.status = 'pending_review'
  persistDb()
}

/** 审核通过采购订单（待审核 → 已审核） */
export async function fetchReviewPurchaseOrder(id: string, remark?: string): Promise<void> {
  await delay(150)
  const db = getDb()
  const order = findOrder(db, currentTid(), id)
  if (order.status !== 'pending_review') fail('仅待审核状态的采购订单可以审核')
  order.status = 'approved'
  order.reviewerName = '当前用户'
  order.reviewTime = formatDateTime()
  order.reviewRemark = remark || ''
  persistDb()
}

/** 撤销采购订单审核（待审核 → 草稿） */
export async function fetchRevokePurchaseOrderReview(id: string): Promise<void> {
  await delay(150)
  const db = getDb()
  const order = findOrder(db, currentTid(), id)
  if (order.status !== 'pending_review') fail('仅待审核状态的采购订单可以撤销审核')
  order.status = 'draft'
  order.reviewerName = ''
  order.reviewTime = ''
  order.reviewRemark = ''
  persistDb()
}

/** 取消采购订单（已收货后不可取消） */
export async function fetchCancelPurchaseOrder(id: string, remark?: string): Promise<void> {
  await delay(150)
  const db = getDb()
  const order = findOrder(db, currentTid(), id)
  if (order.status === 'canceled') fail('该采购订单已取消')
  if (order.totalReceivedQty > 0) fail('该采购订单已有收货记录，不能取消')
  order.status = 'canceled'
  order.reviewRemark = remark || order.reviewRemark
  persistDb()
}

/** 可收货明细（orderedQty - receivedQty > 0） */
export async function fetchGetReceivableItems(
  id: string
): Promise<Api.Purchase.PurchaseOrderItem[]> {
  await delay()
  const db = getDb()
  const order = findOrder(db, currentTid(), id)
  return order.items
    .filter((it) => qty(it.orderedQty - it.receivedQty) > 0)
    .map((it) => ({ ...it }))
}

/** 可退明细（receivedQty - returnedQty > 0） */
export async function fetchGetReturnableItems(
  id: string
): Promise<Api.Purchase.PurchaseOrderItem[]> {
  await delay()
  const db = getDb()
  const order = findOrder(db, currentTid(), id)
  return order.items
    .filter((it) => qty(it.receivedQty - it.returnedQty) > 0)
    .map((it) => ({ ...it }))
}

/* ------------------------------------------------------------------ *
 * 收货入库（采购订单 → 入库台账）
 * ------------------------------------------------------------------ */

/** 收货入库：加库存 + 生成入库台账（入库管理页可见）+ 回写 receivedQty + 重算采购单状态 */
export async function fetchReceivePurchaseOrder(
  id: string,
  data: { items: { orderItemId: string; quantity: number; batchNo?: string }[] }
): Promise<void> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()
  const order = findOrder(db, tenantId, id)
  if (order.status !== 'approved' && order.status !== 'partially_received') {
    fail('当前状态不能收货')
  }

  const receiveItems = data.items.filter((it) => qty(it.quantity) > 0)
  if (!receiveItems.length) fail('请至少填写一行收货数量')

  const resolved = receiveItems.map((it) => {
    const orderItem = order.items.find((oi) => oi.id === it.orderItemId)
    if (!orderItem) fail('采购订单明细不存在')
    const receivable = qty(orderItem.orderedQty - orderItem.receivedQty)
    if (qty(it.quantity) > receivable) {
      fail(`商品「${orderItem.productName}」本次收货数量超出可收数量（可收 ${receivable}）`)
    }
    return { orderItem, quantity: qty(it.quantity), batchNo: it.batchNo || '' }
  })

  // 加库存
  resolved.forEach(({ orderItem, quantity }) => {
    addStock(db, tenantId, order.storeId, orderItem.productId, quantity)
  })

  // 回写采购明细 receivedQty + 重算采购单状态
  resolved.forEach(({ orderItem, quantity }) => {
    orderItem.receivedQty = qty(orderItem.receivedQty + quantity)
  })
  syncOrderTotals(order)
  recomputeOrderStatus(order)
  if ((order.status as string) === 'completed' && !order.finishTime) {
    order.finishTime = formatDateTime()
  }

  // 生成入库台账（入库管理页统一展示，来源采购订单）
  const now = formatDateTime()
  db.stockDocs.push({
    id: genId('SD'),
    tenantId,
    type: 'inbound',
    docNo: genNo('RK', nextSerial(db, 'RK')),
    warehouseId: order.storeId,
    warehouseName: order.storeName,
    targetWarehouseId: '',
    targetWarehouseName: '',
    status: 'done',
    items: resolved.map(({ orderItem, quantity }) => ({
      productId: orderItem.productId,
      barcode: orderItem.barcode,
      productName: orderItem.productName,
      unit: orderItem.unit,
      quantity,
      price: orderItem.purchasePrice
    })),
    totalQty: qty(resolved.reduce((s, r) => s + r.quantity, 0)),
    operator: '当前用户',
    createTime: now,
    finishTime: now,
    sourceOrderNo: order.orderNo,
    remark: `采购收货入库 ${order.orderNo}`
  })
  persistDb()
}

/* ------------------------------------------------------------------ *
 * 采购退货单
 * ------------------------------------------------------------------ */

/** 采购退货单列表 */
export async function fetchPurchaseReturnList(
  params: Api.Purchase.PurchaseReturnSearchParams
): Promise<Api.Purchase.PurchaseReturnList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const list = db.purchaseReturns
    .filter((r) => {
      if (r.tenantId !== tenantId) return false
      if (params.returnNo && !includesKeyword(r.returnNo, params.returnNo)) return false
      if (params.orderNo && !includesKeyword(r.orderNo, params.orderNo)) return false
      if (params.receiptNo && !includesKeyword(r.receiptNo, params.receiptNo)) return false
      if (params.supplierId && r.supplierId !== params.supplierId) return false
      if (params.storeId && r.storeId !== params.storeId) return false
      if (params.status && r.status !== params.status) return false
      const date = r.createTime.slice(0, 10)
      if (params.startTime && date < params.startTime) return false
      if (params.endTime && date > params.endTime) return false
      return true
    })
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
  return paginate(list, params)
}

/** 采购退货单详情 */
export async function fetchPurchaseReturnDetail(id: string): Promise<Api.Purchase.PurchaseReturn> {
  await delay()
  const db = getDb()
  return findReturn(db, currentTid(), id)
}

/** 组装采购退货单明细 */
const buildReturnItems = (
  db: MockDatabase,
  tenantId: string,
  items: Api.Purchase.PurchaseReturnItem[],
  order?: Api.Purchase.PurchaseOrderDetail
): Api.Purchase.PurchaseReturnItem[] => {
  const result: Api.Purchase.PurchaseReturnItem[] = []
  items.forEach((it) => {
    const quantity = qty(it.quantity)
    if (quantity <= 0) return
    const product = db.products.find((p) => p.id === it.productId && p.tenantId === tenantId)
    if (!product) fail('退货明细中包含不存在的商品')
    const purchasePrice = money(it.purchasePrice || product.purchasePrice)
    result.push({
      id: genId('THI'),
      orderItemId: it.orderItemId || '',
      receiptItemId: it.receiptItemId || '',
      productId: product.id,
      productName: product.name,
      barcode: product.barcode,
      spec: product.spec,
      unit: product.unit,
      quantity,
      purchasePrice,
      totalPrice: money(purchasePrice * quantity)
    })
  })
  if (!result.length) fail('请至少填写一行退货明细')
  // 数量不变量校验：returnedQty + 本次退货量 <= receivedQty
  if (order) {
    result.forEach((it) => {
      const orderItem = order.items.find((oi) => oi.id === it.orderItemId)
      if (!orderItem) return
      const returnable = qty(orderItem.receivedQty - orderItem.returnedQty)
      if (it.quantity > returnable) {
        fail(`商品「${it.productName}」本次退货数量超出可退数量（可退 ${returnable}）`)
      }
    })
  }
  return result
}

/** 新建采购退货单 */
export async function fetchCreatePurchaseReturn(
  data: Partial<Api.Purchase.PurchaseReturn>
): Promise<Api.Purchase.PurchaseReturn> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()

  const order = data.orderId ? findOrder(db, tenantId, data.orderId) : undefined

  const storeId = data.storeId || order?.storeId || ''
  const store = db.warehouses.find((w) => w.id === storeId && w.tenantId === tenantId)
  if (!store) fail('请选择退货门店')

  const supplierId = data.supplierId || order?.supplierId || ''
  const supplier = db.suppliers.find((s) => s.id === supplierId && s.tenantId === tenantId)

  const items = buildReturnItems(db, tenantId, data.items ?? [], order)
  const ret: Api.Purchase.PurchaseReturn = {
    id: genId('TH'),
    tenantId,
    returnNo: genNo('TH', nextSerial(db, 'TH')),
    orderId: order?.id ?? '',
    orderNo: order?.orderNo ?? '',
    receiptId: '',
    receiptNo: '',
    supplierId: supplier?.id ?? '',
    supplierName: supplier?.name ?? '',
    storeId: store.id,
    storeName: store.name,
    totalAmount: money(items.reduce((s, it) => s + it.totalPrice, 0)),
    totalQuantity: qty(items.reduce((s, it) => s + it.quantity, 0)),
    status: 'draft',
    operatorName: data.operatorName || '当前用户',
    reviewerName: '',
    reviewTime: '',
    reviewRemark: '',
    returnTime: '',
    reason: data.reason || '',
    remark: data.remark || '',
    createTime: formatDateTime(),
    items
  }
  db.purchaseReturns.push(ret)
  persistDb()
  return ret
}

/** 编辑采购退货单（仅草稿） */
export async function fetchUpdatePurchaseReturn(
  id: string,
  data: Partial<Api.Purchase.PurchaseReturn>
): Promise<Api.Purchase.PurchaseReturn> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()
  const ret = findReturn(db, tenantId, id)
  if (ret.status !== 'draft') fail('仅草稿状态的采购退货单可以编辑')

  const order = data.orderId ? findOrder(db, tenantId, data.orderId) : undefined
  if (data.storeId) {
    const store = db.warehouses.find((w) => w.id === data.storeId && w.tenantId === tenantId)
    if (!store) fail('退货门店不存在')
    ret.storeId = store.id
    ret.storeName = store.name
  }
  if (data.reason !== undefined) ret.reason = data.reason
  if (data.remark !== undefined) ret.remark = data.remark
  if (data.items) {
    const items = buildReturnItems(db, tenantId, data.items, order)
    ret.items = items
    ret.totalAmount = money(items.reduce((s, it) => s + it.totalPrice, 0))
    ret.totalQuantity = qty(items.reduce((s, it) => s + it.quantity, 0))
  }
  persistDb()
  return ret
}

/** 删除采购退货单（仅草稿） */
export async function fetchDeletePurchaseReturn(id: string): Promise<void> {
  await delay(150)
  const db = getDb()
  const tenantId = currentTid()
  const ret = findReturn(db, tenantId, id)
  if (ret.status !== 'draft') fail('仅草稿状态的采购退货单可以删除')
  db.purchaseReturns = db.purchaseReturns.filter((r) => r.id !== id)
  persistDb()
}

/** 提交采购退货单审核（草稿 → 待审核） */
export async function fetchSubmitPurchaseReturn(id: string): Promise<void> {
  await delay(150)
  const db = getDb()
  const ret = findReturn(db, currentTid(), id)
  if (ret.status !== 'draft') fail('仅草稿状态的采购退货单可以提交审核')
  if (!ret.items.length) fail('采购退货单没有明细，无法提交审核')
  ret.status = 'pending_review'
  persistDb()
}

/** 审核通过采购退货单（待审核 → 已审核待退货，不影响库存） */
export async function fetchReviewPurchaseReturn(id: string, remark?: string): Promise<void> {
  await delay(180)
  const db = getDb()
  const ret = findReturn(db, currentTid(), id)
  if (ret.status !== 'pending_review') fail('仅待审核状态的采购退货单可以审核')
  ret.status = 'reviewed'
  ret.reviewerName = '当前用户'
  ret.reviewTime = formatDateTime()
  ret.reviewRemark = remark || ''
  persistDb()
}

/** 采购退货单确认生效（减库存 + 回写 returnedQty + 重算采购单状态） */
export async function fetchConfirmPurchaseReturn(id: string): Promise<void> {
  await delay(200)
  const db = getDb()
  const tenantId = currentTid()
  const ret = findReturn(db, tenantId, id)
  if (ret.status === 'returned') return
  if (ret.status !== 'reviewed') fail('仅已审核状态的采购退货单可以确认退货')
  ret.status = 'returned'
  ret.returnTime = formatDateTime()
  applyReturnConfirm(db, tenantId, ret)
  persistDb()
}

/** 执行退货生效的业务副作用 */
const applyReturnConfirm = (
  db: MockDatabase,
  tenantId: string,
  ret: Api.Purchase.PurchaseReturn
): void => {
  const order = ret.orderId
    ? db.purchaseOrders.find((o) => o.id === ret.orderId && o.tenantId === tenantId)
    : undefined

  // 先做数量不变量校验：returnedQty + 本次退货量 <= receivedQty
  if (order) {
    ret.items.forEach((it) => {
      const orderItem =
        order.items.find((oi) => oi.id === it.orderItemId) ||
        findOrderItemByProduct(order, it.productId)
      if (!orderItem) return
      if (qty(orderItem.returnedQty + it.quantity) > qty(orderItem.receivedQty)) {
        fail(
          `商品「${it.productName}」退货数量超出已收数量（已收 ${orderItem.receivedQty}，已退 ${orderItem.returnedQty}）`
        )
      }
    })
  }

  ret.items.forEach((it) => {
    // 库存不足时抛出业务错误
    reduceStock(db, tenantId, ret.storeId, it.productId, it.quantity, it.productName)
  })

  if (order) {
    ret.items.forEach((it) => {
      const orderItem =
        order.items.find((oi) => oi.id === it.orderItemId) ||
        findOrderItemByProduct(order, it.productId)
      if (!orderItem) return
      orderItem.returnedQty = qty(orderItem.returnedQty + it.quantity)
    })
    syncOrderTotals(order)
    recomputeOrderStatus(order)
  }
}

/** 作废采购退货单（已退货的恢复库存与数量） */
export async function fetchCancelPurchaseReturn(id: string, remark?: string): Promise<void> {
  await delay(200)
  const db = getDb()
  const tenantId = currentTid()
  const ret = findReturn(db, tenantId, id)
  if (ret.status === 'voided') fail('该采购退货单已作废')
  if (ret.status === 'returned') {
    const order = ret.orderId
      ? db.purchaseOrders.find((o) => o.id === ret.orderId && o.tenantId === tenantId)
      : undefined
    ret.items.forEach((it) => {
      addStock(db, tenantId, ret.storeId, it.productId, it.quantity)
    })
    if (order) {
      ret.items.forEach((it) => {
        const orderItem =
          order.items.find((oi) => oi.id === it.orderItemId) ||
          findOrderItemByProduct(order, it.productId)
        if (!orderItem) return
        orderItem.returnedQty = qty(Math.max(0, orderItem.returnedQty - it.quantity))
      })
      syncOrderTotals(order)
      recomputeOrderStatus(order)
    }
  }
  ret.status = 'voided'
  ret.reviewRemark = remark || ret.reviewRemark
  persistDb()
}
