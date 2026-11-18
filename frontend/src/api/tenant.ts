/**
 * 租户（连锁品牌/门店）API
 *
 * 后端提供租户分页/详情/增删改/状态接口；套餐（Plan）后端无表与接口
 * （套餐仅为 sys_tenant.plan_type 字段），相关能力保留本地 Mock。
 */
import * as tenantService from '@/mock/service/tenant.service'
import type { BackendPageResult } from '@/types/common/response'
import { api, callWithFallback, toBackendPage, toPaginated } from './core/backend'

/* ------------------------------ 后端返回结构 ------------------------------ */

/** 后端租户（GET /api/v1/admin/tenants → Result<TenantVO>） */
interface BackendTenantVO {
  id: number
  tenantNo?: string
  tenantName?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  address?: string
  licenseNo?: string
  planType?: number | null
  maxStores?: number
  maxUsers?: number
  expireTime?: string
  status?: number | null
  remark?: string
  createTime?: string
  /** 列表/详情接口返回的门店数 */
  storeCount?: number
}

/** MyBatis 分页（个别接口返回 Page{records,current,size,total}），与 PageResult 兼容 */
interface MyBatisPage<T> {
  records?: T[]
  total?: number
  current?: number
  size?: number
}

/** 后端两种分页结构 */
type PageLike<T> = BackendPageResult<T> | MyBatisPage<T>

/* ------------------------------ 通用工具 ------------------------------ */

type QueryValue = string | number | undefined | null

/** 手动拼接查询串（http 层会把 PUT/POST 的 params 转请求体，@RequestParam 需走 URL） */
function withQuery(url: string, query: Record<string, QueryValue>): string {
  const search = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&')
  return search ? `${url}?${search}` : url
}

/** 转数字 */
const toNum = (value: unknown, fallback = 0): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/** 关键字包含匹配（同 mock 口径，忽略大小写与空格） */
function matchKeyword(source: string | undefined, keyword?: string): boolean {
  const kw = keyword?.trim().toLowerCase()
  if (!kw) return true
  return String(source ?? '')
    .toLowerCase()
    .includes(kw)
}

/** 归一化后端分页（兼容 PageResult 与 MyBatis Page） */
function normalizePage<T>(page: PageLike<T> | null | undefined): BackendPageResult<T> | null {
  if (!page) return null
  if ('list' in page) return page
  const list = page.records ?? []
  return {
    list,
    total: toNum(page.total),
    page: toNum(page.current, 1),
    pageSize: toNum(page.size, list.length || 20)
  }
}

/* ------------------------------ 字段映射 ------------------------------ */

/** 后端状态（0 禁用 / 1 正常 / 2 已到期）→ 前端状态（'1' 正常 / '2' 停用 / '3' 过期） */
const toFrontendStatus = (status?: number | null): Api.Tenant.TenantStatus =>
  status === 0 ? '2' : status === 2 ? '3' : '1'

/** 前端状态 → 后端状态 */
const toBackendStatus = (status?: Api.Tenant.TenantStatus): number =>
  status === '2' ? 0 : status === '3' ? 2 : 1

/** sys_tenant.plan_type：1 基础版 / 2 专业版 / 3 企业版（后端无套餐表，套餐 ID/名称沿用 Mock 套餐） */
const PLAN_TYPE_IDS: Record<number, string> = { 1: 'P001', 2: 'P002', 3: 'P003' }
const PLAN_TYPE_NAMES: Record<number, string> = { 1: '基础版', 2: '专业版', 3: '企业版' }
const PLAN_ID_TYPES: Record<string, number> = { P001: 1, P002: 2, P003: 3 }

/** 前端套餐 ID → 后端套餐类型（Mock 自建套餐无对应类型，回退基础版） */
const toPlanType = (planId?: string): number => (planId ? (PLAN_ID_TYPES[planId] ?? 1) : 1)

/** 后端租户 → 前端租户（storeNum 取接口门店数；productNum 后端按当前租户隔离无法统计，固定 0） */
function mapTenant(vo: BackendTenantVO, userNum = 0): Api.Tenant.TenantItem {
  const planType = vo.planType ?? 1
  return {
    id: String(vo.id ?? ''),
    name: vo.tenantName ?? '',
    code: vo.tenantNo ?? '',
    contact: vo.contactName ?? '',
    phone: vo.contactPhone ?? '',
    address: vo.address ?? '',
    status: toFrontendStatus(vo.status),
    planId: PLAN_TYPE_IDS[planType] ?? '',
    planName: PLAN_TYPE_NAMES[planType] ?? '',
    expireTime: vo.expireTime ?? '',
    storeNum: toNum(vo.storeCount),
    userNum,
    productNum: 0,
    createTime: vo.createTime ?? '',
    remark: vo.remark ?? ''
  }
}

/** 各租户用户数（GET /api/v1/system/users，系统管理员可见全部租户），失败时按 0 展示 */
async function fetchUserCountMap(): Promise<Map<string, number>> {
  const countMap = new Map<string, number>()
  try {
    const page = normalizePage(
      await api.get<PageLike<{ tenantId?: number | null }>>({
        url: '/api/v1/system/users',
        params: { page: 1, pageSize: 1000 }
      })
    )
    for (const item of page?.list ?? []) {
      if (!item.tenantId) continue
      const key = String(item.tenantId)
      countMap.set(key, (countMap.get(key) ?? 0) + 1)
    }
  } catch {
    /* 用户数统计失败时按 0 展示 */
  }
  return countMap
}

/** 获取租户详情 VO（后端业务失败已由 http 层抛出，此处兜底空数据） */
async function fetchTenantVO(id: string | number): Promise<BackendTenantVO> {
  const vo = await api.get<BackendTenantVO | null>({ url: `/api/v1/admin/tenants/${id}` })
  if (!vo) throw new Error('租户不存在')
  return vo
}

/** 后端租户提交体（TenantCreateDTO） */
function buildTenantBody(data: Partial<Api.Tenant.TenantItem>) {
  return {
    tenantName: (data.name ?? '').trim(),
    contactName: data.contact ?? '',
    contactPhone: data.phone ?? '',
    address: data.address ?? '',
    planType: toPlanType(data.planId),
    expireTime: data.expireTime ? data.expireTime.slice(0, 10) : undefined,
    remark: data.remark
  }
}

/* ------------------------------ 租户 ------------------------------ */

/**
 * 租户列表（GET /api/v1/admin/tenants）
 * 后端列表仅支持分页，名称/编码/状态/套餐条件改为拉取后本地过滤分页
 */
export function fetchTenantList(
  params: Api.Tenant.TenantSearchParams
): Promise<Api.Tenant.TenantList> {
  return callWithFallback(
    async () => {
      const useLocalFilter = Boolean(
        params.name?.trim() || params.code?.trim() || params.status || params.planId
      )
      const [page, userCounts] = await Promise.all([
        api.get<PageLike<BackendTenantVO>>({
          url: '/api/v1/admin/tenants',
          params: useLocalFilter ? { page: 1, pageSize: 1000 } : toBackendPage(params)
        }),
        fetchUserCountMap()
      ])
      const normalized = normalizePage(page)
      const mapper = (vo: BackendTenantVO) => mapTenant(vo, userCounts.get(String(vo.id)) ?? 0)

      if (!useLocalFilter) return toPaginated(normalized, mapper)

      const current = Math.max(1, Number(params.current) || 1)
      const size = Math.max(1, Number(params.size) || 20)
      const filtered = (normalized?.list ?? [])
        .map(mapper)
        .filter(
          (item) =>
            matchKeyword(item.name, params.name) &&
            matchKeyword(item.code, params.code) &&
            (!params.status || item.status === params.status) &&
            (!params.planId || item.planId === params.planId)
        )
      const start = (current - 1) * size
      return toPaginated<Api.Tenant.TenantItem>({
        list: filtered.slice(start, start + size),
        total: filtered.length,
        page: current,
        pageSize: size
      })
    },
    () => tenantService.fetchTenantList(params)
  )
}

/** 租户详情（GET /api/v1/admin/tenants/{id}） */
export function fetchTenantDetail(id: string): Promise<Api.Tenant.TenantItem> {
  return callWithFallback(
    async () => {
      const [vo, userCounts] = await Promise.all([fetchTenantVO(id), fetchUserCountMap()])
      return mapTenant(vo, userCounts.get(String(vo.id)) ?? 0)
    },
    () => tenantService.fetchTenantDetail(id)
  )
}

/** 新增租户（POST /api/v1/admin/tenants，返回 id 后回查详情） */
export function fetchCreateTenant(
  data: Partial<Api.Tenant.TenantItem>
): Promise<Api.Tenant.TenantItem> {
  return callWithFallback(
    async () => {
      const id = await api.post<number>({
        url: '/api/v1/admin/tenants',
        data: buildTenantBody(data)
      })
      const item = mapTenant(await fetchTenantVO(id))
      // 后端新增固定为「正常」，非正常状态需单独调用状态接口
      if (data.status && data.status !== '1') {
        await api.put({
          url: withQuery(`/api/v1/admin/tenants/${id}/status`, {
            status: toBackendStatus(data.status)
          })
        })
        item.status = data.status
      }
      return item
    },
    () => tenantService.fetchCreateTenant(data)
  )
}

/** 编辑租户（PUT /api/v1/admin/tenants/{id}，状态由独立接口维护） */
export function fetchUpdateTenant(
  data: Partial<Api.Tenant.TenantItem>
): Promise<Api.Tenant.TenantItem> {
  return callWithFallback(
    async () => {
      const id = data.id ?? ''
      await api.put({ url: `/api/v1/admin/tenants/${id}`, data: buildTenantBody(data) })
      if (data.status) {
        await api.put({
          url: withQuery(`/api/v1/admin/tenants/${id}/status`, {
            status: toBackendStatus(data.status)
          })
        })
      }
      const [vo, userCounts] = await Promise.all([fetchTenantVO(id), fetchUserCountMap()])
      return mapTenant(vo, userCounts.get(String(vo.id)) ?? 0)
    },
    () => tenantService.fetchUpdateTenant(data)
  )
}

/** 删除租户（DELETE /api/v1/admin/tenants/{id}，后端逻辑删除、不做级联清理） */
export function fetchDeleteTenant(id: string): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/admin/tenants/${id}` }),
    () => tenantService.fetchDeleteTenant(id)
  )
}

/** 租户下拉选项（后端无下拉接口，复用列表接口取全量并仅保留正常租户，同 mock 口径） */
export function fetchTenantOptions(): Promise<Api.Tenant.TenantOption[]> {
  return callWithFallback(
    async () => {
      const page = normalizePage(
        await api.get<PageLike<BackendTenantVO>>({
          url: '/api/v1/admin/tenants',
          params: { page: 1, pageSize: 1000 }
        })
      )
      return (page?.list ?? [])
        .filter((vo) => toFrontendStatus(vo.status) === '1')
        .map((vo) => ({
          id: String(vo.id ?? ''),
          name: vo.tenantName ?? '',
          code: vo.tenantNo ?? '',
          status: '1' as const
        }))
    },
    () => tenantService.fetchTenantOptions()
  )
}

/* ------------------------------ 套餐（后端无对应接口，保留本地 Mock） ------------------------------ */

/** 套餐列表（后端无套餐表/接口，套餐仅体现为 sys_tenant.plan_type 字段） */
export function fetchPlanList(params: Api.Tenant.PlanSearchParams): Promise<Api.Tenant.PlanList> {
  return tenantService.fetchPlanList(params)
}

/** 新增套餐（后端无对应接口，保留本地 Mock） */
export function fetchCreatePlan(data: Partial<Api.Tenant.PlanItem>): Promise<Api.Tenant.PlanItem> {
  return tenantService.fetchCreatePlan(data)
}

/** 编辑套餐（后端无对应接口，保留本地 Mock） */
export function fetchUpdatePlan(data: Partial<Api.Tenant.PlanItem>): Promise<Api.Tenant.PlanItem> {
  return tenantService.fetchUpdatePlan(data)
}

/** 重置演示数据（仅重置本地 Mock 数据，后端无对应接口） */
export function fetchResetDemoData(): Promise<void> {
  return tenantService.fetchResetDemoData()
}

/* ------------------------------ 平台统计（系统管理员工作台） ------------------------------ */

/** 后端平台统计返回结构（GET /api/v1/admin/tenants/stats） */
interface BackendPlatformStats {
  totalTenants?: number
  activeTenants?: number
  totalStores?: number
  totalUsers?: number
  planTypeDistribution?: Array<{ planType: number; count: number }>
  statusDistribution?: Array<{ status: number; count: number }>
  monthlyTrend?: Array<{ month: string; count: number }>
  expiringTenants?: Array<{
    id: number
    tenantName: string
    expireTime?: string
    planType?: number
  }>
}

/**
 * 平台统计（GET /api/v1/admin/tenants/stats）
 * 供系统管理员工作台展示：租户/门店/用户汇总、套餐与状态分布、开通趋势、临期租户
 */
export function fetchPlatformStats(): Promise<Api.Platform.Stats> {
  return callWithFallback(
    async () => {
      const data = await api.get<BackendPlatformStats>({ url: '/api/v1/admin/tenants/stats' })
      const toNum = (value?: number | null) => Number(value) || 0
      const planName = (type?: number | null) => PLAN_TYPE_NAMES[type ?? 1] ?? '基础版'
      const statusName = (status?: number | null) =>
        status === 0 ? '停用' : status === 2 ? '已到期' : '正常'

      return {
        totalTenants: toNum(data.totalTenants),
        activeTenants: toNum(data.activeTenants),
        totalStores: toNum(data.totalStores),
        totalUsers: toNum(data.totalUsers),
        planTypeDistribution: (data.planTypeDistribution ?? []).map((item) => ({
          name: planName(item.planType),
          count: toNum(item.count)
        })),
        statusDistribution: (data.statusDistribution ?? []).map((item) => ({
          name: statusName(item.status),
          count: toNum(item.count)
        })),
        monthlyTrend: (data.monthlyTrend ?? []).map((item) => ({
          month: item.month ?? '',
          count: toNum(item.count)
        })),
        expiringTenants: (data.expiringTenants ?? []).map((item) => ({
          id: String(item.id ?? ''),
          tenantName: item.tenantName ?? '',
          expireTime: item.expireTime ?? '',
          planType: planName(item.planType)
        }))
      }
    },
    () => tenantService.fetchPlatformStats()
  )
}

/* ------------------------------ 品牌门店（sys_store） ------------------------------ */

/** 后端门店（GET /api/v1/admin/stores → Result<StoreVO>） */
interface BackendStoreVO {
  id: number
  tenantId?: number
  storeNo?: string
  storeName?: string
  address?: string | null
  contactPhone?: string | null
  managerId?: number | null
  storeType?: number | null
  businessHours?: string | null
  status?: number | null
  sort?: number | null
  remark?: string | null
  createTime?: string
}

/** 后端门店状态 1 营业 / 0 装修 / 2 暂停 / 3 关闭 → 前端 '1'/'2'/'3'/'4' */
const storeStatusToFrontend = (status?: number | null): Api.Tenant.StoreStatus =>
  status === 1 ? '1' : status === 0 ? '2' : status === 2 ? '3' : '4'

/** 前端门店状态 → 后端 */
const storeStatusToBackend = (status?: Api.Tenant.StoreStatus): number =>
  status === '2' ? 0 : status === '3' ? 2 : status === '4' ? 3 : 1

/** 后端门店 → 前端门店 */
function mapStore(vo: BackendStoreVO, tenantNameMap: Map<string, string>): Api.Tenant.StoreItem {
  return {
    id: String(vo.id ?? ''),
    tenantId: String(vo.tenantId ?? ''),
    tenantName: tenantNameMap.get(String(vo.tenantId ?? '')) ?? '',
    storeNo: vo.storeNo ?? '',
    storeName: vo.storeName ?? '',
    address: vo.address ?? '',
    contactPhone: vo.contactPhone ?? '',
    managerId: vo.managerId != null ? String(vo.managerId) : undefined,
    storeType: (vo.storeType === 2 ? '2' : '1') as Api.Tenant.StoreType,
    businessHours: vo.businessHours ?? '',
    status: storeStatusToFrontend(vo.status),
    sort: vo.sort ?? 0,
    remark: vo.remark ?? '',
    createTime: vo.createTime ?? ''
  }
}

/** 租户 id → 租户名 映射（用于门店列表回填所属客户），60 秒缓存 */
let tenantNameCache: { at: number; map: Map<string, string> } | null = null

async function loadTenantNameMap(): Promise<Map<string, string>> {
  if (tenantNameCache && Date.now() - tenantNameCache.at < 60_000) return tenantNameCache.map
  const page = normalizePage(
    await api.get<PageLike<BackendTenantVO>>({
      url: '/api/v1/admin/tenants',
      params: { page: 1, pageSize: 500 }
    })
  )
  const map = new Map<string, string>()
  ;(page?.list ?? []).forEach((t) => {
    if (t.id != null) map.set(String(t.id), t.tenantName ?? '')
  })
  tenantNameCache = { at: Date.now(), map }
  return map
}

/**
 * 品牌门店列表（GET /api/v1/admin/stores）
 * 系统管理员可传 tenantId 过滤（不传查全部）；业务用户按当前租户返回
 */
export function fetchStoreList(
  params: Api.Tenant.StoreSearchParams
): Promise<Api.Tenant.StoreList> {
  return callWithFallback(
    async () => {
      const [page, tenantNames] = await Promise.all([
        api.get<PageLike<BackendStoreVO>>({
          url: '/api/v1/admin/stores',
          params: {
            // 门店管理为平台场景：未指定租户时显式查全租户（系统管理员跨租户管理）；
            // 收银台不传 all，后端会默认收敛到当前租户，二者互不影响
            ...(params.tenantId ? { tenantId: Number(params.tenantId) } : { all: true }),
            ...toBackendPage(params)
          }
        }),
        loadTenantNameMap()
      ])
      return toPaginated(normalizePage(page), (vo) => mapStore(vo, tenantNames))
    },
    () => tenantService.fetchStoreList(params)
  )
}

/** 品牌门店详情（GET /api/v1/admin/stores/{id}） */
export function fetchStoreDetail(id: string): Promise<Api.Tenant.StoreItem> {
  return callWithFallback(
    async () => {
      const [vo, tenantNames] = await Promise.all([
        api.get<BackendStoreVO>({ url: `/api/v1/admin/stores/${id}` }),
        loadTenantNameMap()
      ])
      if (!vo) throw new Error('门店不存在')
      return mapStore(vo, tenantNames)
    },
    () => tenantService.fetchStoreDetail(id)
  )
}

/** 新增门店（POST /api/v1/admin/stores），返回 id 后回查详情 */
export function fetchCreateStore(
  data: Partial<Api.Tenant.StoreForm>
): Promise<Api.Tenant.StoreItem> {
  return callWithFallback(
    async () => {
      const body: Record<string, unknown> = {
        storeName: (data.storeName ?? '').trim(),
        address: data.address || '',
        contactPhone: data.contactPhone || '',
        storeType: data.storeType ? Number(data.storeType) : undefined,
        businessHours: data.businessHours || '',
        sort: data.sort,
        remark: data.remark,
        // 系统管理员新增时可指定归属租户
        tenantId: data.tenantId ? Number(data.tenantId) : undefined
      }
      const id = await api.post<number>({ url: '/api/v1/admin/stores', data: body })
      return fetchStoreDetail(String(id))
    },
    () => tenantService.fetchCreateStore(data)
  )
}

/** 编辑门店（PUT /api/v1/admin/stores/{id}） */
export function fetchUpdateStore(
  data: Partial<Api.Tenant.StoreForm>
): Promise<Api.Tenant.StoreItem> {
  return callWithFallback(
    async () => {
      const id = data.id ?? ''
      const body: Record<string, unknown> = {
        storeName: (data.storeName ?? '').trim(),
        address: data.address || '',
        contactPhone: data.contactPhone || '',
        storeType: data.storeType ? Number(data.storeType) : undefined,
        businessHours: data.businessHours || '',
        sort: data.sort,
        remark: data.remark
      }
      await api.put({ url: `/api/v1/admin/stores/${id}`, data: body })
      return fetchStoreDetail(id)
    },
    () => tenantService.fetchUpdateStore(data)
  )
}

/** 修改门店状态（PUT /api/v1/admin/stores/{id}/status?status=） */
export function fetchUpdateStoreStatus(id: string, status: Api.Tenant.StoreStatus): Promise<void> {
  return callWithFallback(
    () =>
      api.put({
        url: withQuery(`/api/v1/admin/stores/${id}/status`, {
          status: storeStatusToBackend(status)
        })
      }),
    () => tenantService.fetchUpdateStoreStatus(id, status)
  )
}

/** 删除门店（DELETE /api/v1/admin/stores/{id}） */
export function fetchDeleteStore(id: string): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/admin/stores/${id}` }),
    () => tenantService.fetchDeleteStore(id)
  )
}
