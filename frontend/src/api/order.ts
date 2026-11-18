import * as orderService from '@/mock/service/order.service'
import type { CreateReturnPayload } from '@/mock/service/order.service'
import type { BackendPageResult } from '@/types/common/response'
import { api, callWithFallback, toPaginated, toBackendPage } from './core/backend'

/** 后端订单明细（OrderItemVO） */
interface BackendOrderItemVO {
  productId?: number
  productName?: string
  barcode?: string
  unit?: string
  quantity?: number
  salePrice?: number
  totalPrice?: number
  /** 已退数量（后端新增字段，支持部分退货） */
  refundedQty?: number
}

/** 后端订单（OrderVO） */
interface BackendOrderVO {
  id?: number
  orderNo?: string
  memberName?: string
  totalAmount?: number
  discountAmount?: number
  payAmount?: number
  payMethod?: string
  payStatus?: number
  orderStatus?: number
  totalQuantity?: number
  cashierName?: string
  storeId?: number
  storeName?: string
  remark?: string
  cancelReason?: string
  cancelTime?: string
  restoreTime?: string
  createTime?: string
  items?: BackendOrderItemVO[]
}

/** 后端订单查询参数（OrderQueryDTO） */
interface BackendOrderQuery {
  keyword?: string
  orderStatus?: number
  orderStatuses?: number[]
  payStatus?: number
  operatorId?: number
  startDate?: string
  endDate?: string
  page: number
  pageSize: number
}

/** 后端退货单（RefundVO） */
interface BackendRefundVO {
  id?: number
  refundNo?: string
  orderId?: number
  orderNo?: string
  refundAmount?: number
  /** 退款方式：1-现金 2-原路退回 */
  refundMethod?: number
  refundMethodName?: string
  refundReason?: string
  status?: number
  operatorName?: string
  createTime?: string
  items?: Array<{
    productId?: number
    productName?: string
    barcode?: string
    unit?: string
    quantity?: number
    salePrice?: number
    totalPrice?: number
  }>
}

/** 后端支付方式编码 → 前端支付方式（stored 储值卡 / combined 组合支付 前端类型无对应值，按无法识别处理） */
const PAY_METHOD_MAP: Record<string, Api.Order.PayMethod> = {
  cash: 'cash',
  wechat: 'wechat',
  alipay: 'alipay',
  card: 'bank',
  stored: 'stored'
}

/**
 * 后端订单状态数字枚举 → 前端状态字符串
 * 后端 order_status：0 待支付 / 1 已支付 / 2 已完成 / 3 已取消 / 4 已退款
 * 配合 pay_status：0 未支付 / 1 已支付 / 2 部分退款 / 3 全额退款
 */
const toStatus = (orderStatus?: number, payStatus?: number): Api.Order.OrderStatus => {
  if (orderStatus === 3) return 'cancelled'
  if (orderStatus === 4 || payStatus === 3) return 'refunded'
  if (payStatus === 2) return 'partial_refund'
  return 'paid'
}

/** 支付方式编码 + 实收金额 → 前端支付记录（组合支付/储值卡等无法拆分时返回空数组） */
const toPayments = (payMethod?: string, payAmount?: number): Api.Order.PaymentRecord[] => {
  const method = payMethod ? PAY_METHOD_MAP[payMethod] : undefined
  if (!method) return []
  return [{ method, amount: Number(payAmount ?? 0) }]
}

/** 金额保留两位小数 */
const money = (n?: number): number => Math.round((Number(n ?? 0) || 0) * 100) / 100

/** 后端订单明细 → 前端订单明细 */
const toItem = (it: BackendOrderItemVO): Api.Order.OrderItem => ({
  productId: String(it.productId ?? ''),
  barcode: it.barcode ?? '',
  name: it.productName ?? '',
  unit: it.unit ?? '',
  price: money(it.salePrice),
  quantity: Number(it.quantity ?? 0),
  amount: money(it.totalPrice),
  refundedQty: Number(it.refundedQty ?? 0)
})

/** 后端 OrderVO → 前端销售订单 */
const toSalesOrder = (vo: BackendOrderVO): Api.Order.SalesOrder => {
  const items = (vo.items ?? []).map(toItem)
  return {
    id: String(vo.id ?? ''),
    tenantId: '',
    orderNo: vo.orderNo ?? '',
    source: 'pos',
    warehouseId: vo.storeId != null ? String(vo.storeId) : '',
    warehouseName: vo.storeName ?? '',
    items,
    quantity: Number(vo.totalQuantity ?? 0) || items.reduce((sum, it) => sum + it.quantity, 0),
    totalAmount: money(vo.totalAmount),
    discountAmount: money(vo.discountAmount),
    payAmount: money(vo.payAmount),
    payments: toPayments(vo.payMethod, vo.payAmount),
    status: toStatus(vo.orderStatus, vo.payStatus),
    memberName: vo.memberName ?? '',
    cashier: vo.cashierName ?? '',
    createTime: vo.createTime ?? '',
    remark: vo.remark ?? '',
    cancelReason: vo.cancelReason || undefined,
    cancelTime: vo.cancelTime || undefined,
    restoreTime: vo.restoreTime || undefined
  }
}

/** 前端日期（yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss）→ 后端日期时间（yyyy-MM-dd HH:mm:ss） */
const toBackendDateTime = (value: string | undefined, endOfDay: boolean): string | undefined => {
  if (!value) return undefined
  if (value.length > 10) return value
  return `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`
}

/** 前端订单状态 → 后端 order_status 编码 */
const BACKEND_ORDER_STATUS: Record<Api.Order.OrderStatus, number> = {
  paid: 1,
  partial_refund: 1,
  refunded: 4,
  cancelled: 3
}

/** 前端退货状态 → 后端 status 编码 */
const BACKEND_RETURN_STATUS: Record<Api.Order.ReturnStatus, number> = {
  pending: 0,
  completed: 1,
  rejected: 2,
  cancelled: 3
}

/** 后端退款方式（1 现金 / 2 原路退回）→ 前端支付方式 */
const BACKEND_REFUND_METHOD: Record<number, Api.Order.PayMethod> = {
  1: 'cash',
  2: 'bank'
}

// 销售订单列表
export function fetchGetSalesList(
  params: Api.Order.SalesSearchParams
): Promise<Api.Order.SalesList> {
  return callWithFallback(
    () => {
      const query: BackendOrderQuery = {
        ...toBackendPage(params),
        // 后端 keyword 仅模糊匹配订单号，收银员/门店筛选后端不支持（丢弃）
        keyword: params.keyword?.trim() || params.orderNo?.trim() || undefined,
        orderStatus: params.status !== undefined ? BACKEND_ORDER_STATUS[params.status] : undefined,
        // 「部分退款」后端用 pay_status=2 表达，order_status 仍是已完成
        payStatus: params.status === 'partial_refund' ? 2 : undefined,
        startDate: toBackendDateTime(params.startTime, false),
        endDate: toBackendDateTime(params.endTime, true)
      }
      return api
        .get<BackendPageResult<BackendOrderVO>>({ url: '/api/v1/orders', params: query })
        .then((page) => toPaginated(page, toSalesOrder))
    },
    () => orderService.fetchSalesList(params)
  )
}

// 销售订单详情
export function fetchGetSalesDetail(id: string): Promise<Api.Order.SalesOrder> {
  return callWithFallback(
    () => api.get<BackendOrderVO>({ url: `/api/v1/orders/${id}` }).then(toSalesOrder),
    () => orderService.fetchSalesDetail(id)
  )
}

/**
 * 取消订单（逻辑取消，可恢复）
 * 后端会同步回滚该订单引起的库存、支付账户余额与会员累计消费
 */
export function fetchCancelSalesOrder(id: string, reason?: string): Promise<void> {
  return callWithFallback(
    () =>
      api.put<void>({
        url: `/api/v1/orders/${id}/cancel`,
        data: reason ? { reason } : {}
      }),
    () => orderService.fetchCancelOrder(id, reason)
  )
}

/**
 * 恢复已取消的订单
 * 后端会重新扣减库存、恢复支付账户余额与会员累计消费
 */
export function fetchRestoreSalesOrder(id: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/orders/${id}/restore` }),
    () => orderService.fetchRestoreOrder(id)
  )
}

/**
 * 彻底删除订单（物理删除）
 * 后端仅允许删除已取消的订单，并一并清理明细、支付记录与关联退货单
 */
export function fetchDeleteSalesOrder(id: string): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/orders/${id}` }),
    () => orderService.fetchDeleteOrder(id)
  )
}

// 退货单列表
export function fetchGetReturnList(
  params: Api.Order.ReturnSearchParams
): Promise<Api.Order.ReturnList> {
  return callWithFallback(
    () =>
      api
        .get<BackendPageResult<BackendRefundVO>>({
          url: '/api/v1/refunds',
          params: {
            refundNo: params.returnNo?.trim() || undefined,
            orderNo: params.orderNo?.trim() || undefined,
            status: params.status !== undefined ? BACKEND_RETURN_STATUS[params.status] : undefined,
            ...toBackendPage(params)
          }
        })
        .then((page) =>
          toPaginated(
            page,
            (vo): Api.Order.ReturnOrder => ({
              id: String(vo.id ?? ''),
              tenantId: '',
              returnNo: vo.refundNo ?? '',
              orderId: String(vo.orderId ?? ''),
              orderNo: vo.orderNo ?? '',
              warehouseId: '',
              warehouseName: '',
              items: (vo.items ?? []).map((it) => ({
                productId: String(it.productId ?? ''),
                barcode: it.barcode ?? '',
                name: it.productName ?? '',
                unit: it.unit ?? '',
                price: money(it.salePrice),
                quantity: Number(it.quantity ?? 0),
                amount: money(it.totalPrice)
              })),
              refundAmount: money(vo.refundAmount),
              refundMethod: BACKEND_REFUND_METHOD[vo.refundMethod ?? 1] ?? 'cash',
              status: (Object.keys(BACKEND_RETURN_STATUS).find(
                (key) => BACKEND_RETURN_STATUS[key as Api.Order.ReturnStatus] === vo.status
              ) ?? 'completed') as Api.Order.ReturnStatus,
              reason: vo.refundReason ?? '',
              operator: vo.operatorName ?? '',
              createTime: vo.createTime ?? ''
            })
          )
        ),
    () => orderService.fetchReturnList(params)
  )
}

/**
 * 发起退货（按商品部分退货）
 * 后端会回补库存、冲减支付账户与会员累计消费，并生成退货单
 */
export function fetchCreateReturn(payload: CreateReturnPayload): Promise<Api.Order.ReturnOrder> {
  return callWithFallback(
    () =>
      api
        .post<BackendRefundVO>({
          url: '/api/v1/refunds',
          data: {
            orderId: Number(payload.orderId),
            items: payload.items.map((it) => ({
              productId: Number(it.productId),
              quantity: it.quantity
            })),
            // 1-现金 2-原路退回（前端「原路退回」用 bank 占位，后端按原路退回处理）
            refundMethod: payload.refundMethod === 'cash' ? 1 : 2,
            refundReason: payload.reason
          }
        })
        .then((vo) => ({
          id: String(vo.id ?? ''),
          tenantId: '',
          returnNo: vo.refundNo ?? '',
          orderId: String(vo.orderId ?? ''),
          orderNo: vo.orderNo ?? '',
          warehouseId: '',
          warehouseName: '',
          items: (vo.items ?? []).map((it) => ({
            productId: String(it.productId ?? ''),
            barcode: it.barcode ?? '',
            name: it.productName ?? '',
            unit: it.unit ?? '',
            price: money(it.salePrice),
            quantity: Number(it.quantity ?? 0),
            amount: money(it.totalPrice)
          })),
          refundAmount: money(vo.refundAmount),
          refundMethod: BACKEND_REFUND_METHOD[vo.refundMethod ?? 1] ?? 'cash',
          status: 'completed' as Api.Order.ReturnStatus,
          reason: vo.refundReason ?? '',
          operator: vo.operatorName ?? '',
          createTime: vo.createTime ?? ''
        })),
    () => orderService.fetchCreateReturn(payload)
  )
}

/**
 * 作废退货单（取消退货，恢复原订单）
 * 后端会扣回回补的库存、恢复支付账户余额与会员累计消费
 */
export function fetchCancelReturn(id: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/refunds/${id}/cancel` }),
    () => orderService.fetchCancelReturn(id)
  )
}
