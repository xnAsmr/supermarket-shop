/**
 * 库存派生字段工具（仓库 / 货架 / 在途三层库存）
 *
 * - 库存行以 warehouseId + productId 定位
 * - `warehouseQuantity` 为仓库可上架库存，`shelfQuantity` 为货架可售库存
 * - 兼容旧字段：`quantity` 恒等于仓库库存，`safetyStock` 恒等于预警线
 */
import { money } from './helpers'

/** 缺省预警线（旧数据无阈值时兜底） */
export const DEFAULT_WARN_THRESHOLD = 10

/** 紧急线缺省值：预警线的 1/3（至少 1） */
export function defaultUrgentThreshold(warnThreshold: number): number {
  const warn = Number(warnThreshold) || 0
  return Math.max(1, Math.floor(warn / 3))
}

/** 仓库库存（兼容旧字段 quantity） */
export function warehouseQtyOf(row: Api.Warehouse.StockItem): number {
  return Number(row.warehouseQuantity ?? row.quantity ?? 0) || 0
}

/** 货架库存 */
export function shelfQtyOf(row: Api.Warehouse.StockItem): number {
  return Number(row.shelfQuantity ?? 0) || 0
}

/** 仓库 + 货架 */
export function totalQtyOf(row: Api.Warehouse.StockItem): number {
  return warehouseQtyOf(row) + shelfQtyOf(row)
}

/** 按货架库存与阈值计算预警状态 */
export function resolveStockStatus(
  shelfQuantity: number,
  warnThreshold: number,
  urgentThreshold: number
): Api.Warehouse.StockStatus {
  const shelf = Number(shelfQuantity) || 0
  const urgent = Number(urgentThreshold) || 0
  const warn = Number(warnThreshold) || 0
  // 未配置阈值视为不参与预警（如中央仓，仅用于备货不直接销售）
  if (warn <= 0 && urgent <= 0) return 'normal'
  if (shelf <= 0) return 'out_of_stock'
  if (urgent > 0 && shelf <= urgent) return 'urgent'
  if (warn > 0 && shelf <= warn) return 'warning'
  return 'normal'
}

/** 按仓库 / 在途库存推导补货方式（仅预警时有意义） */
export function resolveReplenishType(
  warehouseQuantity: number,
  pendingInQuantity: number
): Api.Warehouse.ReplenishType {
  if ((Number(warehouseQuantity) || 0) > 0) return 'shelf_up'
  if ((Number(pendingInQuantity) || 0) > 0) return 'in_transit'
  return 'purchase'
}

/** 重新计算库存行派生字段（不修改更新时间） */
export function syncStockDerived(row: Api.Warehouse.StockItem): void {
  const warehouseQuantity = warehouseQtyOf(row)
  const shelfQuantity = shelfQtyOf(row)
  const pendingInQuantity = Number(row.pendingInQuantity ?? 0) || 0
  const warnThreshold = Number(row.warnThreshold ?? row.safetyStock ?? DEFAULT_WARN_THRESHOLD) || 0
  const urgentThreshold = Number(
    row.urgentThreshold ?? defaultUrgentThreshold(warnThreshold)
  ) as number

  row.warehouseQuantity = warehouseQuantity
  row.shelfQuantity = shelfQuantity
  row.pendingInQuantity = pendingInQuantity
  row.totalQuantity = warehouseQuantity + shelfQuantity
  row.warnThreshold = warnThreshold
  row.urgentThreshold = urgentThreshold
  row.thresholdOverridden = Boolean(row.thresholdOverridden)
  row.stockStatus = resolveStockStatus(shelfQuantity, warnThreshold, urgentThreshold)
  row.replenishType =
    row.stockStatus === 'normal'
      ? undefined
      : resolveReplenishType(warehouseQuantity, pendingInQuantity)
  // 兼容旧字段
  row.quantity = warehouseQuantity
  row.safetyStock = warnThreshold
  row.stockValue = money((warehouseQuantity + shelfQuantity) * (Number(row.purchasePrice) || 0))
  row.warning = row.stockStatus !== 'normal'
}

/**
 * 兼容老版本本地库存数据
 *
 * 旧数据只有 `quantity`（总库存），升级后拆分为仓库 + 货架：
 * 默认把 40% 库存放到货架，保证收银台可直接销售。
 */
export function normalizeStockRow(row: Api.Warehouse.StockItem): void {
  if (row.warehouseQuantity == null && row.shelfQuantity == null) {
    const total = Number(row.quantity) || 0
    row.shelfQuantity = total > 0 ? Math.min(total, Math.max(1, Math.round(total * 0.4))) : 0
    row.warehouseQuantity = Math.max(0, total - row.shelfQuantity)
  } else {
    row.warehouseQuantity = Number(row.warehouseQuantity ?? 0) || 0
    row.shelfQuantity = Number(row.shelfQuantity ?? 0) || 0
  }
  row.pendingInQuantity = Number(row.pendingInQuantity ?? 0) || 0
  row.warnThreshold = Number(
    row.warnThreshold ?? row.safetyStock ?? DEFAULT_WARN_THRESHOLD
  ) as number
  row.urgentThreshold = Number(
    row.urgentThreshold ?? defaultUrgentThreshold(row.warnThreshold)
  ) as number
  row.thresholdOverridden = Boolean(row.thresholdOverridden)
  syncStockDerived(row)
}
