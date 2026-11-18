import * as posService from '@/mock/service/pos.service'
import type { PosContext } from '@/mock/service/pos.service'
import { api, callWithFallback } from './core/backend'
import type { BackendPageResult } from '@/types/common/response'

/* ------------------------------ 后端返回结构 ------------------------------ */

/** 后端门店（GET /api/v1/admin/stores） */
interface BackendStoreVO {
  id: number
  tenantId?: number
  storeNo?: string
  storeName: string
  address?: string
  status?: number
  createTime?: string
}

/** 后端分类树（GET /api/v1/categories/tree） */
interface BackendCategoryVO {
  id: number
  parentId?: number | null
  name: string
  sort?: number
  status?: number
  children?: BackendCategoryVO[] | null
}

/** 后端当前租户（GET /api/v1/admin/tenants/current） */
interface BackendTenantVO {
  tenantName?: string
}

/** 后端用户画像（GET /api/v1/system/users/profile） */
interface BackendProfileVO {
  username?: string
  name?: string
}

/** 后端 POS 商品搜索（GET /api/v1/products/search） */
interface BackendProductVO {
  id: number
  barcode?: string
  name: string
  unit?: string
  categoryId?: number | null
  salePrice?: number
  vipPrice?: number | null
  image?: string
  shelfQuantity?: number
}

/** 后端订单明细（OrderItemVO） */
interface BackendOrderItemVO {
  productId?: number
  productName?: string
  barcode?: string
  unit?: string
  quantity?: number
  salePrice?: number
  totalPrice?: number
}

/** 后端结算返回（POST /api/v1/pos/checkout） */
interface BackendCheckoutVO {
  orderId: number
  orderNo: string
  totalAmount: number
  discountAmount: number
  payAmount: number
  changeAmount: number
  items?: BackendOrderItemVO[] | null
}

/** 后端订单（GET /api/v1/orders、GET /api/v1/orders/{id}） */
interface BackendOrderVO {
  id?: number
  orderNo?: string
  orderStatus?: number
  payMethod?: string
  totalAmount?: number
  discountAmount?: number
  payAmount?: number
  totalQuantity?: number
  memberName?: string
  cashierName?: string
  createTime?: string
  items?: BackendOrderItemVO[] | null
}

/* ------------------------------ 字段映射工具 ------------------------------ */

/** 后端状态（1 启用）→ 前端启用状态（'1' 启用 / '2' 停用） */
const toEnableStatus = (status?: number): Api.Common.EnableStatus => (status === 1 ? '1' : '2')

/** 前端支付账户编码 → 后端支付编码（后端银行卡编码为 card；其余编码与 sys_payment_method.code 一致直接透传） */
const toBackendPayMethod = (method: string): string => (method === 'bank' ? 'card' : method)

/** 后端支付编码 → 前端订单支付方式（展示用，自定义编码回退现金） */
const toOrderPayMethod = (code?: string): Api.Order.PayMethod => {
  if (code === 'wechat') return 'wechat'
  if (code === 'alipay') return 'alipay'
  if (code === 'stored') return 'stored'
  if (code === 'card' || code === 'bank') return 'bank'
  return 'cash'
}

/** 本地时间（yyyy-MM-dd HH:mm:ss），与后端时间格式保持一致 */
const formatLocalDateTime = (date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 后端门店 → 前端销售门店/仓库 */
const toWarehouseItem = (store: BackendStoreVO, index: number): Api.Warehouse.WarehouseItem => ({
  id: String(store.id),
  tenantId: store.tenantId != null ? String(store.tenantId) : '',
  name: store.storeName,
  code: store.storeNo ?? '',
  address: store.address ?? '',
  status: toEnableStatus(store.status),
  isDefault: index === 0,
  stockNum: 0,
  stockValue: 0,
  createTime: store.createTime ?? ''
})

/** 后端分类树节点 → 前端分类（收银台只展示顶级分类） */
const toCategoryItem = (category: BackendCategoryVO): Api.Product.CategoryItem => ({
  id: String(category.id),
  tenantId: '',
  parentId: category.parentId != null ? String(category.parentId) : null,
  name: category.name,
  sort: category.sort ?? 0,
  status: toEnableStatus(category.status),
  productNum: 0,
  createTime: '',
  children: category.children?.length ? category.children.map(toCategoryItem) : undefined
})

/** 后端商品 → 收银台购物车项 */
const toCartItem = (product: BackendProductVO): Api.Pos.CartItem => ({
  productId: String(product.id),
  barcode: product.barcode ?? '',
  name: product.name,
  unit: product.unit ?? '件',
  categoryId: product.categoryId != null ? String(product.categoryId) : '',
  price: Number(product.salePrice ?? 0),
  memberPrice: Number(product.vipPrice ?? product.salePrice ?? 0),
  image: product.image ?? '',
  quantity: 1,
  // 后端搜索接口不区分门店，库存为全门店货架库存汇总
  stock: Number(product.shelfQuantity ?? 0)
})

/** 后端订单明细 → 前端订单明细 */
const toOrderItem = (item: BackendOrderItemVO): Api.Order.OrderItem => ({
  productId: item.productId != null ? String(item.productId) : '',
  barcode: item.barcode ?? '',
  name: item.productName ?? '',
  unit: item.unit ?? '',
  price: Number(item.salePrice ?? 0),
  quantity: Number(item.quantity ?? 0),
  amount: Number(item.totalPrice ?? 0),
  refundedQty: 0
})

/** 后端订单状态（3 已取消 / 4 已退款）→ 前端订单状态 */
const toOrderStatus = (orderStatus?: number): Api.Order.OrderStatus => {
  if (orderStatus === 4) return 'refunded'
  if (orderStatus === 3) return 'cancelled'
  return 'paid'
}

/* ------------------------------ 收银台上下文 ------------------------------ */

/** 组装收银台上下文：门店 / 分类 / 租户 / 收银员
 * 门店范围由后端默认收敛到当前登录账号所属租户：超管也属于初始默认租户，
 * 仅能使用本租户门店，不具备跨租户收银能力（门店管理/库存等平台场景显式传 all=true 查全租户）。 */
async function loadContext(): Promise<PosContext> {
  // 门店为必需数据（失败不上抛降级）；分类/租户/收银员失败时用空值兜底
  const [stores, categories, tenant, profile] = await Promise.all([
    api.get<BackendPageResult<BackendStoreVO>>({
      url: '/api/v1/admin/stores',
      params: { page: 1, pageSize: 100 }
    }),
    api
      .get<BackendCategoryVO[]>({ url: '/api/v1/categories/tree', showErrorMessage: false })
      .catch(() => [] as BackendCategoryVO[]),
    api
      .get<BackendTenantVO>({ url: '/api/v1/admin/tenants/current', showErrorMessage: false })
      .catch(() => null),
    api
      .get<BackendProfileVO>({ url: '/api/v1/system/users/profile', showErrorMessage: false })
      .catch(() => null)
  ])

  const warehouses = (stores?.list ?? []).map((store, index) => toWarehouseItem(store, index))
  const defaultWarehouse = warehouses.find((w) => w.status === '1') || warehouses[0]
  if (!defaultWarehouse) throw new Error('当前租户还没有可用门店，请先在门店管理中配置')

  return {
    tenantName: tenant?.tenantName ?? '',
    cashier: profile?.name || profile?.username || '收银员',
    warehouseId: defaultWarehouse.id,
    warehouses,
    categories: (categories ?? []).map(toCategoryItem)
  }
}

// 收银台上下文（门店/分类/收银员）
export function fetchPosContext(): Promise<PosContext> {
  return callWithFallback(
    () => loadContext(),
    () => posService.fetchPosContext()
  )
}

/* ------------------------------ 商品搜索 ------------------------------ */

/** 搜索可销售商品（后端关键词搜索，条码/名称模糊匹配） */
async function loadProducts(keyword: string): Promise<Api.Pos.CartItem[]> {
  const kw = keyword.trim()
  if (!kw) return []
  const list = await api.get<BackendProductVO[]>({
    url: '/api/v1/products/search',
    params: { keyword: kw }
  })
  return (list ?? []).map(toCartItem)
}

// 收银台商品搜索
export function fetchPosProducts(
  keyword: string,
  warehouseId: string
): Promise<Api.Pos.CartItem[]> {
  return callWithFallback(
    () => loadProducts(keyword),
    () => posService.fetchPosProducts(keyword, warehouseId)
  )
}

/* ------------------------------ 收银结算 ------------------------------ */

/** 结算返回 + 订单详情 → 前端销售订单 */
function toSalesOrder(
  checkout: BackendCheckoutVO,
  detail: BackendOrderVO | null,
  warehouseName: string,
  params: Api.Pos.CheckoutParams,
  rawPayments: Api.Pos.CheckoutPayment[]
): Api.Order.SalesOrder {
  const items = (checkout.items ?? detail?.items ?? []).map(toOrderItem)
  const payAmount = Number(checkout.payAmount ?? 0)
  // 现金单按“应收金额”记账，与 Mock 行为保持一致
  const isSingleCash = rawPayments.length === 1 && rawPayments[0].method === 'cash'
  const orderPayments: Api.Order.PaymentRecord[] = isSingleCash
    ? [{ method: 'cash', amount: payAmount }]
    : rawPayments.map((p) => ({ method: toOrderPayMethod(p.method), amount: p.amount }))
  return {
    id: checkout.orderId != null ? String(checkout.orderId) : '',
    tenantId: '', // 后端订单不返回租户 ID
    orderNo: checkout.orderNo ?? '',
    source: 'pos',
    warehouseId: params.warehouseId,
    warehouseName,
    items,
    quantity: detail?.totalQuantity ?? items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: Number(checkout.totalAmount ?? 0),
    discountAmount: Number(checkout.discountAmount ?? 0),
    payAmount,
    payments: orderPayments,
    status: toOrderStatus(detail?.orderStatus),
    memberName: detail?.memberName ?? params.memberName ?? '',
    cashier: detail?.cashierName || params.cashier || '收银员',
    createTime: detail?.createTime || formatLocalDateTime(),
    remark: params.remark ?? ''
  }
}

/** 真实结算：前端参数 → 后端 CheckoutDTO，返回结果补全为前端订单 */
async function loadCheckout(params: Api.Pos.CheckoutParams): Promise<Api.Pos.CheckoutResult> {
  const items = params.items.filter((it) => it.quantity > 0)
  const payments = params.payments
    .filter((p) => Number(p.amount) > 0)
    .map((p) => ({ method: p.method, amount: Number(p.amount) }))

  // 会员 ID 可空：无会员时省略该字段（收银台已按手机号查询并校验）；整单折扣/备注后端 CheckoutDTO 暂不支持
  const memberId = params.memberId ? Number(params.memberId) : undefined
  const checkout = await api.post<BackendCheckoutVO>({
    url: '/api/v1/pos/checkout',
    data: {
      storeId: Number(params.warehouseId),
      ...(memberId != null ? { memberId } : {}),
      items: items.map((it) => ({
        productId: Number(it.productId),
        quantity: it.quantity,
        salePrice: Number(it.price),
        // CartItem 无称重标识，统一按计件商品提交
        isWeight: 0
      })),
      payments: payments.map((p) => ({
        paymentMethod: toBackendPayMethod(p.method),
        amount: p.amount,
        receivedAmount: p.amount
      }))
    }
  })

  // 订单详情与门店名称用于补全展示字段，失败不影响结算结果
  const [detail, store] = await Promise.all([
    api
      .get<BackendOrderVO>({ url: `/api/v1/orders/${checkout.orderId}`, showErrorMessage: false })
      .catch(() => null),
    api
      .get<BackendStoreVO>({
        url: `/api/v1/admin/stores/${Number(params.warehouseId)}`,
        showErrorMessage: false
      })
      .catch(() => null)
  ])

  return {
    order: toSalesOrder(checkout, detail, store?.storeName ?? '', params, payments),
    changeAmount: Number(checkout.changeAmount ?? 0)
  }
}

// 收银结算
export function fetchPosCheckout(params: Api.Pos.CheckoutParams): Promise<Api.Pos.CheckoutResult> {
  return callWithFallback(
    () => loadCheckout(params),
    () => posService.fetchCheckout(params)
  )
}

/* ------------------------------ 挂单（后端暂无挂单接口，保留本地 Mock） ------------------------------ */

// 挂单列表
export function fetchPosHoldList(): Promise<Api.Pos.HoldItem[]> {
  return posService.fetchHoldList()
}

// 保存挂单
export function fetchPosSaveHold(
  items: Api.Pos.CartItem[],
  options?: {
    name?: string
    member?: Api.Member.MemberItem
    remark?: string
    payment?: Api.Pos.HoldPayment
  }
): Promise<Api.Pos.HoldItem> {
  return posService.fetchSaveHold(items, options)
}

// 删除挂单
export function fetchPosRemoveHold(id: string): Promise<void> {
  return posService.fetchRemoveHold(id)
}

// 取挂单
export function fetchPosRestoreHold(id: string): Promise<Api.Pos.HoldItem> {
  return posService.fetchRestoreHold(id)
}

/* ------------------------------ 最近交易 ------------------------------ */

/** 后端订单 → 前端销售订单（最近交易仅展示单号/金额/收银员/时间） */
const toRecentOrder = (order: BackendOrderVO): Api.Order.SalesOrder => ({
  id: order.id != null ? String(order.id) : '',
  tenantId: '',
  orderNo: order.orderNo ?? '',
  source: 'pos',
  warehouseId: '',
  warehouseName: '',
  items: (order.items ?? []).map(toOrderItem),
  quantity: Number(order.totalQuantity ?? 0),
  totalAmount: Number(order.totalAmount ?? 0),
  discountAmount: Number(order.discountAmount ?? 0),
  payAmount: Number(order.payAmount ?? 0),
  payments: [{ method: toOrderPayMethod(order.payMethod), amount: Number(order.payAmount ?? 0) }],
  status: toOrderStatus(order.orderStatus),
  memberName: order.memberName ?? '',
  cashier: order.cashierName ?? '',
  createTime: order.createTime || formatLocalDateTime(),
  remark: ''
})

// 最近交易
export function fetchPosRecentOrders(limit = 6): Promise<Api.Order.SalesOrder[]> {
  return callWithFallback(
    () =>
      api
        .get<BackendPageResult<BackendOrderVO>>({
          url: '/api/v1/orders',
          params: { page: 1, pageSize: limit }
        })
        .then((page) => (page?.list ?? []).map(toRecentOrder)),
    () => posService.fetchRecentOrders(limit)
  )
}
