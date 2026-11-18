/**
 * 上架单 Mock 服务（仓库 → 货架）
 *
 * 状态机：
 * - draft 草稿：可编辑 / 删除 / 确认上架
 * - confirmed 已上架：仓库减少、货架增加，可撤销上架
 * - rolled_back 已撤销：货架减少、仓库增加
 *
 * 库存按 storeId（后端门店即仓库）+ productId 定位，状态变更前先校验库存是否充足，
 * 避免出现部分明细已扣减、部分失败的脏数据。
 */
import { getDb, nextSerial, persistDb, type MockDatabase } from './core/db'
import { addShelfStock, addStock, reduceShelfStock, reduceStock } from './core/effects'
import { delay, formatDateTime, genId, genNo, includesKeyword, paginate } from './core/helpers'
import { shelfQtyOf, warehouseQtyOf } from './core/inventory'
import { fail } from './core/result'
import { useTenantStore } from '@/store/modules/tenant'

const currentTid = (): string => useTenantStore().currentId

/** 数量保留两位小数 */
const qty = (n: number): number => Math.round((Number(n) || 0) * 100) / 100

/** 当前租户下的门店 ID 集合（上架单类型无 tenantId，通过门店归属做租户隔离） */
const tenantStoreIds = (db: MockDatabase, tenantId: string): Set<string> =>
  new Set(db.warehouses.filter((w) => w.tenantId === tenantId).map((w) => String(w.id)))

/** 查找上架单（校验门店归属当前租户） */
const findShelfUp = (
  db: MockDatabase,
  tenantId: string,
  id: string
): Api.Warehouse.ShelfUpOrder => {
  const order = db.shelfUps.find((item) => item.id === id)
  if (!order || !tenantStoreIds(db, tenantId).has(String(order.storeId))) {
    fail('上架单不存在')
  }
  return order
}

/** 读取当前库存快照 */
const currentStock = (db: MockDatabase, storeId: string, productId: string) => {
  const row = db.stocks.find((s) => s.warehouseId === storeId && s.productId === productId)
  return {
    warehouseQuantity: row ? warehouseQtyOf(row) : 0,
    shelfQuantity: row ? shelfQtyOf(row) : 0
  }
}

/** 刷新单据明细中的当前库存快照（列表 / 详情返回时使用） */
const decorateShelfUp = (
  db: MockDatabase,
  order: Api.Warehouse.ShelfUpOrder
): Api.Warehouse.ShelfUpOrder => {
  order.items = order.items.map((item) => ({
    ...item,
    ...currentStock(db, order.storeId, item.productId)
  }))
  order.totalQuantity = qty(order.items.reduce((sum, item) => sum + item.quantity, 0))
  return order
}

/** 组装上架明细（校验商品、去重、数量） */
const buildItems = (
  db: MockDatabase,
  tenantId: string,
  storeId: string,
  items: Api.Warehouse.ShelfUpItem[]
): Api.Warehouse.ShelfUpItem[] => {
  const result: Api.Warehouse.ShelfUpItem[] = []
  const seen = new Set<string>()
  items.forEach((item) => {
    const quantity = qty(item.quantity)
    if (quantity <= 0) return
    if (!item.productId) fail('请选择上架商品')
    if (seen.has(item.productId)) fail('同一商品请合并为一行')
    seen.add(item.productId)
    const product = db.products.find((p) => p.id === item.productId && p.tenantId === tenantId)
    if (!product) fail('上架明细中包含不存在的商品')
    const stock = currentStock(db, storeId, product.id)
    result.push({
      id: genId('SJUI'),
      productId: product.id,
      productName: product.name,
      barcode: product.barcode,
      spec: product.spec,
      unit: product.unit,
      quantity,
      warehouseQuantity: stock.warehouseQuantity,
      shelfQuantity: stock.shelfQuantity,
      remark: item.remark || ''
    })
  })
  if (!result.length) fail('请至少添加一个上架商品')
  return result
}

/** 上架单列表 */
export async function fetchShelfUpList(
  params: Api.Warehouse.ShelfUpSearchParams
): Promise<Api.Warehouse.ShelfUpOrderList> {
  await delay()
  const db = getDb()
  const storeIds = tenantStoreIds(db, currentTid())
  const list = db.shelfUps
    .filter((order) => {
      if (!storeIds.has(String(order.storeId))) return false
      if (params.shelfUpNo && !includesKeyword(order.shelfUpNo, params.shelfUpNo)) return false
      if (params.storeId && String(order.storeId) !== params.storeId) return false
      if (params.status && order.status !== params.status) return false
      const date = order.createTime.slice(0, 10)
      if (params.startTime && date < params.startTime) return false
      if (params.endTime && date > params.endTime) return false
      return true
    })
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
    .map((order) => decorateShelfUp(db, order))
  return paginate(list, params)
}

/** 上架单详情 */
export async function fetchShelfUpDetail(id: string): Promise<Api.Warehouse.ShelfUpOrder> {
  await delay()
  const db = getDb()
  return decorateShelfUp(db, findShelfUp(db, currentTid(), id))
}

/** 新建上架单（草稿） */
export async function fetchCreateShelfUp(
  data: Partial<Api.Warehouse.ShelfUpOrder>
): Promise<Api.Warehouse.ShelfUpOrder> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()
  const store = db.warehouses.find((w) => w.id === data.storeId && w.tenantId === tenantId)
  if (!store) fail('请选择上架门店')

  const items = buildItems(db, tenantId, store.id, data.items ?? [])
  const order: Api.Warehouse.ShelfUpOrder = {
    id: genId('SJ'),
    shelfUpNo: genNo('SJ', nextSerial(db, 'SJ')),
    storeId: store.id,
    storeName: store.name,
    totalQuantity: qty(items.reduce((sum, item) => sum + item.quantity, 0)),
    status: 'draft',
    operatorName: data.operatorName || '当前用户',
    shelfUpUserName: '',
    shelfUpTime: '',
    remark: data.remark || '',
    createTime: formatDateTime(),
    items
  }
  db.shelfUps.push(order)
  persistDb()
  return order
}

/** 编辑上架单（仅草稿） */
export async function fetchUpdateShelfUp(
  id: string,
  data: Partial<Api.Warehouse.ShelfUpOrder>
): Promise<Api.Warehouse.ShelfUpOrder> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()
  const order = findShelfUp(db, tenantId, id)
  if (order.status !== 'draft') fail('仅草稿状态的上架单可以编辑')

  if (data.storeId && data.storeId !== order.storeId) {
    const store = db.warehouses.find((w) => w.id === data.storeId && w.tenantId === tenantId)
    if (!store) fail('上架门店不存在')
    order.storeId = store.id
    order.storeName = store.name
  }
  if (data.remark !== undefined) order.remark = data.remark
  if (data.items) {
    order.items = buildItems(db, tenantId, order.storeId, data.items)
    order.totalQuantity = qty(order.items.reduce((sum, item) => sum + item.quantity, 0))
  }
  persistDb()
  return decorateShelfUp(db, order)
}

/** 删除上架单（仅草稿） */
export async function fetchDeleteShelfUp(id: string): Promise<void> {
  await delay(150)
  const db = getDb()
  const order = findShelfUp(db, currentTid(), id)
  if (order.status !== 'draft') fail('仅草稿状态的上架单可以删除')
  db.shelfUps = db.shelfUps.filter((item) => item.id !== id)
  persistDb()
}

/** 确认上架（仓库减少、货架增加） */
export async function fetchConfirmShelfUp(id: string): Promise<void> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()
  const order = findShelfUp(db, tenantId, id)
  if (order.status === 'confirmed') return
  if (order.status !== 'draft') fail('仅草稿状态的上架单可以确认上架')
  if (!order.items.length) fail('上架单没有明细，无法确认上架')

  // 先整体校验仓库库存，避免部分明细已迁移
  order.items.forEach((item) => {
    const stock = currentStock(db, order.storeId, item.productId)
    if (stock.warehouseQuantity < item.quantity) {
      fail(
        `商品「${item.productName}」仓库库存不足（当前 ${stock.warehouseQuantity}${item.unit}，需上架 ${item.quantity}${item.unit}）`
      )
    }
  })

  order.items.forEach((item) => {
    reduceStock(
      db,
      tenantId,
      order.storeId,
      item.productId,
      item.quantity,
      `商品「${item.productName}」`
    )
    addShelfStock(db, tenantId, order.storeId, item.productId, item.quantity)
    const stock = currentStock(db, order.storeId, item.productId)
    item.warehouseQuantity = stock.warehouseQuantity
    item.shelfQuantity = stock.shelfQuantity
  })

  order.status = 'confirmed'
  order.shelfUpUserName = '当前用户'
  order.shelfUpTime = formatDateTime()
  persistDb()
}

/** 撤销上架（货架减少、仓库增加；货架已部分售出时不允许撤销） */
export async function fetchRollbackShelfUp(id: string): Promise<void> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()
  const order = findShelfUp(db, tenantId, id)
  if (order.status === 'rolled_back') return
  if (order.status !== 'confirmed') fail('仅已上架状态的上架单可以撤销')

  order.items.forEach((item) => {
    const stock = currentStock(db, order.storeId, item.productId)
    if (stock.shelfQuantity < item.quantity) {
      fail(
        `商品「${item.productName}」货架库存不足（当前 ${stock.shelfQuantity}${item.unit}，可能已部分售出），无法撤销上架`
      )
    }
  })

  order.items.forEach((item) => {
    reduceShelfStock(
      db,
      tenantId,
      order.storeId,
      item.productId,
      item.quantity,
      `商品「${item.productName}」`
    )
    addStock(db, tenantId, order.storeId, item.productId, item.quantity)
    const stock = currentStock(db, order.storeId, item.productId)
    item.warehouseQuantity = stock.warehouseQuantity
    item.shelfQuantity = stock.shelfQuantity
  })

  order.status = 'rolled_back'
  persistDb()
}
