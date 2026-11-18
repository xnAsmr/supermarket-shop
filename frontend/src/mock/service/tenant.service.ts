/**
 * 多租户（连锁品牌/门店）服务
 */
import { getDb, persistDb, nextSerial, resetMockDb, type MockDatabase } from './core/db'
import { delay, genId, formatDateTime, daysAgoStr, paginate, includesKeyword } from './core/helpers'
import { fail } from './core/result'
import avatarDefault from '@/assets/images/avatar/avatar.webp'
import { useTenantStore } from '@/store/modules/tenant'

const tid = () => useTenantStore().currentId

/** 清理某租户的全部业务数据 */
const removeTenantData = (db: MockDatabase, tenantId: string) => {
  db.categories = db.categories.filter((x) => x.tenantId !== tenantId)
  db.suppliers = db.suppliers.filter((x) => x.tenantId !== tenantId)
  db.products = db.products.filter((x) => x.tenantId !== tenantId)
  db.stocks = db.stocks.filter((x) => x.tenantId !== tenantId)
  db.warehouses = db.warehouses.filter((x) => x.tenantId !== tenantId)
  db.stores = db.stores.filter((x) => x.tenantId !== tenantId)
  db.stockDocs = db.stockDocs.filter((x) => x.tenantId !== tenantId)
  db.purchases = db.purchases.filter((x) => x.tenantId !== tenantId)
  db.purchaseOrders = db.purchaseOrders.filter((x) => x.tenantId !== tenantId)
  db.purchaseReceipts = db.purchaseReceipts.filter((x) => x.tenantId !== tenantId)
  db.purchaseReturns = db.purchaseReturns.filter((x) => x.tenantId !== tenantId)
  db.orders = db.orders.filter((x) => x.tenantId !== tenantId)
  db.returns = db.returns.filter((x) => x.tenantId !== tenantId)
  db.flows = db.flows.filter((x) => x.tenantId !== tenantId)
  db.dailies = db.dailies.filter((x) => x.tenantId !== tenantId)
  db.holds = db.holds.filter((x) => x.tenantId !== tenantId)
  db.users = db.users.filter((x) => x.tenantId !== tenantId)
}

/** 租户列表 */
export async function fetchTenantList(
  params: Api.Tenant.TenantSearchParams
): Promise<Api.Tenant.TenantList> {
  await delay()
  const db = getDb()
  const list = db.tenants.filter((t) => {
    return (
      includesKeyword(t.name, params.name) &&
      includesKeyword(t.code, params.code) &&
      (!params.status || t.status === params.status) &&
      (!params.planId || t.planId === params.planId)
    )
  })
  return paginate(list, params)
}

/** 租户详情 */
export async function fetchTenantDetail(id: string): Promise<Api.Tenant.TenantItem> {
  await delay(80)
  const tenant = getDb().tenants.find((t) => t.id === id)
  if (!tenant) fail('租户不存在或已被删除')
  return tenant
}

/** 新增租户（自动初始化默认仓库与基础分类） */
export async function fetchCreateTenant(
  data: Partial<Api.Tenant.TenantItem>
): Promise<Api.Tenant.TenantItem> {
  await delay(200)
  const db = getDb()
  const name = (data.name || '').trim()
  if (!name) fail('请输入租户名称')
  if (db.tenants.some((t) => t.name === name)) fail('该租户名称已存在')
  if ((data.code || '').trim() && db.tenants.some((t) => t.code === data.code)) {
    fail('租户编码已存在')
  }

  const serial = nextSerial(db, 'TEN')
  const id = `T${String(900 + serial)}`
  const plan = db.plans.find((p) => p.id === data.planId) ?? db.plans[0]

  const tenant: Api.Tenant.TenantItem = {
    id,
    name,
    code: (data.code || '').trim() || `TEN${serial}`,
    contact: data.contact || '',
    phone: data.phone || '',
    address: data.address || '',
    status: data.status ?? '1',
    planId: plan.id,
    planName: plan.name,
    expireTime: data.expireTime || daysAgoStr(-365),
    storeNum: 1,
    userNum: 1,
    productNum: 0,
    createTime: formatDateTime(),
    remark: data.remark || ''
  }
  db.tenants.push(tenant)

  // 默认仓库（POS 默认销售仓）
  db.warehouses.push(
    {
      id: genId('W'),
      tenantId: id,
      name: '默认卖场',
      code: `${tenant.code}-WH01`,
      address: tenant.address,
      status: '1',
      isDefault: true,
      stockNum: 0,
      stockValue: 0,
      createTime: formatDateTime()
    },
    {
      id: genId('W'),
      tenantId: id,
      name: '中央仓',
      code: `${tenant.code}-WH02`,
      address: tenant.address,
      status: '1',
      isDefault: false,
      stockNum: 0,
      stockValue: 0,
      createTime: formatDateTime()
    }
  )

  // 基础分类
  ;['粮油调味', '休闲零食', '饮料冲调', '日用百货'].forEach((catName, idx) => {
    db.categories.push({
      id: genId('C'),
      tenantId: id,
      parentId: null,
      name: catName,
      sort: (idx + 1) * 10,
      status: '1',
      productNum: 0,
      createTime: formatDateTime()
    })
  })

  // 管理员账号
  db.users.push({
    id: nextSerial(db, 'UID'),
    avatar: avatarDefault,
    status: '1',
    userName: tenant.code.toLowerCase(),
    userGender: '男',
    nickName: `${name}管理员`,
    realName: `${name}管理员`,
    userPhone: tenant.phone,
    userEmail: '',
    userRoles: ['R_ADMIN'],
    password: '123456',
    tenantId: id,
    buttons: ['add', 'edit', 'delete', 'export'],
    createBy: 'system',
    createTime: formatDateTime(),
    updateBy: 'system',
    updateTime: formatDateTime()
  })

  persistDb()
  return tenant
}

/** 编辑租户 */
export async function fetchUpdateTenant(
  data: Partial<Api.Tenant.TenantItem>
): Promise<Api.Tenant.TenantItem> {
  await delay(180)
  const db = getDb()
  const tenant = db.tenants.find((t) => t.id === data.id)
  if (!tenant) fail('租户不存在')

  const name = (data.name || '').trim()
  if (!name) fail('请输入租户名称')
  if (db.tenants.some((t) => t.name === name && t.id !== data.id)) fail('该租户名称已存在')

  const plan = db.plans.find((p) => p.id === data.planId)
  Object.assign(tenant, {
    name,
    code: (data.code || '').trim() || tenant.code,
    contact: data.contact ?? tenant.contact,
    phone: data.phone ?? tenant.phone,
    address: data.address ?? tenant.address,
    status: data.status ?? tenant.status,
    planId: plan ? plan.id : tenant.planId,
    planName: plan ? plan.name : tenant.planName,
    expireTime: data.expireTime ?? tenant.expireTime,
    remark: data.remark ?? tenant.remark
  })

  persistDb()
  return tenant
}

/** 删除租户（级联清理业务数据，禁止删除当前租户） */
export async function fetchDeleteTenant(id: string): Promise<void> {
  await delay(160)
  const db = getDb()
  if (id === tid()) fail('不能删除当前正在使用的租户，请先切换到其它租户')
  const idx = db.tenants.findIndex((t) => t.id === id)
  if (idx < 0) fail('租户不存在')

  db.tenants.splice(idx, 1)
  removeTenantData(db, id)
  persistDb()
}

/** 租户切换选项（顶栏切换器） */
export async function fetchTenantOptions(): Promise<Api.Tenant.TenantOption[]> {
  await delay(60)
  return getDb()
    .tenants.filter((t) => t.status === '1')
    .map((t) => ({ id: t.id, name: t.name, code: t.code, status: t.status }))
}

/** 套餐列表 */
export async function fetchPlanList(
  params: Api.Tenant.PlanSearchParams
): Promise<Api.Tenant.PlanList> {
  await delay()
  const db = getDb()
  const list = db.plans
    .map((p) => ({
      ...p,
      tenantNum: db.tenants.filter((t) => t.planId === p.id).length
    }))
    .filter(
      (p) => includesKeyword(p.name, params.name) && (!params.status || p.status === params.status)
    )
  return paginate(list, params)
}

/** 新增套餐 */
export async function fetchCreatePlan(
  data: Partial<Api.Tenant.PlanItem>
): Promise<Api.Tenant.PlanItem> {
  await delay(180)
  const db = getDb()
  const name = (data.name || '').trim()
  if (!name) fail('请输入套餐名称')
  if (db.plans.some((p) => p.name === name)) fail('套餐名称已存在')

  const plan: Api.Tenant.PlanItem = {
    id: genId('P'),
    name,
    price: Number(data.price) || 0,
    duration: Number(data.duration) || 365,
    userLimit: Number(data.userLimit) || 0,
    storeLimit: Number(data.storeLimit) || 0,
    productLimit: Number(data.productLimit) || 0,
    status: data.status ?? '1',
    desc: data.desc || '',
    tenantNum: 0,
    createTime: formatDateTime()
  }
  db.plans.push(plan)
  persistDb()
  return plan
}

/** 编辑套餐 */
export async function fetchUpdatePlan(
  data: Partial<Api.Tenant.PlanItem>
): Promise<Api.Tenant.PlanItem> {
  await delay(160)
  const db = getDb()
  const plan = db.plans.find((p) => p.id === data.id)
  if (!plan) fail('套餐不存在')
  const name = (data.name || '').trim()
  if (!name) fail('请输入套餐名称')
  if (db.plans.some((p) => p.name === name && p.id !== plan.id)) fail('套餐名称已存在')

  Object.assign(plan, {
    name,
    price: Number(data.price) || 0,
    duration: Number(data.duration) || plan.duration,
    userLimit: Number(data.userLimit) || plan.userLimit,
    storeLimit: Number(data.storeLimit) || plan.storeLimit,
    productLimit: Number(data.productLimit) || plan.productLimit,
    status: data.status ?? plan.status,
    desc: data.desc ?? plan.desc
  })
  persistDb()
  return plan
}

/** 恢复演示数据 */
export async function fetchResetDemoData(): Promise<void> {
  await delay(300)
  resetMockDb()
  useTenantStore().resetTenant()
}

/**
 * 平台统计（系统管理员工作台，本地 Mock 降级实现）
 * 后端对应接口：GET /api/v1/admin/tenants/stats
 */
export async function fetchPlatformStats(): Promise<Api.Platform.Stats> {
  await delay(200)
  const db = getDb()
  const tenants = db.tenants

  const planTypeDistribution: Api.Platform.StatItem[] = []
  const planCountMap = new Map<string, number>()
  const statusDistribution: Api.Platform.StatItem[] = []
  const statusCountMap = new Map<string, number>()

  for (const tenant of tenants) {
    const planName = db.plans.find((p) => p.id === tenant.planId)?.name || '未分配'
    planCountMap.set(planName, (planCountMap.get(planName) ?? 0) + 1)
    const status = tenant.status === '1' ? '正常' : tenant.status === '2' ? '停用' : '已到期'
    statusCountMap.set(status, (statusCountMap.get(status) ?? 0) + 1)
  }
  planCountMap.forEach((count, name) => planTypeDistribution.push({ name, count }))
  statusCountMap.forEach((count, name) => statusDistribution.push({ name, count }))

  // 近 6 个月租户开通趋势
  const monthlyTrend: Api.Platform.TrendItem[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const count = tenants.filter((t) => String(t.createTime || '').startsWith(prefix)).length
    monthlyTrend.push({ month: prefix, count })
  }

  // 30 天内到期租户
  const expireLimit = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiringTenants: Api.Platform.ExpiringTenant[] = tenants
    .filter((t) => {
      if (t.status !== '1' || !t.expireTime) return false
      const expire = new Date(t.expireTime.replace(/-/g, '/'))
      return expire >= now && expire <= expireLimit
    })
    .sort((a, b) => String(a.expireTime).localeCompare(String(b.expireTime)))
    .map((t) => ({
      id: t.id,
      tenantName: t.name,
      expireTime: t.expireTime,
      planType: db.plans.find((p) => p.id === t.planId)?.name || '-'
    }))

  return {
    totalTenants: tenants.length,
    activeTenants: tenants.filter((t) => t.status === '1').length,
    totalStores: tenants.reduce((sum, t) => sum + (Number(t.storeNum) || 0), 0),
    totalUsers: tenants.reduce((sum, t) => sum + (Number(t.userNum) || 0), 0),
    planTypeDistribution,
    statusDistribution,
    monthlyTrend,
    expiringTenants
  }
}

/* ------------------------------ 品牌门店（sys_store） ------------------------------ */

/** 门店列表（分页，可按 tenantId / storeName / status 过滤） */
export async function fetchStoreList(
  params: Api.Tenant.StoreSearchParams
): Promise<Api.Tenant.StoreList> {
  await delay()
  const db = getDb()
  let list = db.stores.filter(
    (s) =>
      (!params.tenantId || s.tenantId === params.tenantId) &&
      includesKeyword(s.storeName, params.storeName) &&
      (!params.status || s.status === params.status)
  )
  list = list.sort((a, b) => b.createTime.localeCompare(a.createTime))
  return paginate(list, params)
}

/** 门店详情 */
export async function fetchStoreDetail(id: string): Promise<Api.Tenant.StoreItem> {
  await delay(80)
  const store = getDb().stores.find((s) => s.id === id)
  if (!store) fail('门店不存在')
  return store
}

/** 新增门店（返回 id 后回查） */
export async function fetchCreateStore(
  data: Partial<Api.Tenant.StoreForm>
): Promise<Api.Tenant.StoreItem> {
  await delay(200)
  const db = getDb()
  const storeName = (data.storeName || '').trim()
  if (!storeName) fail('请输入门店名称')
  const tenantId = data.tenantId || tid()
  const tenant = db.tenants.find((t) => t.id === tenantId)
  if (!tenant) fail('租户不存在')

  const id = `S${Date.now()}`
  const store: Api.Tenant.StoreItem = {
    id,
    tenantId,
    tenantName: tenant.name,
    storeNo: `${tenant.code}-ST${String(db.stores.filter((s) => s.tenantId === tenantId).length + 1).padStart(2, '0')}`,
    storeName,
    address: data.address || '',
    contactPhone: data.contactPhone || '',
    storeType: data.storeType ?? '1',
    businessHours: data.businessHours || '',
    status: data.status ?? '1',
    sort: data.sort ?? 0,
    remark: data.remark || '',
    createTime: formatDateTime()
  }
  db.stores.push(store)
  // 同步租户门店数
  tenant.storeNum = db.stores.filter((s) => s.tenantId === tenantId).length
  persistDb()
  return store
}

/** 编辑门店 */
export async function fetchUpdateStore(
  data: Partial<Api.Tenant.StoreForm>
): Promise<Api.Tenant.StoreItem> {
  await delay(160)
  const db = getDb()
  const store = db.stores.find((s) => s.id === data.id)
  if (!store) fail('门店不存在')
  const storeName = (data.storeName || '').trim()
  if (!storeName) fail('请输入门店名称')

  Object.assign(store, {
    storeName,
    address: data.address ?? store.address,
    contactPhone: data.contactPhone ?? store.contactPhone,
    storeType: data.storeType ?? store.storeType,
    businessHours: data.businessHours ?? store.businessHours,
    sort: data.sort ?? store.sort,
    remark: data.remark ?? store.remark
  })
  persistDb()
  return store
}

/** 修改门店状态 */
export async function fetchUpdateStoreStatus(
  id: string,
  status: Api.Tenant.StoreStatus
): Promise<void> {
  await delay(120)
  const db = getDb()
  const store = db.stores.find((s) => s.id === id)
  if (!store) fail('门店不存在')
  store.status = status
  persistDb()
}

/** 删除门店 */
export async function fetchDeleteStore(id: string): Promise<void> {
  await delay(140)
  const db = getDb()
  const store = db.stores.find((s) => s.id === id)
  if (!store) fail('门店不存在')
  db.stores = db.stores.filter((s) => s.id !== id)
  // 同步租户门店数
  const tenant = db.tenants.find((t) => t.id === store.tenantId)
  if (tenant) {
    tenant.storeNum = db.stores.filter((s) => s.tenantId === tenant.id).length
  }
  persistDb()
}
