/**
 * 仓库 / 库存 / 出入库单据 API
 *
 * 概念映射：前端「仓库 warehouse」≈ 后端「门店 store」（后端无仓库表，库存按 store_id 维度）
 * 单据映射：inbound↔采购入库(purchase-in)、outbound↔出库单(outType=4 其他)、
 *           transfer↔出库单(outType=2 调拨)、stocktake↔盘点（后端接口不完整，保留 Mock）
 * 后端单据 ID 通过 `pi:` / `so:` 前缀返回，便于完成/取消时区分来源
 */
import * as stockService from '@/mock/service/stock.service'
import * as productService from '@/mock/service/product.service'
import { api, callWithFallback, toBackendPage, toPaginated } from './core/backend'
import type { BackendPageResult } from '@/types/common/response'

/* ------------------------------ 后端数据结构 ------------------------------ */

/** 门店（仓库） */
interface BackendStoreVO {
  id: number
  tenantId?: number
  storeNo?: string
  storeName?: string
  address?: string
  /** 1=营业 其它=停用 */
  status?: number
  createTime?: string
}

/** 库存记录（后端 StockVO） */
interface BackendStockVO {
  id?: number
  tenantId?: number
  storeId?: number
  storeName?: string
  productId?: number
  productName?: string
  barcode?: string
  unit?: string
  warehouseQuantity?: number
  shelfQuantity?: number
  pendingInQuantity?: number
  pendingOutQuantity?: number
  totalQuantity?: number
  avgCost?: number
  /** 商品当前进价（pms_product.purchase_price） */
  purchasePrice?: number | string
  warnThreshold?: number
  urgentThreshold?: number
  thresholdOverridden?: boolean
  /** normal / warning / urgent / out_of_stock */
  stockStatus?: string
  /** shelf_up / in_transit / purchase */
  replenishType?: string
}

/** 采购入库单明细 */
interface BackendPurchaseInItemVO {
  productId?: number
  productName?: string
  quantity?: number
  purchasePrice?: number
}

/** 采购入库单（status: 0草稿 1已审核 2已入库） */
interface BackendPurchaseInVO {
  id?: number
  inNo?: string
  storeId?: number
  storeName?: string
  supplierId?: number
  supplierName?: string
  totalAmount?: number
  totalQuantity?: number
  status?: number
  operatorName?: string
  reviewerName?: string
  reviewTime?: string
  reviewRemark?: string
  stockInUserName?: string
  stockInTime?: string
  createTime?: string
  items?: BackendPurchaseInItemVO[]
  /** 来源采购订单（手动入库为空，收货入库时由采购订单生成） */
  sourceOrderId?: number
  sourceOrderNo?: string
}

/** 出库单明细 */
interface BackendStockOutItemVO {
  productId?: number
  productName?: string
  quantity?: number
}

/** 出库单（outType: 1销售 2调拨 3报损 4其他；status: 0草稿 1已出库） */
interface BackendStockOutVO {
  id?: number
  outNo?: string
  outType?: number
  storeId?: number
  storeName?: string
  targetStoreId?: number
  targetStoreName?: string
  totalQuantity?: number
  status?: number
  operatorName?: string
  stockOutTime?: string
  remark?: string
  createTime?: string
  items?: BackendStockOutItemVO[]
}

/** MyBatis-Plus 分页（采购入库单接口返回 records/current/size） */
interface MpPage<T> {
  records?: T[]
  total?: number
  size?: number
  current?: number
}

/** 单据来源（后端单据 ID 解析结果） */
interface BackendDocRef {
  kind: 'pi' | 'so'
  rawId: string
}

/* ------------------------------ 常量与工具 ------------------------------ */

/** 出库类型：2=调拨，4=其它（手动出库） */
const OUT_TYPE_TRANSFER = 2
const OUT_TYPE_DEFAULT = 4

/** 后端单据 ID 前缀（pi=采购入库 so=出库） */
function parseDocId(id: string): BackendDocRef | null {
  const matched = /^(pi|so):(\d+)$/.exec(id)
  if (!matched) return null
  return { kind: matched[1] as BackendDocRef['kind'], rawId: matched[2] }
}

/** 时间格式（后端已按 yyyy-MM-dd HH:mm:ss 返回，此处兜底） */
function formatTime(time?: string): string {
  if (!time) return ''
  return time.replace('T', ' ').slice(0, 19)
}

/** 金额保留两位小数 */
function money(value: number): number {
  return Math.round(value * 100) / 100
}

/** 统一分页结构（兼容 PageResult 与 MyBatis-Plus Page 两种返回） */
function normalizePage<T>(
  res: BackendPageResult<T> | MpPage<T> | null | undefined
): BackendPageResult<T> {
  const source = res as Partial<BackendPageResult<T> & MpPage<T>> | null | undefined
  return {
    list: source?.list ?? source?.records ?? [],
    total: source?.total ?? 0,
    page: source?.page ?? source?.current ?? 1,
    pageSize: source?.pageSize ?? source?.size ?? 20
  }
}

/** 门店名称字典（库存接口不返回 storeName，用于回填仓库名；1 分钟缓存） */
let storeNameCache: { at: number; map: Map<string, string> } | null = null

async function loadStoreNameMap(): Promise<Map<string, string>> {
  if (storeNameCache && Date.now() - storeNameCache.at < 60_000) return storeNameCache.map
  try {
    const page = await api.get<BackendPageResult<BackendStoreVO>>({
      url: '/api/v1/admin/stores',
      // 平台/库存场景：系统管理员显式查全租户（收银台不传 all，后端默认收敛到当前租户）
      params: { page: 1, pageSize: 200, all: true }
    })
    const map = new Map<string, string>()
    ;(page?.list ?? []).forEach((store) => map.set(String(store.id), store.storeName ?? ''))
    storeNameCache = { at: Date.now(), map }
    return map
  } catch {
    return new Map()
  }
}

/** 门店 → 仓库（后端无库存汇总，库存数/金额给默认值） */
function mapStoreItem(store: BackendStoreVO): Api.Warehouse.WarehouseItem {
  return {
    id: String(store.id),
    tenantId: String(store.tenantId ?? ''),
    name: store.storeName ?? '',
    code: store.storeNo ?? '',
    address: store.address ?? '',
    status: store.status === 1 ? '1' : '2',
    isDefault: false,
    stockNum: 0,
    stockValue: 0,
    createTime: formatTime(store.createTime)
  }
}

/** 库存记录映射（后端 StockVO 无售价/分类等字段，给默认值） */
function mapStockItem(
  vo: BackendStockVO,
  storeNames: Map<string, string>
): Api.Warehouse.StockItem {
  const warehouseId = String(vo.storeId ?? '')
  const warehouseQuantity = Number(vo.warehouseQuantity ?? 0)
  const shelfQuantity = Number(vo.shelfQuantity ?? 0)
  const pendingInQuantity = Number(vo.pendingInQuantity ?? 0)
  const purchasePrice = Number(vo.purchasePrice ?? 0)
  const warnThreshold = Number(vo.warnThreshold ?? 0)
  const urgentThreshold = Number(vo.urgentThreshold ?? 0)
  const stockStatus = (vo.stockStatus as Api.Warehouse.StockStatus) ?? 'normal'
  return {
    id: String(vo.id ?? `${warehouseId}-${vo.productId ?? ''}`),
    tenantId: String(vo.tenantId ?? ''),
    warehouseId,
    warehouseName: vo.storeName ?? storeNames.get(warehouseId) ?? '',
    productId: String(vo.productId ?? ''),
    barcode: vo.barcode ?? '',
    productName: vo.productName ?? '',
    categoryId: '',
    unit: vo.unit ?? '',
    warehouseQuantity,
    shelfQuantity,
    pendingInQuantity,
    totalQuantity: Number(vo.totalQuantity ?? warehouseQuantity + shelfQuantity),
    warnThreshold,
    urgentThreshold,
    thresholdOverridden: Boolean(vo.thresholdOverridden),
    stockStatus,
    replenishType: (vo.replenishType as Api.Warehouse.ReplenishType) ?? undefined,
    // 兼容旧字段
    quantity: warehouseQuantity,
    safetyStock: warnThreshold,
    purchasePrice,
    salePrice: 0,
    stockValue: money((warehouseQuantity + shelfQuantity) * purchasePrice),
    warning: stockStatus !== 'normal',
    updateTime: ''
  }
}

/** 采购入库单 → 库存单据（后端 0草稿 / 1已审核 / 2已入库） */
function mapPurchaseInDoc(vo: BackendPurchaseInVO): Api.Warehouse.StockDoc {
  return {
    id: `pi:${vo.id}`,
    tenantId: '',
    type: 'inbound',
    docNo: vo.inNo ?? '',
    warehouseId: String(vo.storeId ?? ''),
    warehouseName: vo.storeName ?? '',
    targetWarehouseId: '',
    targetWarehouseName: '',
    // 0=草稿 1=已审核待入库 2=已入库
    status: vo.status === 2 ? 'done' : vo.status === 1 ? 'reviewed' : 'draft',
    items: (vo.items ?? []).map((item) => ({
      productId: String(item.productId ?? ''),
      barcode: '',
      productName: item.productName ?? '',
      unit: '',
      quantity: Number(item.quantity ?? 0),
      price: Number(item.purchasePrice ?? 0)
    })),
    totalQty: Number(vo.totalQuantity ?? 0),
    operator: vo.operatorName ?? '',
    createTime: formatTime(vo.createTime),
    finishTime: formatTime(vo.stockInTime),
    remark: vo.reviewRemark ?? '',
    supplierName: vo.supplierName || undefined,
    reviewerName: vo.reviewerName || undefined,
    reviewTime: vo.reviewTime ? formatTime(vo.reviewTime) : undefined,
    stockInUserName: vo.stockInUserName || undefined,
    totalAmount: Number(vo.totalAmount ?? 0),
    sourceOrderNo: vo.sourceOrderNo || undefined
  }
}

/** 出库单 → 库存单据（按 outType 区分出库/调拨） */
function mapStockOutDoc(vo: BackendStockOutVO): Api.Warehouse.StockDoc {
  return {
    id: `so:${vo.id}`,
    tenantId: '',
    type: vo.outType === OUT_TYPE_TRANSFER ? 'transfer' : 'outbound',
    docNo: vo.outNo ?? '',
    warehouseId: String(vo.storeId ?? ''),
    warehouseName: vo.storeName ?? '',
    targetWarehouseId: String(vo.targetStoreId ?? ''),
    targetWarehouseName: vo.targetStoreName ?? '',
    status: vo.status === 1 ? 'done' : 'draft',
    items: (vo.items ?? []).map((item) => ({
      productId: String(item.productId ?? ''),
      barcode: '',
      productName: item.productName ?? '',
      unit: '',
      quantity: Number(item.quantity ?? 0),
      price: 0
    })),
    totalQty: Number(vo.totalQuantity ?? 0),
    operator: vo.operatorName ?? '',
    createTime: formatTime(vo.createTime),
    finishTime: formatTime(vo.stockOutTime),
    remark: vo.remark ?? ''
  }
}

/* ------------------------------ 单据列表取数 ------------------------------ */

/** 单据批次（窗口取数后的本地条目与总数） */
interface DocBatch {
  list: Api.Warehouse.StockDoc[]
  total: number
  /** 窗口是否已覆盖后端全部数据（覆盖时本地过滤后的条数即真实总数） */
  covered: boolean
}

/** 窗口大小：保证目标页取到足够数据，数据量小时可一次取全 */
function docWindowSize(page: number, pageSize: number): number {
  return Math.min(Math.max(page * pageSize * 3, 100), 500)
}

/** 采购入库单批次 */
async function loadInboundDocs(windowSize: number): Promise<DocBatch> {
  const res = await api.get<BackendPageResult<BackendPurchaseInVO> | MpPage<BackendPurchaseInVO>>({
    url: '/api/v1/stock/purchase-in',
    params: { page: 1, pageSize: windowSize }
  })
  const page = normalizePage(res)
  return {
    list: page.list.map(mapPurchaseInDoc),
    total: page.total,
    covered: windowSize >= page.total
  }
}

/** 出库单批次（后端出库接口不支持 outType 过滤，本地按类型过滤） */
async function loadStockOutDocs(
  windowSize: number,
  type?: 'outbound' | 'transfer'
): Promise<DocBatch> {
  const res = await api.get<BackendPageResult<BackendStockOutVO>>({
    url: '/api/v1/stock-out',
    params: { page: 1, pageSize: windowSize }
  })
  const total = res?.total ?? 0
  const list = (res?.list ?? [])
    .filter((vo) =>
      type === 'transfer'
        ? vo.outType === OUT_TYPE_TRANSFER
        : type === 'outbound'
          ? vo.outType !== OUT_TYPE_TRANSFER
          : true
    )
    .sort((a, b) => String(b.createTime ?? '').localeCompare(String(a.createTime ?? '')))
    .map(mapStockOutDoc)
  return { list, total, covered: windowSize >= total }
}

/** 批次按分页参数切片 */
function sliceBatch(batch: DocBatch, page: number, pageSize: number): Api.Warehouse.StockDocList {
  return {
    records: batch.list.slice((page - 1) * pageSize, page * pageSize),
    current: page,
    size: pageSize,
    total: batch.covered ? batch.list.length : batch.total
  }
}

/** 未指定类型时合并「采购入库 + 出库（含调拨）」并按创建时间倒序本地分页 */
function mergeBatches(
  batches: DocBatch[],
  page: number,
  pageSize: number
): Api.Warehouse.StockDocList {
  const merged: DocBatch = {
    list: batches
      .flatMap((batch) => batch.list)
      .sort((a, b) => b.createTime.localeCompare(a.createTime)),
    total: batches.reduce((sum, batch) => sum + batch.total, 0),
    covered: batches.every((batch) => batch.covered)
  }
  return sliceBatch(merged, page, pageSize)
}

async function fetchStockDocListFromBackend(
  params: Api.Warehouse.StockDocSearchParams
): Promise<Api.Warehouse.StockDocList> {
  const { page, pageSize } = toBackendPage(params)

  if (params.type === 'inbound') {
    return sliceBatch(await loadInboundDocs(docWindowSize(page, pageSize)), page, pageSize)
  }
  if (params.type === 'outbound' || params.type === 'transfer') {
    const batch = await loadStockOutDocs(docWindowSize(page, pageSize), params.type)
    return sliceBatch(batch, page, pageSize)
  }
  // 未指定类型：合并两个来源（单号/仓库/状态过滤后端列表接口暂不支持，页面当前未传）
  const windowSize = docWindowSize(page, pageSize)
  const [inbound, stockOut] = await Promise.all([
    loadInboundDocs(windowSize),
    loadStockOutDocs(windowSize)
  ])
  return mergeBatches([inbound, stockOut], page, pageSize)
}

/* ------------------------------ 对外接口 ------------------------------ */

// 仓库/门店列表
export function fetchGetWarehouseList(): Promise<Api.Warehouse.WarehouseItem[]> {
  return callWithFallback(
    () =>
      api
        .get<BackendPageResult<BackendStoreVO>>({
          url: '/api/v1/admin/stores',
          // 平台/库存场景：系统管理员显式查全租户（收银台不传 all，后端默认收敛到当前租户）
          params: { page: 1, pageSize: 200, all: true }
        })
        .then((page) => (page?.list ?? []).map(mapStoreItem)),
    () => stockService.fetchWarehouseList()
  )
}

// 库存查询列表
export function fetchGetStockList(
  params: Api.Warehouse.StockSearchParams
): Promise<Api.Warehouse.StockList> {
  return callWithFallback(
    async () => {
      const storeNames = await loadStoreNameMap()
      const page = await api.get<BackendPageResult<BackendStockVO>>({
        url: '/api/v1/stock',
        params: {
          ...toBackendPage(params),
          storeId: params.warehouseId || undefined,
          productId: params.productId || undefined,
          categoryId: params.categoryId || undefined,
          keyword: params.productName || params.barcode || undefined,
          warnLevel: params.warnLevel || undefined
        }
      })
      return toPaginated(page, (item) => mapStockItem(item, storeNames))
    },
    () => stockService.fetchStockList(params)
  )
}

// 库存预警（后端已支持 warnLevel 过滤，直接复用库存列表接口）
export function fetchGetStockWarnings(limit = 8): Promise<Api.Warehouse.StockItem[]> {
  return fetchGetStockList({ warnLevel: 'warning', current: 1, size: limit }).then(
    (page) => page.records
  )
}

// 批量设置商品预警线/紧急线（一次性提交脏行，仅更新商品级两列）
export function fetchBatchUpdateWarningThresholds(items: Api.Product.ProductItem[]): Promise<void> {
  return callWithFallback(
    async () => {
      await api.put({
        url: '/api/v1/stock/warning-thresholds',
        data: {
          items: items.map((item) => ({
            productId: Number(item.id),
            warnThreshold: item.warningStock,
            urgentThreshold: item.stockUrgentThreshold ?? 3
          }))
        }
      })
    },
    async () => {
      // Mock 降级：逐个走商品编辑以复用本地校验与持久化
      for (const item of items) {
        await productService.fetchUpdateProduct({
          id: item.id,
          barcode: item.barcode,
          name: item.name,
          categoryId: item.categoryId,
          supplierId: item.supplierId,
          unit: item.unit,
          spec: item.spec,
          purchasePrice: item.purchasePrice,
          salePrice: item.salePrice,
          memberPrice: item.memberPrice,
          warningStock: item.warningStock,
          stockUrgentThreshold: item.stockUrgentThreshold
        })
      }
    }
  )
}

// 出入库单据列表
export function fetchGetStockDocList(
  params: Api.Warehouse.StockDocSearchParams
): Promise<Api.Warehouse.StockDocList> {
  // 盘点：后端无盘点单列表接口，保留本地 Mock
  if (params.type === 'stocktake') return stockService.fetchStockDocList(params)
  return callWithFallback(
    () => fetchStockDocListFromBackend(params),
    () => stockService.fetchStockDocList(params)
  )
}

/** 前端入库弹窗无供应商字段，默认取后端第一个供应商 */
async function resolveSupplierId(): Promise<number | undefined> {
  const res = await api.get<BackendPageResult<{ id: number }>>({
    url: '/api/v1/suppliers',
    params: { page: 1, pageSize: 1 }
  })
  return res?.list?.[0]?.id
}

/** 按类型创建后端单据并回读详情（新建单据默认为草稿，由「完成」动作生效） */
async function createStockDocInBackend(
  data: Partial<Api.Warehouse.StockDoc>,
  type: Exclude<Api.Warehouse.StockDocType, 'stocktake'>
): Promise<Api.Warehouse.StockDoc> {
  const storeId = data.warehouseId ? Number(data.warehouseId) : undefined

  if (type === 'inbound') {
    const id = await api.post<number>({
      url: '/api/v1/stock/purchase-in',
      data: {
        supplierId: await resolveSupplierId(),
        storeId,
        items: (data.items ?? []).map((item) => ({
          productId: Number(item.productId),
          quantity: Number(item.quantity) || 0,
          purchasePrice: Number(item.price) || 0
        }))
      }
    })
    const detail = await api.get<BackendPurchaseInVO>({
      url: `/api/v1/stock/purchase-in/${id}`
    })
    return mapPurchaseInDoc(detail)
  }

  const id = await api.post<number>({
    url: '/api/v1/stock-out',
    data: {
      outType: type === 'transfer' ? OUT_TYPE_TRANSFER : OUT_TYPE_DEFAULT,
      storeId,
      targetStoreId:
        type === 'transfer' && data.targetWarehouseId ? Number(data.targetWarehouseId) : undefined,
      remark: data.remark || '',
      items: (data.items ?? []).map((item) => ({
        productId: Number(item.productId),
        quantity: Number(item.quantity) || 0
      }))
    }
  })
  const detail = await api.get<BackendStockOutVO>({ url: `/api/v1/stock-out/${id}` })
  return mapStockOutDoc(detail)
}

// 新建单据（入库/出库/调拨/盘点）
export function fetchCreateStockDoc(
  data: Partial<Api.Warehouse.StockDoc>
): Promise<Api.Warehouse.StockDoc> {
  const { type } = data
  // 盘点：后端缺实盘数录入接口，且完成盘点会按实盘 0 清零库存，保留本地 Mock
  if (!type || type === 'stocktake') return stockService.fetchCreateStockDoc(data)
  return callWithFallback(
    () => createStockDocInBackend(data, type),
    () => stockService.fetchCreateStockDoc(data)
  )
}

/** 后端单据完成：入库草稿先审核再入库，出库草稿确认出库 */
async function finishBackendDoc(ref: BackendDocRef): Promise<Api.Warehouse.StockDoc> {
  if (ref.kind === 'pi') {
    const url = `/api/v1/stock/purchase-in/${ref.rawId}`
    const detail = await api.get<BackendPurchaseInVO>({ url })
    if (detail.status === 0) await api.put<void>({ url: `${url}/review` })
    if (detail.status !== 2) await api.put<void>({ url: `${url}/stock-in` })
    return mapPurchaseInDoc(await api.get<BackendPurchaseInVO>({ url }))
  }

  const url = `/api/v1/stock-out/${ref.rawId}`
  const detail = await api.get<BackendStockOutVO>({ url })
  if (detail.status === 0) await api.put<void>({ url: `${url}/confirm` })
  return mapStockOutDoc(await api.get<BackendStockOutVO>({ url }))
}

// 完成单据
export function fetchFinishStockDoc(id: string): Promise<Api.Warehouse.StockDoc> {
  const ref = parseDocId(id)
  // 无法识别为后端单据（Mock 单据，如盘点草稿）→ 本地完成
  if (!ref) return stockService.fetchFinishStockDoc(id)
  return callWithFallback(
    () => finishBackendDoc(ref),
    () => stockService.fetchFinishStockDoc(id)
  )
}

// 取消单据（后端仅允许删除草稿状态单据）
export function fetchCancelStockDoc(id: string): Promise<void> {
  const ref = parseDocId(id)
  if (!ref) return stockService.fetchCancelStockDoc(id)
  return callWithFallback(
    () =>
      ref.kind === 'pi'
        ? api.del<void>({ url: `/api/v1/stock/purchase-in/${ref.rawId}` })
        : api.del<void>({ url: `/api/v1/stock-out/${ref.rawId}` }),
    () => stockService.fetchCancelStockDoc(id)
  )
}
