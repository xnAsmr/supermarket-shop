/**
 * 采购业务状态字典（采购订单 / 采购退货单）
 *
 * 与后端状态枚举一一对应（后端为数字，前端使用可读字符串）：
 * - 采购订单：0草稿 1待审核 2已审核 3部分收货 4已完成 5已取消 6部分退货 7已退货
 * - 采购退货单：0草稿 1待审核 2已审核（待退货）3已退货 4已作废
 */

export type PurchaseTagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'

/** 采购订单状态字典 */
export const PURCHASE_ORDER_STATUS: Record<
  Api.Purchase.PurchaseOrderStatus,
  { text: string; type: PurchaseTagType }
> = {
  draft: { text: '草稿', type: 'info' },
  pending_review: { text: '待审核', type: 'warning' },
  approved: { text: '已审核', type: 'primary' },
  partially_received: { text: '部分收货', type: 'warning' },
  completed: { text: '已完成', type: 'success' },
  canceled: { text: '已取消', type: 'info' },
  partially_returned: { text: '部分退货', type: 'warning' },
  returned: { text: '已退货', type: 'danger' }
}

/** 采购退货单状态字典 */
export const PURCHASE_RETURN_STATUS: Record<
  Api.Purchase.PurchaseReturnStatus,
  { text: string; type: PurchaseTagType }
> = {
  draft: { text: '草稿', type: 'info' },
  pending_review: { text: '待审核', type: 'warning' },
  reviewed: { text: '已审核', type: 'primary' },
  returned: { text: '已退货', type: 'success' },
  voided: { text: '已作废', type: 'info' }
}

/** 金额格式化 */
export const formatMoney = (value: number | undefined): string =>
  `¥ ${(Number(value ?? 0) || 0).toFixed(2)}`
