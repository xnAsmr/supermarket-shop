/**
 * 业务副作用工具：库存变更 + 财务流水（供采购/收银/退货/单据等服务复用）
 */
import type { MockDatabase } from './db'
import { nextSerial } from './db'
import { formatDateTime, genId, genNo, money } from './helpers'
import {
  defaultUrgentThreshold,
  shelfQtyOf,
  syncStockDerived,
  totalQtyOf,
  warehouseQtyOf
} from './inventory'
import { fail } from './result'

/** 同步库存行派生字段 */
export function syncStockRow(row: Api.Warehouse.StockItem): void {
  syncStockDerived(row)
  row.updateTime = formatDateTime()
}

/** 获取或创建库存行 */
export function ensureStockRow(
  db: MockDatabase,
  tenantId: string,
  warehouseId: string,
  productId: string
): Api.Warehouse.StockItem {
  const warehouse = db.warehouses.find((w) => w.id === warehouseId && w.tenantId === tenantId)
  if (!warehouse) fail('仓库不存在，请刷新后重试')

  let row = db.stocks.find((s) => s.warehouseId === warehouseId && s.productId === productId)
  if (row) return row

  const product = db.products.find((p) => p.id === productId)
  if (!product) fail('商品不存在，请刷新后重试')

  const warnThreshold = product.warningStock
  row = {
    id: genId('K'),
    tenantId,
    warehouseId,
    warehouseName: warehouse.name,
    productId,
    barcode: product.barcode,
    productName: product.name,
    categoryId: product.categoryId,
    unit: product.unit,
    warehouseQuantity: 0,
    shelfQuantity: 0,
    pendingInQuantity: 0,
    totalQuantity: 0,
    warnThreshold,
    urgentThreshold: defaultUrgentThreshold(warnThreshold),
    thresholdOverridden: false,
    stockStatus: 'out_of_stock',
    replenishType: 'purchase',
    quantity: 0,
    safetyStock: warnThreshold,
    purchasePrice: product.purchasePrice,
    salePrice: product.salePrice,
    stockValue: 0,
    warning: true,
    updateTime: formatDateTime()
  }
  syncStockRow(row)
  db.stocks.push(row)
  return row
}

/** 同步商品表冗余库存字段（仓库 + 货架） */
export function syncProductStock(db: MockDatabase, productId: string): void {
  const product = db.products.find((p) => p.id === productId)
  if (!product) return
  product.stock = db.stocks
    .filter((s) => s.productId === productId)
    .reduce((sum, s) => sum + totalQtyOf(s), 0)
}

/** 增加仓库库存（入库/退货回库） */
export function addStock(
  db: MockDatabase,
  tenantId: string,
  warehouseId: string,
  productId: string,
  quantity: number
): void {
  if (quantity <= 0) return
  const row = ensureStockRow(db, tenantId, warehouseId, productId)
  row.warehouseQuantity = warehouseQtyOf(row) + quantity
  syncStockRow(row)
  syncProductStock(db, productId)
}

/** 扣减仓库库存（出库/调拨），库存不足时抛出业务错误 */
export function reduceStock(
  db: MockDatabase,
  tenantId: string,
  warehouseId: string,
  productId: string,
  quantity: number,
  label = '该商品'
): void {
  if (quantity <= 0) return
  const row = db.stocks.find((s) => s.warehouseId === warehouseId && s.productId === productId)
  if (!row) fail(`${label}在所选仓库无库存，无法继续`)
  const available = warehouseQtyOf(row)
  if (available < quantity) {
    fail(`${label}仓库库存不足（剩余 ${available}${row.unit}）`)
  }
  row.warehouseQuantity = available - quantity
  syncStockRow(row)
  syncProductStock(db, productId)
}

/** 增加货架库存（上架） */
export function addShelfStock(
  db: MockDatabase,
  tenantId: string,
  warehouseId: string,
  productId: string,
  quantity: number
): void {
  if (quantity <= 0) return
  const row = ensureStockRow(db, tenantId, warehouseId, productId)
  row.shelfQuantity = shelfQtyOf(row) + quantity
  syncStockRow(row)
  syncProductStock(db, productId)
}

/** 扣减货架库存（撤销上架 / POS 销售），库存不足时抛出业务错误 */
export function reduceShelfStock(
  db: MockDatabase,
  tenantId: string,
  warehouseId: string,
  productId: string,
  quantity: number,
  label = '该商品'
): void {
  if (quantity <= 0) return
  const row = db.stocks.find((s) => s.warehouseId === warehouseId && s.productId === productId)
  if (!row) fail(`${label}在所选仓库无货架库存，无法继续`)
  const available = shelfQtyOf(row)
  if (available < quantity) {
    fail(`${label}货架库存不足（剩余 ${available}${row.unit}）`)
  }
  row.shelfQuantity = available - quantity
  syncStockRow(row)
  syncProductStock(db, productId)
}

const FLOW_PREFIX: Record<string, string> = {
  销售收款: 'XF',
  采购付款: 'CG',
  销售退款: 'TK'
}

export interface FlowInput {
  tenantId: string
  type: Api.Finance.FlowType
  category: string
  amount: number
  method?: string
  relatedNo?: string
  operator?: string
  remark?: string
  createTime?: string
}

/** 写入一条财务流水 */
export function pushFlow(db: MockDatabase, input: FlowInput): Api.Finance.FlowItem {
  const prefix = FLOW_PREFIX[input.category] ?? 'ZC'
  const flow: Api.Finance.FlowItem = {
    id: genId('F'),
    tenantId: input.tenantId,
    flowNo: genNo(prefix, nextSerial(db, prefix)),
    type: input.type,
    category: input.category,
    amount: money(input.amount),
    method: input.method || '现金',
    relatedNo: input.relatedNo || '',
    operator: input.operator || '当前用户',
    createTime: input.createTime || formatDateTime(),
    remark: input.remark || ''
  }
  db.flows.push(flow)
  return flow
}
