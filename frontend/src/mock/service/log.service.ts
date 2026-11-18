/**
 * 日志服务（操作日志 / 登录日志 Mock，种子数据懒生成 + 本地筛选分页）
 */
import { getDb } from './core/db'
import { delay, formatDateTime, includesKeyword, paginate, pick, randInt } from './core/helpers'
import { useTenantStore } from '@/store/modules/tenant'

const currentTid = (): string => useTenantStore().currentId

const OPERATION_MODULES = [
  '商品管理',
  '商品分类',
  '库存管理',
  '订单管理',
  '会员管理',
  '用户管理',
  '角色管理',
  '菜单管理',
  '租户管理',
  '门店管理',
  '品牌管理',
  '供应商管理',
  '支付账户'
] as const

const OPERATION_NAMES: Record<string, string[]> = {
  商品管理: ['新增商品', '修改商品', '删除商品', '更新商品状态'],
  商品分类: ['新增分类', '修改分类', '删除分类'],
  库存管理: ['创建采购入库单', '审核采购入库单', '创建出库单', '确认出库', '库存调整', '完成盘点'],
  订单管理: ['取消订单', '完成订单', '订单退款', '删除订单', '修改订单备注'],
  会员管理: ['新增会员', '修改会员', '删除会员', '会员充值'],
  用户管理: ['新增用户', '修改用户', '删除用户', '重置密码', '模拟登录'],
  角色管理: ['新增角色', '修改角色', '删除角色'],
  菜单管理: ['新增菜单', '修改菜单', '删除菜单'],
  租户管理: ['新增租户', '修改租户', '删除租户', '修改租户状态'],
  门店管理: ['新增门店', '修改门店', '删除门店'],
  品牌管理: ['新增品牌', '修改品牌', '删除品牌'],
  供应商管理: ['新增供应商', '修改供应商', '删除供应商'],
  支付账户: ['新增支付账户', '修改支付账户', '删除支付账户', '调整支付账户余额']
}

const IPS = ['192.168.1.108', '192.168.1.115', '10.0.12.36', '172.16.8.21', '127.0.0.1']
const BROWSERS = ['Chrome', 'Edge', 'Firefox', 'Safari']
const SYSTEMS = ['Windows', 'macOS', 'Linux']

let operationLogCache: Api.Log.OperationLogItem[] | null = null
let loginLogCache: Api.Log.LoginLogItem[] | null = null

/** 生成操作日志种子（近 30 天，覆盖当前租户与系统管理员视角的多租户） */
const buildOperationLogs = (): Api.Log.OperationLogItem[] => {
  if (operationLogCache) return operationLogCache
  const db = getDb()
  const tenantIds = db.tenants.length ? db.tenants.map((t) => t.id) : [currentTid()]
  const usernames = db.users.map((u) => u.userName).filter(Boolean)
  const list: Api.Log.OperationLogItem[] = []

  for (let i = 0; i < 86; i++) {
    const module = pick(OPERATION_MODULES)
    const operation = pick(OPERATION_NAMES[module] ?? ['操作'])
    const status = i % 9 === 0 ? 0 : 1
    const failed = status === 0
    const description =
      operation === '模拟登录' && !failed
        ? `模拟登录用户「${pick(usernames.length ? usernames : ['admin'])}」`
        : undefined
    const tid = pick(tenantIds)
    list.push({
      id: `OPL_${i + 1}`,
      tenantId: tid,
      tenantName: db.tenants.find((t) => t.id === tid)?.name,
      module,
      operation,
      description,
      method: `${module.replace(/管理|分类/, '')}Controller.${i % 3 === 0 ? 'create' : i % 3 === 1 ? 'update' : 'delete'}(..)`,
      url: `/api/v1/${module === '支付账户' ? 'payment-methods' : 'demo'}/`,
      status,
      errorMsg: failed ? '操作失败：数据校验不通过' : undefined,
      params: JSON.stringify(
        { id: `G00${i + 1}`, name: `${module}示例数据`, operator: '页面操作' },
        null,
        2
      ),
      result: failed
        ? JSON.stringify({ code: 400, message: '数据校验不通过' }, null, 2)
        : JSON.stringify({ code: 200, message: '操作成功' }, null, 2),
      ip: pick(IPS),
      userId: undefined,
      username: pick(usernames.length ? usernames : ['admin']),
      duration: randInt(8, 460),
      createTime: formatDateTime(Date.now() - randInt(0, 30) * 86400000 - randInt(0, 86400000))
    })
  }
  operationLogCache = list.sort((a, b) => b.createTime.localeCompare(a.createTime))
  return operationLogCache
}

/** 生成登录日志种子（近 30 天） */
const buildLoginLogs = (): Api.Log.LoginLogItem[] => {
  if (loginLogCache) return loginLogCache
  const db = getDb()
  const tenantIds = db.tenants.length ? db.tenants.map((t) => t.id) : [currentTid()]
  const usernames = db.users.map((u) => u.userName).filter(Boolean)
  const list: Api.Log.LoginLogItem[] = []

  for (let i = 0; i < 64; i++) {
    const status = i % 7 === 0 ? 0 : 1
    const failed = status === 0
    const tid = pick(tenantIds)
    list.push({
      id: `LGL_${i + 1}`,
      tenantId: tid,
      tenantName: db.tenants.find((t) => t.id === tid)?.name,
      userId: undefined,
      username: failed ? 'unknown_user' : pick(usernames.length ? usernames : ['admin']),
      loginType: i % 8 === 3 ? 2 : 1,
      loginIp: pick(IPS),
      browser: pick(BROWSERS),
      os: pick(SYSTEMS),
      status,
      msg: failed ? '用户名或密码错误' : '登录成功',
      loginTime: formatDateTime(Date.now() - randInt(0, 30) * 86400000 - randInt(0, 86400000))
    })
  }
  loginLogCache = list.sort((a, b) => b.loginTime.localeCompare(a.loginTime))
  return loginLogCache
}

/** 操作日志列表（仅当前租户，本地筛选分页） */
export async function fetchOperationLogList(
  params: Api.Log.OperationSearchParams
): Promise<Api.Log.OperationLogList> {
  await delay()
  const tenantId = currentTid()
  const startDate = params.startDate ?? ''
  const endDate = params.endDate ?? ''
  const list = buildOperationLogs()
    .filter((item) => item.tenantId === tenantId)
    .filter((item) => includesKeyword(item.module, params.module))
    .filter((item) => includesKeyword(item.username, params.username))
    .filter((item) => params.status == null || item.status === params.status)
    .filter((item) => !startDate || item.createTime.slice(0, 10) >= startDate)
    .filter((item) => !endDate || item.createTime.slice(0, 10) <= endDate)
  return paginate(list, params)
}

/** 登录日志列表（仅当前租户，本地筛选分页） */
export async function fetchLoginLogList(
  params: Api.Log.LoginSearchParams
): Promise<Api.Log.LoginLogList> {
  await delay()
  const tenantId = currentTid()
  const startDate = params.startDate ?? ''
  const endDate = params.endDate ?? ''
  const list = buildLoginLogs()
    .filter((item) => item.tenantId === tenantId)
    .filter((item) => includesKeyword(item.username, params.username))
    .filter((item) => params.status == null || item.status === params.status)
    .filter((item) => params.loginType == null || item.loginType === params.loginType)
    .filter((item) => !startDate || item.loginTime.slice(0, 10) >= startDate)
    .filter((item) => !endDate || item.loginTime.slice(0, 10) <= endDate)
  return paginate(list, params)
}

/** 清理操作日志（beforeDate 为空表示清空全部），返回删除条数 */
export async function clearOperationLogList(params: Api.Log.ClearLogParams): Promise<number> {
  await delay()
  const list = buildOperationLogs()
  const before = params.beforeDate
  const keep = before ? list.filter((item) => item.createTime.slice(0, 10) >= before) : []
  operationLogCache = keep
  return list.length - keep.length
}

/** 清理登录日志（beforeDate 为空表示清空全部），返回删除条数 */
export async function clearLoginLogList(params: Api.Log.ClearLogParams): Promise<number> {
  await delay()
  const list = buildLoginLogs()
  const before = params.beforeDate
  const keep = before ? list.filter((item) => item.loginTime.slice(0, 10) >= before) : []
  loginLogCache = keep
  return list.length - keep.length
}
