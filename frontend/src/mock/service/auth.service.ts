/**
 * 认证服务（本地 Mock 登录）
 */
import avatarDefault from '@/assets/images/avatar/avatar.webp'
import { getDb, persistDb, nextSerial, type SystemUser } from './core/db'
import { delay, formatDateTime } from './core/helpers'
import { fail } from './core/result'
import { useUserStore } from '@/store/modules/user'
import { useTenantStore } from '@/store/modules/tenant'

/** Mock 用户 → 用户信息 */
const toUserInfo = (user: SystemUser): Api.Auth.UserInfo => ({
  buttons: user.buttons ?? [],
  roles: user.userRoles,
  userId: user.id,
  userName: user.userName,
  realName: user.realName ?? user.nickName,
  email: user.userEmail,
  avatar: user.avatar,
  phone: user.userPhone,
  tenantId: user.tenantId,
  warehouseId: user.warehouseId,
  warehouseName: user.warehouseName
})

/** 从 token 中解析用户 ID */
const parseUserId = (token: string): number => {
  const matched = /^mock-token-(\d+)-\d+$/.exec(token || '')
  return matched ? Number(matched[1]) : 0
}

/** 后端测试账号 → 本地 Mock 演示账号（保证降级后仍可登录） */
const MOCK_ACCOUNT_ALIAS: Record<string, string> = {
  sysadmin: 'Super',
  linlin: 'Cashier'
}

/**
 * 登录
 */
export async function serviceLogin(params: Api.Auth.LoginParams): Promise<Api.Auth.LoginResponse> {
  await delay(240)
  const db = getDb()
  const rawName = (params.userName || '').trim()
  const alias = MOCK_ACCOUNT_ALIAS[rawName.toLowerCase()]
  const userName = alias ?? rawName
  const user = db.users.find((u) => u.userName.toLowerCase() === userName.toLowerCase())

  if (!user || user.password !== params.password) {
    fail('账号或密码错误')
  }
  if (user.status !== '1') {
    fail('该账号已被禁用，请联系管理员')
  }

  // 登录成功后自动定位到用户所属租户
  useTenantStore().switchTenant(user.tenantId)

  return {
    token: `mock-token-${user.id}-${Date.now()}`,
    refreshToken: `mock-refresh-${user.id}-${Date.now()}`
  }
}

/**
 * 模拟登录（切换为目标用户身份，本地 Mock 实现）
 */
export async function serviceImpersonate(userId: number): Promise<Api.Auth.LoginResponse> {
  await delay(200)
  const db = getDb()
  const user = db.users.find((u) => u.id === userId)
  if (!user) fail('用户不存在')
  if (user.status !== '1') {
    fail('该用户已被停用，无法模拟登录')
  }

  // 切换目标用户所属租户
  useTenantStore().switchTenant(user.tenantId)

  return {
    token: `mock-token-${user.id}-${Date.now()}`,
    refreshToken: `mock-refresh-${user.id}-${Date.now()}`
  }
}

/**
 * 获取当前登录用户信息
 */
export async function serviceGetUserInfo(): Promise<Api.Auth.UserInfo> {
  await delay(80)
  const userStore = useUserStore()
  const db = getDb()
  const userId = parseUserId(userStore.accessToken)
  const user = db.users.find((u) => u.id === userId)

  if (user) {
    return toUserInfo(user)
  }

  // 本地演示数据被重置等场景：回退到超管账号
  const fallback = db.users.find((u) => u.userName === 'Super')
  if (fallback) {
    return toUserInfo(fallback)
  }

  userStore.logOut()
  fail('登录状态已失效，请重新登录', 401)
}

/**
 * 获取可用的演示账号（登录页下拉使用）
 */
export async function serviceGetDemoAccounts(): Promise<Api.Auth.UserInfo[]> {
  await delay(60)
  const db = getDb()
  const names = ['Super', 'Admin', 'Cashier']
  return db.users.filter((u) => names.includes(u.userName) && u.tenantId === 'T001').map(toUserInfo)
}

/**
 * 注册（自助注册，默认收银员角色，归属当前租户）
 */
export async function serviceRegister(params: {
  userName: string
  password: string
  realName?: string
  email?: string
  phone?: string
}): Promise<{ userName: string }> {
  await delay(260)
  const db = getDb()
  const userName = (params.userName || '').trim()
  if (userName.length < 3 || userName.length > 20) fail('用户名长度需在 3-20 个字符之间')
  if (!params.password || params.password.length < 6) fail('密码长度不能少于 6 位')
  if (db.users.some((u) => u.userName.toLowerCase() === userName.toLowerCase())) {
    fail('该用户名已存在，请直接登录')
  }

  const user: SystemUser = {
    id: nextSerial(db, 'UID'),
    avatar: avatarDefault,
    status: '1',
    userName,
    userGender: '男',
    nickName: params.realName?.trim() || userName,
    realName: params.realName?.trim() || userName,
    userPhone: params.phone || '',
    userEmail: params.email || '',
    userRoles: ['R_USER'],
    password: params.password,
    tenantId: useTenantStore().currentId,
    buttons: [],
    createBy: '自助注册',
    createTime: formatDateTime(),
    updateBy: '自助注册',
    updateTime: formatDateTime()
  }
  db.users.push(user)
  persistDb()

  return { userName }
}
