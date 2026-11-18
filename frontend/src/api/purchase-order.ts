/**
 * 采购业务 API（采购订单 / 采购退货单）
 *
 * 对应后端接口：
 * - /api/v1/purchase-orders   采购订单（收货入库：POST /{id}/receive）
 * - /api/v1/purchase-returns  采购退货单
 *
 * 后端状态为数字枚举，本层统一转换为可读字符串状态；
 * 后端分页为 PageResult（list/total/page/pageSize），本层转换为前端分页结构。
 */
import * as purchaseOrderService from '@/mock/service/purchase-order.service'
import type { BackendPageResult } from '@/types/common/response'
import { api, callWithFallback, toBackendPage, toPaginated } from './core/backend'

/* ------------------------------ 后端数据结构 ------------------------------ */

/** 后端采购订单明细（PurchaseOrderItemVO） */
interface BackendOrderItemVO {
  id?: number
  productId?: number
  productName?: string
  barcode?: string
  spec?: string
  unit?: string
  orderedQty?: number
  receivedQty?: number
  returnedQty?: number
  purchasePrice?: number
  totalPrice?: number
  remark?: string
}

/** 后端采购订单（PurchaseOrderVO） */
interface BackendOrderVO {
  id?: number
  orderNo?: string
  supplierId?: number
  supplierName?: string
  storeId?: number
  storeName?: string
  totalAmount?: number
  totalOrderedQty?: number
  totalReceivedQty?: number
  totalReturnedQty?: number
  status?: number
  operatorName?: string
  reviewerName?: string
  reviewTime?: string
  reviewRemark?: string
  finishTime?: string
  remark?: string
  createTime?: string
  items?: BackendOrderItemVO[]
}

/** 后端采购退货单明细（PurchaseReturnItemVO） */
interface BackendReturnItemVO {
  id?: number
  orderItemId?: number
  receiptItemId?: number
  productId?: number
  productName?: string
  barcode?: string
  spec?: string
  unit?: string
  quantity?: number
  purchasePrice?: number
  totalPrice?: number
}

/** 后端采购退货单（PurchaseReturnVO） */
interface BackendReturnVO {
  id?: number
  returnNo?: string
  orderId?: number
  orderNo?: string
  receiptId?: number
  receiptNo?: string
  supplierId?: number
  supplierName?: string
  storeId?: number
  storeName?: string
  totalAmount?: number
  totalQuantity?: number
  status?: number
  operatorName?: string
  reviewerName?: string
  reviewTime?: string
  reviewRemark?: string
  returnTime?: string
  reason?: string
  remark?: string
  createTime?: string
  items?: BackendReturnItemVO[]
}

/* ------------------------------ 常量与工具 ------------------------------ */

/** 采购订单状态：后端数字 → 前端字符串 */
const ORDER_STATUS: Record<number, Api.Purchase.PurchaseOrderStatus> = {
  0: 'draft',
  1: 'pending_review',
  2: 'approved',
  3: 'partially_received',
  4: 'completed',
  5: 'canceled',
  6: 'partially_returned',
  7: 'returned'
}

/** 采购退货单状态：后端数字 → 前端字符串 */
const RETURN_STATUS: Record<number, Api.Purchase.PurchaseReturnStatus> = {
  0: 'draft',
  1: 'pending_review',
  2: 'reviewed',
  3: 'returned',
  4: 'voided'
}

/** 前端状态 → 后端数字 */
const toBackendOrderStatus = (status?: Api.Purchase.PurchaseOrderStatus): number | undefined => {
  if (!status) return undefined
  const entry = Object.entries(ORDER_STATUS).find(([, value]) => value === status)
  return entry ? Number(entry[0]) : undefined
}

const toBackendReturnStatus = (status?: Api.Purchase.PurchaseReturnStatus): number | undefined => {
  if (!status) return undefined
  const entry = Object.entries(RETURN_STATUS).find(([, value]) => value === status)
  return entry ? Number(entry[0]) : undefined
}

/** 金额保留两位小数 */
const money = (n?: number): number => Math.round((Number(n ?? 0) || 0) * 100) / 100

/** 数量保留两位小数 */
const qty = (n?: number): number => Math.round((Number(n ?? 0) || 0) * 100) / 100

/** 后端时间（ISO）→ YYYY-MM-DD HH:mm:ss */
const fmtTime = (time?: string): string => (time ? time.replace('T', ' ').slice(0, 19) : '')

/** 前端日期 → 后端日期时间 */
const toBackendDateTime = (value: string | undefined, endOfDay: boolean): string | undefined => {
  if (!value) return undefined
  if (value.length > 10) return value
  return `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`
}

/* ------------------------------ 映射函数 ------------------------------ */

/** 后端采购订单明细 → 前端采购订单明细 */
const toOrderItem = (it: BackendOrderItemVO): Api.Purchase.PurchaseOrderItem => ({
  id: String(it.id ?? ''),
  productId: String(it.productId ?? ''),
  productName: it.productName ?? '',
  barcode: it.barcode ?? '',
  spec: it.spec ?? '',
  unit: it.unit ?? '',
  orderedQty: qty(it.orderedQty),
  receivedQty: qty(it.receivedQty),
  returnedQty: qty(it.returnedQty),
  purchasePrice: money(it.purchasePrice),
  totalPrice: money(it.totalPrice),
  remark: it.remark ?? ''
})

/** 后端 PurchaseOrderVO → 前端采购订单 */
const toOrder = (vo: BackendOrderVO): Api.Purchase.PurchaseOrderDetail => ({
  id: String(vo.id ?? ''),
  tenantId: '',
  orderNo: vo.orderNo ?? '',
  supplierId: String(vo.supplierId ?? ''),
  supplierName: vo.supplierName ?? '',
  storeId: String(vo.storeId ?? ''),
  storeName: vo.storeName ?? '',
  totalAmount: money(vo.totalAmount),
  totalOrderedQty: qty(vo.totalOrderedQty),
  totalReceivedQty: qty(vo.totalReceivedQty),
  totalReturnedQty: qty(vo.totalReturnedQty),
  status: ORDER_STATUS[vo.status ?? 0] ?? 'draft',
  operatorName: vo.operatorName ?? '',
  reviewerName: vo.reviewerName ?? '',
  reviewTime: fmtTime(vo.reviewTime),
  reviewRemark: vo.reviewRemark ?? '',
  finishTime: fmtTime(vo.finishTime),
  remark: vo.remark ?? '',
  createTime: fmtTime(vo.createTime),
  items: (vo.items ?? []).map(toOrderItem)
})

/** 后端采购退货单明细 → 前端采购退货单明细 */
const toReturnItem = (it: BackendReturnItemVO): Api.Purchase.PurchaseReturnItem => ({
  id: String(it.id ?? ''),
  orderItemId: String(it.orderItemId ?? ''),
  receiptItemId: String(it.receiptItemId ?? ''),
  productId: String(it.productId ?? ''),
  productName: it.productName ?? '',
  barcode: it.barcode ?? '',
  spec: it.spec ?? '',
  unit: it.unit ?? '',
  quantity: qty(it.quantity),
  purchasePrice: money(it.purchasePrice),
  totalPrice: money(it.totalPrice)
})

/** 后端 PurchaseReturnVO → 前端采购退货单 */
const toReturn = (vo: BackendReturnVO): Api.Purchase.PurchaseReturn => ({
  id: String(vo.id ?? ''),
  tenantId: '',
  returnNo: vo.returnNo ?? '',
  orderId: String(vo.orderId ?? ''),
  orderNo: vo.orderNo ?? '',
  receiptId: String(vo.receiptId ?? ''),
  receiptNo: vo.receiptNo ?? '',
  supplierId: String(vo.supplierId ?? ''),
  supplierName: vo.supplierName ?? '',
  storeId: String(vo.storeId ?? ''),
  storeName: vo.storeName ?? '',
  totalAmount: money(vo.totalAmount),
  totalQuantity: qty(vo.totalQuantity),
  status: RETURN_STATUS[vo.status ?? 0] ?? 'draft',
  operatorName: vo.operatorName ?? '',
  reviewerName: vo.reviewerName ?? '',
  reviewTime: fmtTime(vo.reviewTime),
  reviewRemark: vo.reviewRemark ?? '',
  returnTime: fmtTime(vo.returnTime),
  reason: vo.reason ?? '',
  remark: vo.remark ?? '',
  createTime: fmtTime(vo.createTime),
  items: (vo.items ?? []).map(toReturnItem)
})

/* ------------------------------ 采购订单 ------------------------------ */

/** 采购订单列表 */
export function fetchGetPurchaseOrderList(
  params: Api.Purchase.PurchaseOrderSearchParams
): Promise<Api.Purchase.PurchaseOrderList> {
  return callWithFallback(
    () =>
      api
        .get<BackendPageResult<BackendOrderVO>>({
          url: '/api/v1/purchase-orders',
          params: {
            ...toBackendPage(params),
            keyword: params.orderNo?.trim() || undefined,
            orderNo: params.orderNo?.trim() || undefined,
            supplierId: params.supplierId ? Number(params.supplierId) : undefined,
            storeId: params.storeId ? Number(params.storeId) : undefined,
            status: toBackendOrderStatus(params.status),
            startDate: toBackendDateTime(params.startTime, false),
            endDate: toBackendDateTime(params.endTime, true)
          }
        })
        .then((page) => toPaginated(page, toOrder)),
    () => purchaseOrderService.fetchPurchaseOrderList(params)
  )
}

/** 采购订单详情 */
export function fetchGetPurchaseOrderDetail(id: string): Promise<Api.Purchase.PurchaseOrderDetail> {
  return callWithFallback(
    () => api.get<BackendOrderVO>({ url: `/api/v1/purchase-orders/${id}` }).then(toOrder),
    () => purchaseOrderService.fetchPurchaseOrderDetail(id)
  )
}

/** 新建采购订单（草稿） */
export function fetchCreatePurchaseOrder(
  data: Partial<Api.Purchase.PurchaseOrderDetail>
): Promise<Api.Purchase.PurchaseOrderDetail> {
  return callWithFallback(
    () => {
      const dto = {
        supplierId: Number(data.supplierId),
        storeId: Number(data.storeId),
        remark: data.remark ?? '',
        items: (data.items ?? [])
          .filter((it) => qty(it.orderedQty) > 0)
          .map((it) => ({
            productId: Number(it.productId),
            orderedQty: qty(it.orderedQty),
            purchasePrice: money(it.purchasePrice),
            remark: it.remark ?? ''
          }))
      }
      return api
        .post<number>({ url: '/api/v1/purchase-orders', data: dto })
        .then((id) => api.get<BackendOrderVO>({ url: `/api/v1/purchase-orders/${id}` }))
        .then(toOrder)
    },
    () => purchaseOrderService.fetchCreatePurchaseOrder(data)
  )
}

/** 编辑采购订单（仅草稿） */
export function fetchUpdatePurchaseOrder(
  id: string,
  data: Partial<Api.Purchase.PurchaseOrderDetail>
): Promise<Api.Purchase.PurchaseOrderDetail> {
  return callWithFallback(
    () => {
      const dto = {
        supplierId: Number(data.supplierId),
        storeId: Number(data.storeId),
        remark: data.remark ?? '',
        items: (data.items ?? [])
          .filter((it) => qty(it.orderedQty) > 0)
          .map((it) => ({
            productId: Number(it.productId),
            orderedQty: qty(it.orderedQty),
            purchasePrice: money(it.purchasePrice),
            remark: it.remark ?? ''
          }))
      }
      return api
        .put<void>({ url: `/api/v1/purchase-orders/${id}`, data: dto })
        .then(() => api.get<BackendOrderVO>({ url: `/api/v1/purchase-orders/${id}` }))
        .then(toOrder)
    },
    () => purchaseOrderService.fetchUpdatePurchaseOrder(id, data)
  )
}

/** 删除采购订单（仅草稿） */
export function fetchDeletePurchaseOrder(id: string): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/purchase-orders/${id}` }),
    () => purchaseOrderService.fetchDeletePurchaseOrder(id)
  )
}

/** 提交采购订单审核 */
export function fetchSubmitPurchaseOrder(id: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/purchase-orders/${id}/submit` }),
    () => purchaseOrderService.fetchSubmitPurchaseOrder(id)
  )
}

/** 审核通过采购订单 */
export function fetchReviewPurchaseOrder(id: string, remark?: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/purchase-orders/${id}/review`, data: { remark } }),
    () => purchaseOrderService.fetchReviewPurchaseOrder(id, remark)
  )
}

/** 撤销采购订单审核 */
export function fetchRevokePurchaseOrderReview(id: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/purchase-orders/${id}/revoke-review` }),
    () => purchaseOrderService.fetchRevokePurchaseOrderReview(id)
  )
}

/** 取消采购订单 */
export function fetchCancelPurchaseOrder(id: string, remark?: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/purchase-orders/${id}/cancel`, data: { remark } }),
    () => purchaseOrderService.fetchCancelPurchaseOrder(id, remark)
  )
}

/** 可收货明细（orderedQty - receivedQty > 0） */
export function fetchGetReceivableItems(id: string): Promise<Api.Purchase.PurchaseOrderItem[]> {
  return callWithFallback(
    () =>
      api
        .get<BackendOrderItemVO[]>({ url: `/api/v1/purchase-orders/${id}/receivable-items` })
        .then((list) => (list ?? []).map(toOrderItem)),
    () => purchaseOrderService.fetchGetReceivableItems(id)
  )
}

/** 收货入库（确认本次收货数量，直接加库存并生成入库单，支持部分收货） */
export function fetchReceivePurchaseOrder(
  id: string,
  data: { items: { orderItemId: string; quantity: number; batchNo?: string }[] }
): Promise<void> {
  return callWithFallback(
    () =>
      api
        .post<number>({
          url: `/api/v1/purchase-orders/${id}/receive`,
          data: {
            items: data.items.map((it) => ({
              orderItemId: Number(it.orderItemId),
              quantity: it.quantity,
              batchNo: it.batchNo?.trim() || undefined
            }))
          }
        })
        .then(() => undefined),
    () => purchaseOrderService.fetchReceivePurchaseOrder(id, data)
  )
}

/* ------------------------------ 采购退货单 ------------------------------ */

/** 采购退货单列表 */
export function fetchGetPurchaseReturnList(
  params: Api.Purchase.PurchaseReturnSearchParams
): Promise<Api.Purchase.PurchaseReturnList> {
  return callWithFallback(
    () =>
      api
        .get<BackendPageResult<BackendReturnVO>>({
          url: '/api/v1/purchase-returns',
          params: {
            ...toBackendPage(params),
            keyword: params.returnNo?.trim() || undefined,
            returnNo: params.returnNo?.trim() || undefined,
            orderNo: params.orderNo?.trim() || undefined,
            receiptNo: params.receiptNo?.trim() || undefined,
            supplierId: params.supplierId ? Number(params.supplierId) : undefined,
            storeId: params.storeId ? Number(params.storeId) : undefined,
            status: toBackendReturnStatus(params.status),
            startDate: toBackendDateTime(params.startTime, false),
            endDate: toBackendDateTime(params.endTime, true)
          }
        })
        .then((page) => toPaginated(page, toReturn)),
    () => purchaseOrderService.fetchPurchaseReturnList(params)
  )
}

/** 采购退货单详情 */
export function fetchGetPurchaseReturnDetail(id: string): Promise<Api.Purchase.PurchaseReturn> {
  return callWithFallback(
    () => api.get<BackendReturnVO>({ url: `/api/v1/purchase-returns/${id}` }).then(toReturn),
    () => purchaseOrderService.fetchPurchaseReturnDetail(id)
  )
}

/** 新建采购退货单（可带 orderId / receiptId） */
export function fetchCreatePurchaseReturn(
  data: Partial<Api.Purchase.PurchaseReturn>
): Promise<Api.Purchase.PurchaseReturn> {
  return callWithFallback(
    () => {
      const dto = {
        orderId: data.orderId ? Number(data.orderId) : undefined,
        receiptId: data.receiptId ? Number(data.receiptId) : undefined,
        supplierId: data.supplierId ? Number(data.supplierId) : undefined,
        storeId: Number(data.storeId),
        reason: data.reason ?? '',
        remark: data.remark ?? '',
        items: (data.items ?? [])
          .filter((it) => qty(it.quantity) > 0)
          .map((it) => ({
            productId: Number(it.productId),
            // 必须带 orderItemId：后端据此回写采购订单明细的已退数量
            orderItemId: it.orderItemId ? Number(it.orderItemId) : undefined,
            receiptItemId: it.receiptItemId ? Number(it.receiptItemId) : undefined,
            quantity: qty(it.quantity),
            purchasePrice: money(it.purchasePrice)
          }))
      }
      return api
        .post<number>({ url: '/api/v1/purchase-returns', data: dto })
        .then((id) => api.get<BackendReturnVO>({ url: `/api/v1/purchase-returns/${id}` }))
        .then(toReturn)
    },
    () => purchaseOrderService.fetchCreatePurchaseReturn(data)
  )
}

/** 编辑采购退货单（仅草稿） */
export function fetchUpdatePurchaseReturn(
  id: string,
  data: Partial<Api.Purchase.PurchaseReturn>
): Promise<Api.Purchase.PurchaseReturn> {
  return callWithFallback(
    () => {
      const dto = {
        orderId: data.orderId ? Number(data.orderId) : undefined,
        receiptId: data.receiptId ? Number(data.receiptId) : undefined,
        supplierId: data.supplierId ? Number(data.supplierId) : undefined,
        storeId: Number(data.storeId),
        reason: data.reason ?? '',
        remark: data.remark ?? '',
        items: (data.items ?? [])
          .filter((it) => qty(it.quantity) > 0)
          .map((it) => ({
            productId: Number(it.productId),
            orderItemId: it.orderItemId ? Number(it.orderItemId) : undefined,
            receiptItemId: it.receiptItemId ? Number(it.receiptItemId) : undefined,
            quantity: qty(it.quantity),
            purchasePrice: money(it.purchasePrice)
          }))
      }
      return api
        .put<void>({ url: `/api/v1/purchase-returns/${id}`, data: dto })
        .then(() => api.get<BackendReturnVO>({ url: `/api/v1/purchase-returns/${id}` }))
        .then(toReturn)
    },
    () => purchaseOrderService.fetchUpdatePurchaseReturn(id, data)
  )
}

/** 删除采购退货单（仅草稿） */
export function fetchDeletePurchaseReturn(id: string): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/purchase-returns/${id}` }),
    () => purchaseOrderService.fetchDeletePurchaseReturn(id)
  )
}

/** 提交采购退货单审核 */
export function fetchSubmitPurchaseReturn(id: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/purchase-returns/${id}/submit` }),
    () => purchaseOrderService.fetchSubmitPurchaseReturn(id)
  )
}

/** 审核通过采购退货单 */
export function fetchReviewPurchaseReturn(id: string, remark?: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/purchase-returns/${id}/review`, data: { remark } }),
    () => purchaseOrderService.fetchReviewPurchaseReturn(id, remark)
  )
}

/** 采购退货单确认生效 */
export function fetchConfirmPurchaseReturn(id: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/purchase-returns/${id}/confirm` }),
    () => purchaseOrderService.fetchConfirmPurchaseReturn(id)
  )
}

/** 作废采购退货单（已退货可恢复库存） */
export function fetchCancelPurchaseReturn(id: string, remark?: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/purchase-returns/${id}/cancel`, data: { remark } }),
    () => purchaseOrderService.fetchCancelPurchaseReturn(id, remark)
  )
}

/** 可退明细（receivedQty - returnedQty > 0） */
export function fetchGetReturnableItems(id: string): Promise<Api.Purchase.PurchaseOrderItem[]> {
  return callWithFallback(
    () =>
      api
        .get<BackendOrderItemVO[]>({ url: `/api/v1/purchase-orders/${id}/returnable-items` })
        .then((list) => (list ?? []).map(toOrderItem)),
    () => purchaseOrderService.fetchGetReturnableItems(id)
  )
}
