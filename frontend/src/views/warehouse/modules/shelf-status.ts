/**
 * 仓库业务状态字典（上架单 / 库存预警）
 *
 * 与后端状态枚举一一对应（后端为数字，前端使用可读字符串）：
 * - 上架单：0 草稿 / 1 已上架 / 2 已撤销
 * - 库存预警：normal 正常 / warning 预警 / urgent 紧急 / out_of_stock 缺货
 */

export type WarehouseTagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

/** 上架单状态字典 */
export const SHELF_UP_STATUS: Record<
  Api.Warehouse.ShelfUpStatus,
  { text: string; type: WarehouseTagType }
> = {
  draft: { text: '草稿', type: 'info' },
  confirmed: { text: '已上架', type: 'success' },
  rolled_back: { text: '已撤销', type: 'info' }
}

/** 库存预警状态字典（warning 黄、urgent 橙、out_of_stock 红） */
export const STOCK_STATUS: Record<
  Api.Warehouse.StockStatus,
  { text: string; type: WarehouseTagType; style?: Record<string, string> }
> = {
  normal: { text: '正常', type: 'success' },
  warning: {
    text: '预警',
    type: 'warning',
    style: { color: '#b88230', backgroundColor: '#fdf6ec', borderColor: '#faecd8' }
  },
  urgent: {
    text: '紧急',
    type: 'warning',
    style: { color: '#d46b08', backgroundColor: '#fff7e6', borderColor: '#ffd591' }
  },
  out_of_stock: { text: '缺货', type: 'danger' }
}

/** 补货方式字典 */
export const REPLENISH_TYPE: Record<
  Api.Warehouse.ReplenishType,
  { text: string; description: string }
> = {
  shelf_up: { text: '可上架', description: '仓库有货，可直接上架' },
  in_transit: { text: '在途补货中', description: '仓库无货，在途有货等待收货' },
  purchase: { text: '需采购', description: '仓库与在途均无货，需要采购' }
}

/** 库存预警筛选下拉 */
export const WARN_LEVEL_OPTIONS = [
  { label: '全部', value: '' },
  { label: '预警', value: 'warning' },
  { label: '紧急', value: 'urgent' },
  { label: '缺货', value: 'out_of_stock' }
]

/** 预警状态严重程度：缺货 → 紧急 → 预警 → 正常 */
export const STOCK_STATUS_WEIGHT: Record<Api.Warehouse.StockStatus, number> = {
  out_of_stock: 0,
  urgent: 1,
  warning: 2,
  normal: 3
}

/** 建议上架数量：补到预警线，至少 1 */
export const suggestShelfUpQty = (item: Api.Warehouse.StockItem): number =>
  Math.max(1, Math.ceil((Number(item.warnThreshold) || 0) - (Number(item.shelfQuantity) || 0)))
