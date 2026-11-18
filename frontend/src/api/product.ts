import * as productService from '@/mock/service/product.service'
import type { BackendPageResult } from '@/types/common/response'
import { api, callWithFallback, toBackendPage, toPaginated } from './core/backend'

/* ------------------------------ 后端返回结构 ------------------------------ */

/** 后端分类树节点（GET /api/v1/categories/tree） */
interface BackendCategoryVO {
  id: number
  name: string
  code?: string
  parentId?: number | null
  level?: number
  sort?: number
  icon?: string
  status?: number
  children?: BackendCategoryVO[] | null
  /** 后端当前未返回（VO 未定义），保留字段便于后续扩展 */
  createTime?: string
}

/** 后端供应商（GET /api/v1/suppliers） */
interface BackendSupplierVO {
  id: number
  supplierNo?: string
  name: string
  contact?: string
  phone?: string
  address?: string
  bankAccount?: string
  bankName?: string
  status?: number
  createTime?: string
}

/** 后端品牌（GET /api/v1/brands） */
interface BackendBrandVO {
  id: number
  name: string
  logo?: string
  description?: string
  status?: number
  sort?: number
  createTime?: string
}

/** 后端商品（GET /api/v1/products） */
interface BackendProductVO {
  id: number
  productNo?: string
  barcode: string
  name: string
  shortName?: string
  categoryId?: number | null
  categoryName?: string
  brandId?: number | null
  brandName?: string
  supplierId?: number | null
  supplierName?: string
  spec?: string
  unit?: string
  purchasePrice?: number | string
  salePrice?: number | string
  vipPrice?: number | string
  weight?: number | string
  image?: string
  status?: number
  isWeight?: number
  isPromotion?: number
  saleCount?: number | null
  shelfQuantity?: number | null
  warehouseQuantity?: number | null
  /** 库存预警线（商品默认） */
  stockWarnThreshold?: number | string
  /** 库存紧急线（商品默认） */
  stockUrgentThreshold?: number | string
  createTime?: string
}

/** 后端库存行（GET /api/v1/stock） */
interface BackendStockVO {
  productId?: number | null
  warehouseQuantity?: number | string
  shelfQuantity?: number | string
}

/** 后端库存详情（GET /api/v1/stock/detail） */
interface BackendStockDetailVO {
  productId?: number | null
  warehouseQuantity?: number | string
  shelfQuantity?: number | string
}

/** 商品精简引用（用于统计分类/供应商商品数） */
interface ProductRef {
  categoryId?: number | null
  supplierId?: number | null
}

type QueryValue = string | number | undefined | null

/* ------------------------------ 通用工具 ------------------------------ */

/**
 * 前端状态（'1' 启用/在售/合作中、'2' 停用/下架）
 * 转后端状态（1 启用、0 禁用/下架）
 */
const toBackendStatus = (status?: Api.Common.EnableStatus): number | undefined => {
  if (status === '1') return 1
  if (status === '2') return 0
  return undefined
}

/** 后端状态（1 启用、0 禁用）转前端状态 */
const toFrontendStatus = (status?: number | null): Api.Common.EnableStatus =>
  status === 0 ? '2' : '1'

/** 转数字（后端 BigDecimal/Long 可能被序列化为字符串） */
const toNum = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** 转字符串（null/undefined 统一为空串） */
const toStr = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value)

/** 上级分类：后端以 0 表示根节点，前端用 null 表示 */
const toParentId = (parentId?: number | null): string | null =>
  parentId && parentId !== 0 ? String(parentId) : null

/** 分类编码（前端无该字段，后端新增时为必填查询参数，此处生成唯一码） */
const genCategoryCode = (): string => `C${Date.now()}`

/** 当前时间（yyyy-MM-dd HH:mm:ss），后端未返回时间字段时兜底 */
function nowText(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`
}

/**
 * 手动拼接查询串
 * http 层会把 POST/PUT 的 params 自动转成请求体，后端 @RequestParam 需走 URL 传参
 */
function withQuery(url: string, query: Record<string, QueryValue>): string {
  const search = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&')
  return search ? `${url}?${search}` : url
}

/** 关键字包含匹配（忽略大小写与空格，同 mock 口径） */
function matchKeyword(source: string | undefined, keyword?: string): boolean {
  const kw = keyword?.trim().toLowerCase()
  if (!kw) return true
  return String(source ?? '')
    .toLowerCase()
    .includes(kw)
}

/* ------------------------------ 字段映射 ------------------------------ */

/** 后端分类节点 → 前端分类（children 由 mapCategoryTree 递归组装） */
function mapCategory(vo: BackendCategoryVO, productNum = 0): Api.Product.CategoryItem {
  return {
    id: toStr(vo.id),
    tenantId: '',
    parentId: toParentId(vo.parentId),
    name: vo.name ?? '',
    sort: toNum(vo.sort),
    status: toFrontendStatus(vo.status),
    productNum,
    createTime: vo.createTime ?? ''
  }
}

/** 后端分类树 → 前端分类树（counts 为各分类商品数） */
function mapCategoryTree(
  vos: BackendCategoryVO[],
  counts?: Record<string, number>
): Api.Product.CategoryItem[] {
  return vos.map((vo) => {
    const children = mapCategoryTree(vo.children ?? [], counts)
    return {
      ...mapCategory(vo, counts?.[String(vo.id)] ?? 0),
      children: children.length ? children : undefined
    }
  })
}

/** 后端分类平铺（供下拉选择，保持树的先后顺序） */
function flattenCategoryTree(vos: BackendCategoryVO[]): Api.Product.CategoryItem[] {
  const flat: Api.Product.CategoryItem[] = []
  const walk = (nodes: BackendCategoryVO[]) => {
    for (const node of nodes) {
      flat.push(mapCategory(node))
      if (node.children?.length) walk(node.children)
    }
  }
  walk(vos)
  return flat
}

/** 按搜索条件过滤分类树（保留命中节点的上级，与 mock 语义一致） */
function filterCategoryTree(
  nodes: Api.Product.CategoryItem[],
  params: Api.Product.CategorySearchParams
): Api.Product.CategoryItem[] {
  const name = params.name?.trim().toLowerCase()
  const match = (node: Api.Product.CategoryItem) =>
    (!name || node.name.toLowerCase().includes(name)) &&
    (!params.status || node.status === params.status)
  const walk = (list: Api.Product.CategoryItem[]): Api.Product.CategoryItem[] =>
    list
      .map((node) => ({ ...node, children: walk(node.children ?? []) }))
      .filter((node) => match(node) || Boolean(node.children?.length))
      .map((node) => (node.children?.length ? node : { ...node, children: undefined }))
  return walk(nodes)
}

/** 后端分类节点（按 id 深度查找） */
function findCategoryVO(nodes: BackendCategoryVO[], id: string): BackendCategoryVO | undefined {
  for (const node of nodes) {
    if (String(node.id) === id) return node
    const hit = findCategoryVO(node.children ?? [], id)
    if (hit) return hit
  }
  return undefined
}

/** 后端供应商 → 前端供应商 */
function mapSupplier(vo: BackendSupplierVO, productNum = 0): Api.Product.SupplierItem {
  return {
    id: toStr(vo.id),
    tenantId: '',
    name: vo.name ?? '',
    contact: vo.contact ?? '',
    phone: vo.phone ?? '',
    address: vo.address ?? '',
    status: toFrontendStatus(vo.status),
    productNum,
    remark: '',
    createTime: vo.createTime ?? ''
  }
}

/** 后端品牌 → 前端品牌 */
function mapBrand(vo: BackendBrandVO): Api.Product.BrandItem {
  return {
    id: toStr(vo.id),
    tenantId: '',
    name: vo.name ?? '',
    logo: vo.logo ?? '',
    description: vo.description ?? '',
    status: toFrontendStatus(vo.status),
    sort: toNum(vo.sort),
    createTime: vo.createTime ?? ''
  }
}

/** 后端商品 → 前端商品（stock=总库存，shelfQuantity=货架库存，缺省取 VO 自带，再缺省按 0） */
function mapProduct(
  vo: BackendProductVO,
  stock: number,
  shelfQuantity?: number
): Api.Product.ProductItem {
  const purchasePrice = toNum(vo.purchasePrice)
  const salePrice = toNum(vo.salePrice)
  const vipPrice = toNum(vo.vipPrice)
  return {
    id: toStr(vo.id),
    tenantId: '',
    barcode: vo.barcode ?? '',
    name: vo.name ?? '',
    categoryId: toStr(vo.categoryId),
    categoryName: vo.categoryName ?? '',
    supplierId: toStr(vo.supplierId),
    supplierName: vo.supplierName ?? '',
    brandId: toStr(vo.brandId),
    brandName: vo.brandName ?? '',
    unit: vo.unit ?? '',
    spec: vo.spec ?? '',
    purchasePrice,
    salePrice,
    memberPrice: vipPrice > 0 ? vipPrice : salePrice,
    image: vo.image ?? '',
    status: toFrontendStatus(vo.status),
    warningStock: vo.stockWarnThreshold != null ? toNum(vo.stockWarnThreshold) : 10,
    stockUrgentThreshold: vo.stockUrgentThreshold != null ? toNum(vo.stockUrgentThreshold) : 3,
    stock,
    shelfQuantity: shelfQuantity ?? toNum(vo.shelfQuantity),
    salesNum: toNum(vo.saleCount),
    grossRate: salePrice ? Math.round(((salePrice - purchasePrice) / salePrice) * 10000) / 100 : 0,
    remark: '',
    createTime: vo.createTime ?? '',
    updateTime: ''
  }
}

/** 后端商品 VO 自带的库存（详情/POS 搜索接口会填充） */
function stockFromProductVO(vo: BackendProductVO): number {
  return toNum(vo.warehouseQuantity) + toNum(vo.shelfQuantity)
}

/* ------------------------------ 聚合辅助（后端 VO 未提供的字段） ------------------------------ */

/** 分类树原始数据 */
async function loadCategoryVOs(): Promise<BackendCategoryVO[]> {
  const res = await api.get<BackendCategoryVO[]>({ url: '/api/v1/categories/tree' })
  return Array.isArray(res) ? res : []
}

/** 全量商品引用（统计分类/供应商商品数），失败时返回空数组 */
async function fetchProductRefs(): Promise<ProductRef[]> {
  try {
    const res = await api.get<BackendPageResult<ProductRef>>({
      url: '/api/v1/products',
      params: { page: 1, pageSize: 1000 }
    })
    return res?.list ?? []
  } catch {
    return []
  }
}

/**
 * 库存聚合结果
 * total = 仓库 + 货架的总库存，shelf = 货架库存（已上架、可直接销售）
 */
interface StockMaps {
  total: Map<string, number>
  shelf: Map<string, number>
}

/** 库存汇总（仓库 + 货架 / 仅货架），商品列表缺库存字段时补充，失败时按 0 展示 */
async function fetchStockMaps(): Promise<StockMaps> {
  const total = new Map<string, number>()
  const shelf = new Map<string, number>()
  try {
    const res = await api.get<BackendPageResult<BackendStockVO>>({
      url: '/api/v1/stock',
      params: { page: 1, pageSize: 1000 }
    })
    for (const item of res?.list ?? []) {
      if (item.productId === null || item.productId === undefined) continue
      const key = String(item.productId)
      const shelfQty = toNum(item.shelfQuantity)
      total.set(key, (total.get(key) ?? 0) + toNum(item.warehouseQuantity) + shelfQty)
      shelf.set(key, (shelf.get(key) ?? 0) + shelfQty)
    }
  } catch {
    /* 库存聚合失败时按 0 展示 */
  }
  return { total, shelf }
}

/** 单个商品库存（商品详情不返回库存，单独查询），失败时返回 0 */
async function fetchProductStockDetail(
  productId: string
): Promise<{ total: number; shelf: number }> {
  try {
    const res = await api.get<BackendStockDetailVO>({
      url: '/api/v1/stock/detail',
      params: { productId }
    })
    const shelf = toNum(res?.shelfQuantity)
    return { total: toNum(res?.warehouseQuantity) + shelf, shelf }
  } catch {
    return { total: 0, shelf: 0 }
  }
}

/** 统计各分类（含子分类）商品数，口径同 mock */
function countProductsByCategory(
  vos: BackendCategoryVO[],
  refs: ProductRef[]
): Record<string, number> {
  const parentMap = new Map<string, string | null>()
  const walk = (nodes: BackendCategoryVO[]) => {
    for (const node of nodes) {
      parentMap.set(String(node.id), toParentId(node.parentId))
      if (node.children?.length) walk(node.children)
    }
  }
  walk(vos)

  const counts: Record<string, number> = {}
  for (const ref of refs) {
    let current: string | null = ref.categoryId ? String(ref.categoryId) : null
    const visited = new Set<string>()
    while (current && !visited.has(current)) {
      visited.add(current)
      counts[current] = (counts[current] ?? 0) + 1
      current = parentMap.get(current) ?? null
    }
  }
  return counts
}

/** 统计各供应商商品数 */
function countProductsBySupplier(refs: ProductRef[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const ref of refs) {
    if (!ref.supplierId) continue
    const key = String(ref.supplierId)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

/* ------------------------------ 分类 ------------------------------ */

/**
 * 分类树（GET /api/v1/categories/tree，关键字/状态在前端过滤）
 */
export function fetchGetCategoryTree(
  params: Api.Product.CategorySearchParams = {}
): Promise<Api.Product.CategoryItem[]> {
  return callWithFallback(
    async () => {
      const [vos, refs] = await Promise.all([loadCategoryVOs(), fetchProductRefs()])
      const tree = mapCategoryTree(vos, countProductsByCategory(vos, refs))
      return filterCategoryTree(tree, params)
    },
    () => productService.fetchCategoryTree(params)
  )
}

/**
 * 分类下拉选项（后端无独立下拉接口，复用分类树并平铺）
 */
export function fetchGetCategoryOptions(): Promise<Api.Product.CategoryItem[]> {
  return callWithFallback(
    async () => flattenCategoryTree(await loadCategoryVOs()),
    () => productService.fetchCategoryOptions()
  )
}

/**
 * 新增分类（POST /api/v1/categories，参数走查询串）
 */
export function fetchCreateCategory(
  data: Partial<Api.Product.CategoryItem>
): Promise<Api.Product.CategoryItem> {
  return callWithFallback(
    async () => {
      const name = (data.name ?? '').trim()
      const id = await api.post<number>({
        url: withQuery('/api/v1/categories', {
          name,
          code: genCategoryCode(),
          parentId: data.parentId || undefined
        })
      })
      // 后端无分类详情接口，创建后从分类树取回真实数据（排序/状态后端固定为 0/1）
      const created = findCategoryVO(await loadCategoryVOs(), String(id))
      if (created) return { ...mapCategory(created), createTime: created.createTime || nowText() }
      return {
        id: toStr(id),
        tenantId: '',
        parentId: data.parentId ?? null,
        name,
        sort: toNum(data.sort),
        status: data.status ?? '1',
        productNum: 0,
        createTime: nowText()
      }
    },
    () => productService.fetchCreateCategory(data)
  )
}

/**
 * 编辑分类（PUT /api/v1/categories/{id}，后端仅支持修改名称与编码）
 */
export function fetchUpdateCategory(
  data: Partial<Api.Product.CategoryItem>
): Promise<Api.Product.CategoryItem> {
  return callWithFallback(
    async () => {
      const name = (data.name ?? '').trim()
      const id = toStr(data.id)
      const before = findCategoryVO(await loadCategoryVOs(), id)
      await api.put({
        url: withQuery(`/api/v1/categories/${data.id}`, {
          name,
          code: before?.code || genCategoryCode()
        })
      })
      if (before) return { ...mapCategory(before), name }
      return {
        id,
        tenantId: '',
        parentId: data.parentId ?? null,
        name,
        sort: toNum(data.sort),
        status: data.status ?? '1',
        productNum: 0,
        createTime: ''
      }
    },
    () => productService.fetchUpdateCategory(data)
  )
}

/**
 * 删除分类（DELETE /api/v1/categories/{id}）
 */
export function fetchDeleteCategory(id: string): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/categories/${id}` }),
    () => productService.fetchDeleteCategory(id)
  )
}

/* ------------------------------ 供应商 ------------------------------ */

/**
 * 供应商列表（GET /api/v1/suppliers）
 */
export function fetchGetSupplierList(
  params: Api.Product.SupplierSearchParams
): Promise<Api.Product.SupplierList> {
  return callWithFallback(
    async () => {
      // 后端 keyword 仅按单关键字模糊匹配名称/联系人，联系人、电话条件改为拉取后本地过滤
      const useLocalFilter = Boolean(params.contact?.trim() || params.phone?.trim())
      const [page, refs] = await Promise.all([
        api.get<BackendPageResult<BackendSupplierVO>>({
          url: '/api/v1/suppliers',
          params: {
            ...(useLocalFilter ? { page: 1, pageSize: 1000 } : toBackendPage(params)),
            keyword: params.name?.trim() || undefined,
            status: toBackendStatus(params.status)
          }
        }),
        fetchProductRefs()
      ])
      const counts = countProductsBySupplier(refs)
      const mapper = (vo: BackendSupplierVO) => mapSupplier(vo, counts[String(vo.id)] ?? 0)
      if (!useLocalFilter) return toPaginated(page, mapper)

      const current = Math.max(1, Number(params.current) || 1)
      const size = Math.max(1, Number(params.size) || 20)
      // 名称/状态已由后端 keyword/status 过滤，这里只补过滤后端不支持的联系人、电话
      const filtered = (page?.list ?? []).filter(
        (vo) => matchKeyword(vo.contact, params.contact) && matchKeyword(vo.phone, params.phone)
      )
      const start = (current - 1) * size
      return toPaginated({
        list: filtered.slice(start, start + size).map(mapper),
        total: filtered.length,
        page: current,
        pageSize: size
      })
    },
    () => productService.fetchSupplierList(params)
  )
}

/**
 * 供应商下拉选项（复用列表接口，仅取启用状态）
 */
export function fetchGetSupplierOptions(): Promise<Api.Product.SupplierItem[]> {
  return callWithFallback(
    async () => {
      const res = await api.get<BackendPageResult<BackendSupplierVO>>({
        url: '/api/v1/suppliers',
        params: { page: 1, pageSize: 1000, status: 1 }
      })
      return (res?.list ?? []).map((vo) => mapSupplier(vo))
    },
    () => productService.fetchSupplierOptions()
  )
}

/** 供应商提交体（后端 SupplierCreateDTO：名称/联系人/电话/地址） */
function buildSupplierBody(data: Partial<Api.Product.SupplierItem>) {
  return {
    name: data.name?.trim() ?? '',
    contact: data.contact ?? '',
    phone: data.phone ?? '',
    address: data.address ?? ''
  }
}

/**
 * 新增供应商（POST /api/v1/suppliers，创建后查详情组装完整实体）
 */
export function fetchCreateSupplier(
  data: Partial<Api.Product.SupplierItem>
): Promise<Api.Product.SupplierItem> {
  return callWithFallback(
    async () => {
      const id = await api.post<number>({
        url: '/api/v1/suppliers',
        data: buildSupplierBody(data)
      })
      const vo = await api.get<BackendSupplierVO>({ url: `/api/v1/suppliers/${id}` })
      return mapSupplier(vo)
    },
    () => productService.fetchCreateSupplier(data)
  )
}

/**
 * 编辑供应商（PUT /api/v1/suppliers/{id}，创建后查详情组装完整实体）
 */
export function fetchUpdateSupplier(
  data: Partial<Api.Product.SupplierItem>
): Promise<Api.Product.SupplierItem> {
  return callWithFallback(
    async () => {
      await api.put({ url: `/api/v1/suppliers/${data.id}`, data: buildSupplierBody(data) })
      const vo = await api.get<BackendSupplierVO>({ url: `/api/v1/suppliers/${data.id}` })
      return mapSupplier(vo, toNum(data.productNum))
    },
    () => productService.fetchUpdateSupplier(data)
  )
}

/**
 * 删除供应商（DELETE /api/v1/suppliers/{id}）
 */
export function fetchDeleteSupplier(id: string): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/suppliers/${id}` }),
    () => productService.fetchDeleteSupplier(id)
  )
}

/* ------------------------------ 品牌 ------------------------------ */

/** 品牌提交体（后端 BrandCreateDTO / BrandCreateEditDTO） */
function buildBrandBody(data: Partial<Api.Product.BrandItem>) {
  const body: Record<string, unknown> = {
    name: data.name?.trim() ?? ''
  }
  if (data.logo) body.logo = data.logo
  if (data.description) body.description = data.description
  if (data.sort !== undefined && data.sort !== null) body.sort = data.sort
  return body
}

/**
 * 品牌下拉选项（GET /api/v1/brands，不分页）
 * 品牌只存在后端，无 Mock 降级：后端不可达时返回空列表，
 * 商品表单的品牌选择降级为「不选」，不影响商品本身保存
 */
export async function fetchGetBrandOptions(): Promise<Api.Product.BrandItem[]> {
  try {
    const res = await api.get<BackendPageResult<BackendBrandVO>>({
      url: '/api/v1/brands',
      params: { page: 1, pageSize: 500 },
      showErrorMessage: false
    })
    return (res?.list ?? []).map(mapBrand)
  } catch {
    return []
  }
}

/** 新增品牌（POST /api/v1/brands，权限 pms:brand:add） */
export function fetchCreateBrand(data: Partial<Api.Product.BrandItem>): Promise<void> {
  return api.post<void>({ url: '/api/v1/brands', data: buildBrandBody(data) })
}

/** 编辑品牌（PUT /api/v1/brands/{id}，权限 pms:brand:edit） */
export function fetchUpdateBrand(id: string, data: Partial<Api.Product.BrandItem>): Promise<void> {
  return api.put<void>({ url: `/api/v1/brands/${id}`, data: buildBrandBody(data) })
}

/** 删除品牌（DELETE /api/v1/brands/{id}，权限 pms:brand:delete） */
export function fetchDeleteBrand(id: string): Promise<void> {
  return api.del<void>({ url: `/api/v1/brands/${id}` })
}

/* ------------------------------ 商品 ------------------------------ */

/** 商品提交体（后端 ProductCreateDTO，会员价对应 vipPrice） */
function buildProductBody(data: Partial<Api.Product.ProductForm>) {
  const body: Record<string, unknown> = {
    barcode: data.barcode?.trim() ?? '',
    name: data.name?.trim() ?? '',
    categoryId: data.categoryId ?? null,
    purchasePrice: toNum(data.purchasePrice),
    salePrice: toNum(data.salePrice),
    vipPrice: data.memberPrice || null,
    // image 为空串时传 null，后端据此清空图片并删除旧文件
    image: data.image || null
  }
  if (data.supplierId) body.supplierId = data.supplierId
  if (data.brandId) body.brandId = data.brandId
  if (data.unit) body.unit = data.unit
  if (data.spec) body.spec = data.spec
  if (data.warningStock !== undefined && data.warningStock !== null) {
    body.stockWarnThreshold = data.warningStock
  }
  if (data.stockUrgentThreshold !== undefined && data.stockUrgentThreshold !== null) {
    body.stockUrgentThreshold = data.stockUrgentThreshold
  }
  return body
}

/**
 * 上传商品图片（POST /api/v1/upload/image/product，multipart/form-data）
 * 后端返回可访问的相对 URL：/api/v1/upload/file/product/{filename}
 */
export function fetchUploadProductImage(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  return api.post<string>({
    url: '/api/v1/upload/image/product',
    data: formData,
    showErrorMessage: false
  })
}

/**
 * 商品列表（GET /api/v1/products）
 * 后端 keyword 仅支持 名称/拼音/条码等值 匹配，条码模糊与供应商筛选改为本地过滤分页
 */
export function fetchGetProductList(
  params: Api.Product.ProductSearchParams
): Promise<Api.Product.ProductList> {
  return callWithFallback(
    async () => {
      const useLocalFilter = Boolean(params.barcode?.trim() || params.supplierId)
      const [page, stockMaps] = await Promise.all([
        api.get<BackendPageResult<BackendProductVO>>({
          url: '/api/v1/products',
          params: {
            ...(useLocalFilter ? { page: 1, pageSize: 1000 } : toBackendPage(params)),
            keyword: params.name?.trim() || undefined,
            categoryId: params.categoryId || undefined,
            status: toBackendStatus(params.status)
          }
        }),
        fetchStockMaps()
      ])
      const mapper = (vo: BackendProductVO) =>
        mapProduct(
          vo,
          stockMaps.total.get(String(vo.id)) ?? stockFromProductVO(vo),
          stockMaps.shelf.get(String(vo.id)) ?? toNum(vo.shelfQuantity)
        )
      if (!useLocalFilter) return toPaginated(page, mapper)

      const current = Math.max(1, Number(params.current) || 1)
      const size = Math.max(1, Number(params.size) || 20)
      // 名称/分类/状态已由后端过滤，这里只补过滤后端不支持的条码模糊与供应商条件
      const filtered = (page?.list ?? []).filter(
        (vo) =>
          matchKeyword(vo.barcode, params.barcode) &&
          (!params.supplierId || toStr(vo.supplierId) === params.supplierId)
      )
      const start = (current - 1) * size
      return toPaginated({
        list: filtered.slice(start, start + size).map(mapper),
        total: filtered.length,
        page: current,
        pageSize: size
      })
    },
    () => productService.fetchProductList(params)
  )
}

/**
 * 商品下拉选项（收银台/开单检索，复用后端 POS 搜索接口）
 */
export function fetchGetProductOptions(keyword = ''): Promise<Api.Product.ProductItem[]> {
  return callWithFallback(
    async () => {
      const res = await api.get<BackendProductVO[]>({
        url: '/api/v1/products/search',
        params: { keyword }
      })
      // 后端未过滤状态，按 mock 口径仅保留在售商品并取前 30 条
      return (Array.isArray(res) ? res : [])
        .map((vo) => mapProduct(vo, stockFromProductVO(vo), toNum(vo.shelfQuantity)))
        .filter((item) => item.status === '1')
        .slice(0, 30)
    },
    () => productService.fetchProductOptions(keyword)
  )
}

/**
 * 新增商品（POST /api/v1/products，创建后查详情组装完整实体）
 */
export function fetchCreateProduct(
  data: Partial<Api.Product.ProductForm> & { initStock?: number; warehouseId?: string }
): Promise<Api.Product.ProductItem> {
  return callWithFallback(
    async () => {
      const id = await api.post<number>({ url: '/api/v1/products', data: buildProductBody(data) })
      // 后端新增固定为上架，需通过状态接口同步停售状态
      const status = toBackendStatus(data.status)
      if (status !== undefined && status !== 1) {
        await api.put({ url: withQuery(`/api/v1/products/${id}/status`, { status }) })
      }
      const vo = await api.get<BackendProductVO>({ url: `/api/v1/products/${id}` })
      const stockDetail = await fetchProductStockDetail(toStr(id))
      return mapProduct(vo, stockDetail.total, stockDetail.shelf)
    },
    () => productService.fetchCreateProduct(data)
  )
}

/**
 * 编辑商品（PUT /api/v1/products/{id}，状态单独通过状态接口维护）
 */
export function fetchUpdateProduct(
  data: Partial<Api.Product.ProductForm>
): Promise<Api.Product.ProductItem> {
  return callWithFallback(
    async () => {
      await api.put({ url: `/api/v1/products/${data.id}`, data: buildProductBody(data) })
      const status = toBackendStatus(data.status)
      if (status !== undefined) {
        await api.put({ url: withQuery(`/api/v1/products/${data.id}/status`, { status }) })
      }
      const vo = await api.get<BackendProductVO>({ url: `/api/v1/products/${data.id}` })
      const stockDetail = await fetchProductStockDetail(toStr(data.id))
      return mapProduct(vo, stockDetail.total, stockDetail.shelf)
    },
    () => productService.fetchUpdateProduct(data)
  )
}

/**
 * 删除商品（DELETE /api/v1/products/{id}）
 */
export function fetchDeleteProduct(id: string): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/products/${id}` }),
    () => productService.fetchDeleteProduct(id)
  )
}

/** 后端价格历史（GET /api/v1/products/{id}/price-history） */
interface BackendPriceHistoryVO {
  id: number
  purchasePrice?: number | string
  salePrice?: number | string
  vipPrice?: number | string
  source?: string
  createTime?: string
}

/** Mock 降级：本地无历史库，按当前价格生成建档 + 调价的演示走势 */
async function mockPriceHistory(productId: string): Promise<Api.Product.PriceHistoryItem[]> {
  const page = await productService.fetchProductList({ current: 1, size: 1000 })
  const product = page.records.find((item) => item.id === productId)
  if (!product) return []
  const factors = [0.85, 0.9, 0.95, 1]
  const end = Date.parse(product.updateTime || product.createTime || '') || Date.now()
  const day = 24 * 60 * 60 * 1000
  const pad = (n: number) => String(n).padStart(2, '0')
  const formatTime = (ms: number) => {
    const d = new Date(ms)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
      d.getMinutes()
    )}:${pad(d.getSeconds())}`
  }
  const round = (value: number) => Math.round(value * 100) / 100
  return factors.map((factor, index) => ({
    id: String(index + 1),
    purchasePrice: round(product.purchasePrice * factor),
    salePrice: round(product.salePrice * factor),
    memberPrice: round(product.memberPrice * factor),
    source: index === 0 ? 'create' : 'edit',
    createTime: formatTime(end - (factors.length - 1 - index) * 7 * day)
  }))
}

/**
 * 商品价格走势（GET /api/v1/products/{id}/price-history，按时间升序）
 */
export function fetchGetPriceHistory(productId: string): Promise<Api.Product.PriceHistoryItem[]> {
  return callWithFallback(
    async () => {
      const res = await api.get<BackendPriceHistoryVO[]>({
        url: `/api/v1/products/${productId}/price-history`
      })
      return (Array.isArray(res) ? res : []).map((vo) => ({
        id: toStr(vo.id),
        purchasePrice: toNum(vo.purchasePrice),
        salePrice: toNum(vo.salePrice),
        memberPrice: toNum(vo.vipPrice),
        source: vo.source === 'create' ? 'create' : 'edit',
        createTime: vo.createTime ?? ''
      }))
    },
    () => mockPriceHistory(productId)
  )
}
