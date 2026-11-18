import * as authService from '@/mock/service/auth.service'
import { api, callWithFallback } from './core/backend'

/** 后端登录返回（Result<LoginVO>） */
interface BackendLoginVO {
  token: string
  refreshToken: string
  expiresIn: number
  userInfo: {
    id: number
    username: string
    realName?: string
    role?: string
    avatar?: string
    phone?: string
    email?: string
    permissions?: string[]
  }
}

/** 后端用户画像（GET /system/users/profile） */
interface BackendProfile {
  id: number
  username: string
  name?: string
  phone?: string
  email?: string
  avatar?: string
  userType?: number
  roleName?: string
}

/** 登录后缓存的用户元信息（用于获取用户信息时组装按钮权限） */
const AUTH_META_KEY = 'sys-auth-meta'

interface AuthMeta {
  permissions: string[]
  role?: string
}

function saveAuthMeta(meta: AuthMeta) {
  try {
    localStorage.setItem(AUTH_META_KEY, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
}

function readAuthMeta(): AuthMeta | null {
  try {
    const raw = localStorage.getItem(AUTH_META_KEY)
    return raw ? (JSON.parse(raw) as AuthMeta) : null
  } catch {
    return null
  }
}

export function clearAuthMeta() {
  try {
    localStorage.removeItem(AUTH_META_KEY)
  } catch {
    /* ignore */
  }
}

/** 读取缓存的 auth-meta（供模拟登录/退出模拟保存与还原原始身份） */
export function getAuthMeta(): AuthMeta | null {
  return readAuthMeta()
}

/** 写入缓存的 auth-meta */
export function setAuthMeta(meta: AuthMeta): void {
  saveAuthMeta(meta)
}

/**
 * 后端权限串（pms:product:add）→ 前端按钮权限标识（add）
 * 与本地 Mock 的 buttons 结构保持一致
 */
function permissionsToButtons(permissions?: string[]): string[] {
  if (!permissions || permissions.length === 0) return []
  if (permissions.includes('*:*:*'))
    return ['add', 'edit', 'delete', 'export', 'resetpwd', 'recharge', 'settings']
  const marks = new Set<string>()
  for (const permission of permissions) {
    const segments = permission.split(':').filter(Boolean)
    const action = segments[segments.length - 1]
    if (action) marks.add(action)
  }
  return [...marks]
}

/**
 * 后端用户类型/角色 → 前端路由角色标识
 * userType: 1 普通 / 2 系统管理员 / 3 超级管理员
 * 超级管理员需继承全部前端路由角色，否则 R_ADMIN/R_USER 类菜单（商品/采购/收银/工作台等）会被过滤
 */
function resolveRoles(userType?: number, roleName?: string): string[] {
  if (userType === 3) return ['R_SUPER', 'R_ADMIN', 'R_USER']
  if (roleName && roleName.includes('收银')) return ['R_USER']
  if (userType === 1 && !roleName) return ['R_ADMIN']
  return ['R_ADMIN']
}

/**
 * 登录
 */
export function fetchLogin(params: Api.Auth.LoginParams): Promise<Api.Auth.LoginResponse> {
  return callWithFallback(
    () =>
      api
        .post<BackendLoginVO>({
          url: '/api/v1/auth/login',
          data: { username: params.userName, password: params.password }
        })
        .then((res) => {
          // 缓存权限信息，供 fetchGetUserInfo 组装按钮权限
          saveAuthMeta({
            permissions: res.userInfo?.permissions ?? [],
            role: res.userInfo?.role
          })
          return { token: res.token, refreshToken: res.refreshToken }
        }),
    () => authService.serviceLogin(params)
  )
}

/**
 * 开发环境调试账号列表（含归属租户/门店）。
 * 后端接口仅在 dev profile 下存在；非 dev 环境会 404，由调用方回退到本地兜底列表。
 * 不在此处做 mock 降级：本地 mock 用户与数据库用户不是同一套数据。
 */
export function fetchDevLoginAccounts(): Promise<Api.Auth.DevLoginAccount[]> {
  return api.get<Api.Auth.DevLoginAccount[]>({ url: '/api/v1/auth/dev/accounts' })
}

/**
 * 获取用户信息
 */
export function fetchGetUserInfo(): Promise<Api.Auth.UserInfo> {
  return callWithFallback(
    () =>
      api.get<BackendProfile>({ url: '/api/v1/system/users/profile' }).then((profile) => {
        const meta = readAuthMeta()
        const roleName = profile.roleName
        return {
          buttons: permissionsToButtons(meta?.permissions),
          roles: resolveRoles(profile.userType, roleName),
          userId: profile.id,
          userName: profile.username,
          realName: profile.name ?? profile.username,
          email: profile.email ?? '',
          avatar: profile.avatar,
          phone: profile.phone,
          tenantId: undefined
        }
      }),
    () => authService.serviceGetUserInfo()
  )
}

/**
 * 获取演示账号（本地 Mock 数据，后端无对应接口）
 */
export function fetchGetDemoAccounts(): Promise<Api.Auth.UserInfo[]> {
  return authService.serviceGetDemoAccounts()
}

/**
 * 模拟登录（系统管理员切换为指定用户身份，用于排查该用户权限/操作问题）
 * 后端：GET /api/v1/system/users/impersonate/{userId}
 */
export function fetchImpersonateLogin(userId: number): Promise<Api.Auth.LoginResponse> {
  return callWithFallback(
    () =>
      api.get<BackendLoginVO>({ url: `/api/v1/system/users/impersonate/${userId}` }).then((res) => {
        // 覆盖缓存为用户信息，切换后 fetchGetUserInfo 按目标用户权限组装按钮
        saveAuthMeta({
          permissions: res.userInfo?.permissions ?? [],
          role: res.userInfo?.role
        })
        return { token: res.token, refreshToken: res.refreshToken }
      }),
    () => authService.serviceImpersonate(userId)
  )
}

/**
 * 注册（本地 Mock 数据，后端暂无自助注册接口）
 */
export function fetchRegister(params: {
  userName: string
  password: string
  realName?: string
  email?: string
  phone?: string
}): Promise<{ userName: string }> {
  return authService.serviceRegister(params)
}
