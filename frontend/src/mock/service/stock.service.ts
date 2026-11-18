/**
 * 仓库与库存服务（仓库 / 库存查询 / 入库·出库·调拨·盘点单据）
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
import { ensureStockRow, syncProductStock, syncStockRow } from './core/effects'
import { normalizeStockRow, syncStockDerived, totalQtyOf, warehouseQtyOf } from './core/inventory'
import { fail } from './core/result'
import { useTenantStore } from '@/store/modules/tenant'

const currentTid = (): string => useTenantStore().currentId

const DOC_PREFIX: Record<Api.Warehouse.StockDocType, string> = {
  inbound: 'RK',
  outbound: 'CK',
  transfer: 'DB',
  stocktake: 'PD'
}

/** 预警状态排序权重：缺货 → 紧急 → 预警 → 正常 */
const STATUS_WEIGHT: Record<Api.Warehouse.StockStatus, number> = {
  out_of_stock: 0,
  urgent: 1,
  warning: 2,
  normal: 3
}

/**
 * 计算在途库存：已审核 / 部分收货采购订单中尚未收货的数量
 *
 * 在途数按「门店 + 商品」汇总，读取库存时实时计算，采购收货后自动减少。
 */
const calcPendingInQuantity = (db: MockDatabase, warehouseId: string, productId: string): number =>
  db.purchaseOrders
    .filter(
      (order) =>
        order.storeId === warehouseId &&
        (order.status === 'approved' || order.status === 'partially_received')
    )
    .flatMap((order) => order.items)
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + Math.max(0, item.orderedQty - item.receivedQty), 0)

/** 刷新库存行的在途数量并重新计算补货方式 */
const refreshPendingIn = (db: MockDatabase, tenantId: string): void => {
  db.stocks
    .filter((row) => row.tenantId === tenantId)
    .forEach((row) => {
      normalizeStockRow(row)
      row.pendingInQuantity = calcPendingInQuantity(db, row.warehouseId, row.productId)
      syncStockDerived(row)
    })
}

/** 计算仓库实时库存概况 */
const decorateWarehouse = (
  db: MockDatabase,
  warehouse: Api.Warehouse.WarehouseItem
): Api.Warehouse.WarehouseItem => {
  const rows = db.stocks.filter((s) => s.warehouseId === warehouse.id)
  return {
    ...warehouse,
    stockNum: rows.reduce((sum, r) => sum + totalQtyOf(r), 0),
    stockValue: money(rows.reduce((sum, r) => sum + r.stockValue, 0))
  }
}

/** 应用单据对库存的影响（revert=true 时用于回滚草稿作废场景，仅支持未生效单据） */
const applyDocEffect = (db: MockDatabase, doc: Api.Warehouse.StockDoc, reverse = false): void => {
  const tenantId = doc.tenantId
  const from = db.warehouses.find((w) => w.id === doc.warehouseId && w.tenantId === tenantId)
  const to = doc.targetWarehouseId
    ? db.warehouses.find((w) => w.id === doc.targetWarehouseId && w.tenantId === tenantId)
    : undefined
  if (!from) fail('仓库不存在，请刷新后重试')

  doc.items.forEach((item) => {
    const sign = reverse ? -1 : 1
    switch (doc.type) {
      case 'inbound': {
        const row = ensureStockRow(db, tenantId, from.id, item.productId)
        row.warehouseQuantity = Math.max(0, warehouseQtyOf(row) + sign * item.quantity)
        syncStockRow(row)
        break
      }
      case 'outbound': {
        const row = db.stocks.find(
          (s) => s.warehouseId === from.id && s.productId === item.productId
        )
        if (!row) fail(`商品「${item.productName}」在该仓库无库存，无法出库`)
        const available = warehouseQtyOf(row)
        if (sign > 0 && available < item.quantity) {
          fail(`商品「${item.productName}」库存不足（剩余 ${available}${row.unit}）`)
        }
        row.warehouseQuantity = Math.max(0, available - sign * item.quantity)
        syncStockRow(row)
        break
      }
      case 'transfer': {
        if (!to) fail('请选择调入仓库')
        const source = db.stocks.find(
          (s) => s.warehouseId === from.id && s.productId === item.productId
        )
        if (!source) fail(`商品「${item.productName}」在调出仓库无库存`)
        const available = warehouseQtyOf(source)
        if (sign > 0 && available < item.quantity) {
          fail(`商品「${item.productName}」库存不足（剩余 ${available}${source.unit}）`)
        }
        source.warehouseQuantity = Math.max(0, available - sign * item.quantity)
        syncStockRow(source)
        const target = ensureStockRow(db, tenantId, to.id, item.productId)
        target.warehouseQuantity = Math.max(0, warehouseQtyOf(target) + sign * item.quantity)
        syncStockRow(target)
        break
      }
      case 'stocktake': {
        const row = db.stocks.find(
          (s) => s.warehouseId === from.id && s.productId === item.productId
        )
        if (!row) fail(`商品「${item.productName}」在该仓库无库存记录`)
        row.warehouseQuantity = item.actualQuantity ?? warehouseQtyOf(row)
        syncStockRow(row)
        break
      }
    }
  })

  // 同步商品表冗余库存
  const touched = new Set(doc.items.map((it) => it.productId))
  touched.forEach((productId) => syncProductStock(db, productId))
}

/* ------------------------------ 仓库 ------------------------------ */

/** 仓库列表（含实时库存） */
export async function fetchWarehouseList(): Promise<Api.Warehouse.WarehouseItem[]> {
  await delay(60)
  const db = getDb()
  const tenantId = currentTid()
  return db.warehouses
    .filter((w) => w.tenantId === tenantId)
    .map((w) => decorateWarehouse(db, w))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
}

/* ------------------------------ 库存 ------------------------------ */

/** 库存分页列表 */
export async function fetchStockList(
  params: Api.Warehouse.StockSearchParams
): Promise<Api.Warehouse.StockList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  refreshPendingIn(db, tenantId)
  const list = db.stocks
    .filter((s) => {
      if (s.tenantId !== tenantId) return false
      if (params.warehouseId && s.warehouseId !== params.warehouseId) return false
      if (params.categoryId && s.categoryId !== params.categoryId) return false
      if (params.warnLevel === 'warning' && s.stockStatus === 'normal') return false
      if (params.warnLevel === 'urgent' && s.stockStatus !== 'urgent') return false
      if (params.warnLevel === 'out_of_stock' && s.stockStatus !== 'out_of_stock') return false
      if (params.warning && s.stockStatus === 'normal') return false
      if (params.productName && !includesKeyword(s.productName, params.productName)) return false
      if (params.barcode && !includesKeyword(s.barcode, params.barcode)) return false
      return true
    })
    .map((s) => {
      normalizeStockRow(s)
      return s
    })
    .sort(
      (a, b) =>
        STATUS_WEIGHT[a.stockStatus] - STATUS_WEIGHT[b.stockStatus] ||
        a.shelfQuantity - b.shelfQuantity ||
        a.productName.localeCompare(b.productName)
    )
  return paginate(list, params)
}

/** 库存预警列表（驾驶舱用） */
export async function fetchStockWarnings(limit = 8): Promise<Api.Warehouse.StockItem[]> {
  await delay(60)
  const db = getDb()
  const tenantId = currentTid()
  refreshPendingIn(db, tenantId)
  return db.stocks
    .filter((s) => {
      if (s.tenantId !== tenantId) return false
      normalizeStockRow(s)
      return s.stockStatus !== 'normal'
    })
    .sort(
      (a, b) =>
        STATUS_WEIGHT[a.stockStatus] - STATUS_WEIGHT[b.stockStatus] ||
        a.shelfQuantity - b.shelfQuantity
    )
    .slice(0, limit)
}

/* ------------------------------ 库存单据 ------------------------------ */

/** 单据列表 */
export async function fetchStockDocList(
  params: Api.Warehouse.StockDocSearchParams
): Promise<Api.Warehouse.StockDocList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const list = db.stockDocs
    .filter(
      (d) =>
        d.tenantId === tenantId &&
        (!params.type || d.type === params.type) &&
        includesKeyword(d.docNo, params.docNo) &&
        (!params.warehouseId || d.warehouseId === params.warehouseId) &&
        (!params.status || d.status === params.status)
    )
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
  return paginate(list, params)
}

/** 新建单据（默认直接生效；stocktake 生成后需在列表中“完成盘点”或“作废”） */
export async function fetchCreateStockDoc(
  data: Partial<Api.Warehouse.StockDoc>
): Promise<Api.Warehouse.StockDoc> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()
  const type = data.type
  if (!type) fail('请选择单据类型')

  const from = db.warehouses.find((w) => w.id === data.warehouseId && w.tenantId === tenantId)
  if (!from) fail('请选择仓库')
  if (type === 'transfer') {
    if (!data.targetWarehouseId) fail('请选择调入仓库')
    if (data.targetWarehouseId === from.id) fail('调出与调入仓库不能相同')
  }

  const items = (data.items ?? []).filter(
    (it) => Number(it.quantity) > 0 || it.actualQuantity != null
  )
  if (!items.length) fail('请至少添加一个商品明细')
  if (type === 'stocktake') {
    if (items.some((it) => it.actualQuantity == null || Number(it.actualQuantity) < 0)) {
      fail('请填写每个商品的实盘数量')
    }
  } else if (items.some((it) => Number(it.quantity) <= 0)) {
    fail('商品数量必须大于 0')
  }

  const target = data.targetWarehouseId
    ? db.warehouses.find((w) => w.id === data.targetWarehouseId && w.tenantId === tenantId)
    : undefined

  const doc: Api.Warehouse.StockDoc = {
    id: genId('SD'),
    tenantId,
    type,
    docNo: genNo(DOC_PREFIX[type], nextSerial(db, DOC_PREFIX[type])),
    warehouseId: from.id,
    warehouseName: from.name,
    targetWarehouseId: target?.id ?? '',
    targetWarehouseName: target?.name ?? '',
    status: type === 'stocktake' ? 'draft' : 'done',
    items: items.map((it) => ({
      ...it,
      quantity: Number(it.quantity) || 0,
      actualQuantity: it.actualQuantity != null ? Number(it.actualQuantity) : undefined
    })),
    totalQty: items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0),
    operator: data.operator || '当前用户',
    createTime: formatDateTime(),
    finishTime: type === 'stocktake' ? '' : formatDateTime(),
    remark: data.remark || ''
  }

  db.stockDocs.push(doc)

  // 盘点草稿不立即生效，其余单据直接应用
  if (doc.status === 'done') {
    applyDocEffect(db, doc)
  }

  persistDb()
  return doc
}

/** 完成草稿/待入库单据（目前用于盘点确认与采购入库确认） */
export async function fetchFinishStockDoc(id: string): Promise<Api.Warehouse.StockDoc> {
  await delay(180)
  const db = getDb()
  const doc = db.stockDocs.find((d) => d.id === id && d.tenantId === currentTid())
  if (!doc) fail('单据不存在')
  if (doc.status !== 'draft' && doc.status !== 'reviewed') {
    fail('仅草稿或待入库状态的单据可以完成')
  }

  applyDocEffect(db, doc)
  doc.status = 'done'
  doc.finishTime = formatDateTime()
  persistDb()
  return doc
}

/** 作废单据（仅草稿可作废） */
export async function fetchCancelStockDoc(id: string): Promise<void> {
  await delay(150)
  const db = getDb()
  const doc = db.stockDocs.find((d) => d.id === id && d.tenantId === currentTid())
  if (!doc) fail('单据不存在')
  if (doc.status !== 'draft') fail('已完成的单据不能作废，可通过对冲单据调整')
  doc.status = 'canceled'
  persistDb()
}
