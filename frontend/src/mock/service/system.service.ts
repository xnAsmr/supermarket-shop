/**
 * 系统管理服务（用户 / 角色 / 菜单树）
 */
import avatarDefault from '@/assets/images/avatar/avatar.webp'
import { getDb, persistDb, nextSerial, type SystemUser } from './core/db'
import { delay, formatDateTime, includesKeyword, paginate } from './core/helpers'
import { fail } from './core/result'
import type { AppRouteRecord } from '@/types/router'
import { useTenantStore } from '@/store/modules/tenant'

const currentTid = (): string => useTenantStore().currentId

const DEFAULT_BUTTONS: Record<string, string[]> = {
  R_SUPER: ['add', 'edit', 'delete', 'export', 'resetpwd', 'recharge', 'settings'],
  R_ADMIN: ['add', 'edit', 'delete', 'export', 'resetpwd', 'recharge', 'settings'],
  R_USER: []
}

/** 角色编码 → 角色名称（用于用户列表展示角色名称） */
const roleCodeToName = (db: ReturnType<typeof getDb>, codes: string[]): string[] => {
  const codeToName = new Map<string, string>()
  db.roles.forEach((role) => {
    if (role.roleCode) codeToName.set(role.roleCode, role.roleName)
  })
  return codes
    .map((code) => codeToName.get(code) ?? code)
    .filter((name, index, arr) => arr.indexOf(name) === index)
}

/** 返回不包含密码字段的用户 */
const toPublicUser = (
  user: SystemUser,
  db: ReturnType<typeof getDb>
): Api.SystemManage.UserListItem => {
  const copy = { ...user } as Partial<SystemUser>
  delete copy.password
  const result = copy as Api.SystemManage.UserListItem
  result.userRoleNames = roleCodeToName(db, user.userRoles || [])
  return result
}

/** 系统用户列表（仅当前租户） */
export async function fetchSystemUserList(
  params: Api.SystemManage.UserSearchParams
): Promise<Api.SystemManage.UserList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const list = db.users
    .filter(
      (u) =>
        u.tenantId === tenantId &&
        (!params.tenantId || u.tenantId === String(params.tenantId)) &&
        includesKeyword(u.userName, params.userName) &&
        includesKeyword(u.userPhone, params.userPhone) &&
        includesKeyword(u.userEmail, params.userEmail) &&
        (!params.userGender || u.userGender === params.userGender) &&
        (!params.status || u.status === params.status)
    )
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
    .map((user) => toPublicUser(user, db))
  return paginate(list, params)
}

/** 新增系统用户 */
export async function fetchCreateSystemUser(
  data: Partial<Api.SystemManage.UserListItem>
): Promise<Api.SystemManage.UserListItem> {
  await delay(180)
  const db = getDb()
  const tenantId = currentTid()
  const userName = (data.userName || '').trim()
  if (!userName) fail('请输入用户名')
  if (userName.length < 2 || userName.length > 20) fail('用户名长度需在 2-20 个字符之间')
  if (db.users.some((u) => u.userName.toLowerCase() === userName.toLowerCase())) {
    fail('该用户名已存在')
  }
  if (data.userPhone && !/^1[3-9]\d{9}$/.test(data.userPhone)) fail('手机号格式不正确')
  if (!data.userRoles?.length) fail('请选择角色')

  const user: SystemUser = {
    id: nextSerial(db, 'UID'),
    avatar: avatarDefault,
    status: data.status ?? '1',
    userName,
    userGender: data.userGender || '男',
    nickName: data.nickName || userName,
    realName: data.nickName || userName,
    userPhone: data.userPhone || '',
    userEmail: data.userEmail || '',
    userRoles: data.userRoles ?? [],
    password: '123456',
    tenantId,
    buttons: (data.userRoles ?? []).flatMap((role) => DEFAULT_BUTTONS[role] ?? []),
    createBy: '当前操作员',
    createTime: formatDateTime(),
    updateBy: '当前操作员',
    updateTime: formatDateTime()
  }
  db.users.push(user)
  persistDb()

  return toPublicUser(user, db)
}

/** 编辑系统用户 */
export async function fetchUpdateSystemUser(
  data: Partial<Api.SystemManage.UserListItem>
): Promise<Api.SystemManage.UserListItem> {
  await delay(160)
  const db = getDb()
  const tenantId = currentTid()
  const user = db.users.find((u) => u.id === Number(data.id) && u.tenantId === tenantId)
  if (!user) fail('用户不存在')

  const userName = (data.userName || '').trim()
  if (!userName) fail('请输入用户名')
  if (userName.length < 2 || userName.length > 20) fail('用户名长度需在 2-20 个字符之间')
  if (
    db.users.some((u) => u.id !== user.id && u.userName.toLowerCase() === userName.toLowerCase())
  ) {
    fail('该用户名已存在')
  }
  if (data.userPhone && !/^1[3-9]\d{9}$/.test(data.userPhone)) fail('手机号格式不正确')
  if (!data.userRoles?.length) fail('请选择角色')

  user.userName = userName
  user.userGender = data.userGender || user.userGender
  user.nickName = data.nickName || userName
  user.realName = data.nickName || userName
  user.userPhone = data.userPhone ?? user.userPhone
  user.userEmail = data.userEmail ?? user.userEmail
  user.userRoles = data.userRoles ?? user.userRoles
  user.status = data.status ?? user.status
  user.buttons = user.userRoles.flatMap((role) => DEFAULT_BUTTONS[role] ?? [])
  user.updateBy = '当前操作员'
  user.updateTime = formatDateTime()
  persistDb()

  return toPublicUser(user, db)
}

/** 删除系统用户 */
export async function fetchDeleteSystemUser(id: number): Promise<void> {
  await delay(140)
  const db = getDb()
  const tenantId = currentTid()
  const user = db.users.find((u) => u.id === id && u.tenantId === tenantId)
  if (!user) fail('用户不存在')
  if (user.userRoles.includes('R_SUPER')) fail('内置超管账号不允许删除')
  db.users = db.users.filter((u) => u.id !== id)
  persistDb()
}

/** 重置系统用户密码（重置为默认密码 123456） */
export async function fetchResetSystemUserPassword(id: number): Promise<void> {
  await delay(140)
  const db = getDb()
  const tenantId = currentTid()
  const user = db.users.find((u) => u.id === id && u.tenantId === tenantId)
  if (!user) fail('用户不存在')
  user.password = '123456'
  user.updateBy = '当前操作员'
  user.updateTime = formatDateTime()
  persistDb()
}

/* ------------------------------ 角色 ------------------------------ */

/** 角色列表（全局角色 + 当前租户用户数） */
export async function fetchRoleList(
  params: Api.SystemManage.RoleSearchParams
): Promise<Api.SystemManage.RoleList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const list = db.roles
    .map((role) => ({
      ...role,
      userNum: db.users.filter(
        (u) => u.tenantId === tenantId && u.userRoles.includes(role.roleCode)
      ).length
    }))
    .filter(
      (role) =>
        includesKeyword(role.roleName, params.roleName) &&
        includesKeyword(role.roleCode, params.roleCode) &&
        includesKeyword(role.description, params.description) &&
        (params.enabled === undefined || params.enabled === null || role.enabled === params.enabled)
    )
  return paginate(list, params)
}

/** 新增角色 */
export async function fetchCreateRole(
  data: Partial<Api.SystemManage.RoleListItem>
): Promise<Api.SystemManage.RoleListItem> {
  await delay(160)
  const db = getDb()
  const roleName = (data.roleName || '').trim()
  const roleCode = (data.roleCode || '').trim()
  if (!roleName) fail('请输入角色名称')
  if (!roleCode) fail('请输入角色标识')
  if (db.roles.some((r) => r.roleCode === roleCode)) fail('角色标识已存在')
  if (db.roles.some((r) => r.roleName === roleName)) fail('角色名称已存在')

  const role: Api.SystemManage.RoleListItem = {
    roleId: nextSerial(db, 'ROLE'),
    roleName,
    roleCode,
    description: data.description || '',
    enabled: data.enabled ?? true,
    userNum: 0,
    createTime: formatDateTime(),
    roleMenus: Array.isArray(data.roleMenus) ? [...data.roleMenus] : []
  }
  db.roles.push(role)
  persistDb()
  return role
}

/** 编辑角色 */
export async function fetchUpdateRole(
  data: Partial<Api.SystemManage.RoleListItem>
): Promise<Api.SystemManage.RoleListItem> {
  await delay(140)
  const db = getDb()
  const role = db.roles.find((r) => r.roleId === Number(data.roleId))
  if (!role) fail('角色不存在')

  const roleName = (data.roleName || '').trim()
  const roleCode = (data.roleCode || '').trim()
  if (!roleName) fail('请输入角色名称')
  if (!roleCode) fail('请输入角色标识')
  if (db.roles.some((r) => r.roleId !== role.roleId && r.roleCode === roleCode))
    fail('角色标识已存在')
  if (db.roles.some((r) => r.roleId !== role.roleId && r.roleName === roleName))
    fail('角色名称已存在')

  role.roleName = roleName
  role.roleCode = roleCode
  role.description = data.description ?? role.description
  role.enabled = data.enabled ?? role.enabled
  if (Array.isArray(data.roleMenus)) {
    role.roleMenus = [...data.roleMenus]
  }
  persistDb()
  return role
}

/** 删除角色 */
export async function fetchDeleteRole(roleId: number): Promise<void> {
  await delay(140)
  const db = getDb()
  const role = db.roles.find((r) => r.roleId === roleId)
  if (!role) fail('角色不存在')
  if (['R_SUPER', 'R_ADMIN', 'R_USER'].includes(role.roleCode)) {
    fail('内置角色不允许删除')
  }
  if (db.users.some((u) => u.userRoles.includes(role.roleCode))) {
    fail('该角色下存在用户，无法删除')
  }
  db.roles = db.roles.filter((r) => r.roleId !== roleId)
  persistDb()
}

/* ------------------------------ 菜单 ------------------------------ */

/** 深拷贝菜单树 */
const cloneMenus = (): AppRouteRecord[] =>
  JSON.parse(JSON.stringify(getDb().menus)) as AppRouteRecord[]

/** 在菜单树中按 name 查找节点，返回节点与所在数组 */
const findMenuNode = (
  nodes: AppRouteRecord[],
  name: string
): { node: AppRouteRecord; list: AppRouteRecord[] } | null => {
  for (const node of nodes) {
    if (node.name === name) return { node, list: nodes }
    if (node.children?.length) {
      const found = findMenuNode(node.children, name)
      if (found) return found
    }
  }
  return null
}

/** 递归收集全部菜单 name */
const collectMenuNames = (nodes: AppRouteRecord[], into = new Set<string>()): Set<string> => {
  nodes.forEach((node) => {
    if (node.name) into.add(String(node.name))
    if (node.children?.length) collectMenuNames(node.children, into)
  })
  return into
}

/** 菜单树（读取持久化的 db.menus） */
export async function fetchMenuTree(): Promise<AppRouteRecord[]> {
  await delay(100)
  return cloneMenus()
}

/** 菜单新增/编辑提交载荷 */
export interface MenuUpsertPayload {
  /** 编辑时原菜单 name，用于定位节点 */
  originalName?: string
  /** 父级菜单 name，空/缺省表示顶级 */
  parentId?: string
  /** 路由 name（来自表格 label 字段） */
  name: string
  /** 显示标题（来自表格 name 字段） */
  title: string
  path: string
  component?: string
  icon?: string
  roles?: string[]
  sort?: number
  link?: string
  showTextBadge?: string
  activePath?: string
  isEnable?: boolean
  keepAlive?: boolean
  isHide?: boolean
  isIframe?: boolean
  showBadge?: boolean
  fixedTab?: boolean
  isHideTab?: boolean
  isFullPage?: boolean
}

/** 由载荷构建路由 meta */
const buildMenuMeta = (
  payload: MenuUpsertPayload,
  base?: AppRouteRecord
): AppRouteRecord['meta'] => ({
  ...base?.meta,
  title: payload.title,
  icon: payload.icon || '',
  roles: payload.roles ?? base?.meta.roles ?? [],
  sort: payload.sort ?? base?.meta.sort ?? 1,
  link: payload.link || '',
  showTextBadge: payload.showTextBadge || '',
  activePath: payload.activePath || '',
  isEnable: payload.isEnable ?? base?.meta.isEnable ?? true,
  keepAlive: payload.keepAlive ?? base?.meta.keepAlive ?? false,
  isHide: payload.isHide ?? base?.meta.isHide ?? false,
  isIframe: payload.isIframe ?? base?.meta.isIframe ?? false,
  showBadge: payload.showBadge ?? base?.meta.showBadge ?? false,
  fixedTab: payload.fixedTab ?? base?.meta.fixedTab ?? false,
  isHideTab: payload.isHideTab ?? base?.meta.isHideTab ?? false,
  isFullPage: payload.isFullPage ?? base?.meta.isFullPage ?? false,
  updateTime: formatDateTime()
})

/** 新增菜单（持久化到 db.menus） */
export async function fetchCreateMenu(payload: MenuUpsertPayload): Promise<AppRouteRecord> {
  await delay(160)
  const db = getDb()
  const name = (payload.name || '').trim()
  const title = (payload.title || '').trim()
  const path = (payload.path || '').trim()
  if (!title) fail('请输入菜单名称')
  if (!name) fail('请输入权限标识')
  if (!path) fail('请输入路由地址')
  if (collectMenuNames(db.menus).has(name)) fail('路由 name 已存在')

  const node: AppRouteRecord = { path, name, meta: buildMenuMeta(payload) }
  if (payload.component) node.component = payload.component

  if (payload.parentId) {
    const parent = findMenuNode(db.menus, payload.parentId)
    if (!parent) fail('父级菜单不存在')
    if (parent.node.meta?.isAuthButton) fail('不能在权限按钮下添加菜单')
    parent.node.children = parent.node.children ?? []
    parent.node.children.push(node)
  } else {
    db.menus.push(node)
  }
  persistDb()
  return JSON.parse(JSON.stringify(node)) as AppRouteRecord
}

/** 编辑菜单（按 originalName 定位，保留父子归属） */
export async function fetchUpdateMenu(payload: MenuUpsertPayload): Promise<AppRouteRecord> {
  await delay(160)
  const db = getDb()
  const originalName = (payload.originalName || '').trim()
  const found = findMenuNode(db.menus, originalName)
  if (!found) fail('菜单不存在')

  const name = (payload.name || '').trim()
  const title = (payload.title || '').trim()
  const path = (payload.path || '').trim()
  if (!title) fail('请输入菜单名称')
  if (!name) fail('请输入权限标识')
  if (!path) fail('请输入路由地址')
  if (name !== originalName && collectMenuNames(db.menus).has(name)) fail('路由 name 已存在')

  found.node.path = path
  found.node.name = name
  found.node.meta = buildMenuMeta(payload, found.node)
  if (payload.component !== undefined) found.node.component = payload.component
  persistDb()
  return JSON.parse(JSON.stringify(found.node)) as AppRouteRecord
}

/** 删除菜单（连同子级一并删除） */
export async function fetchDeleteMenu(name: string): Promise<void> {
  await delay(140)
  const db = getDb()
  const found = findMenuNode(db.menus, name)
  if (!found) fail('菜单不存在')
  found.list.splice(
    found.list.findIndex((n) => n.name === name),
    1
  )
  persistDb()
}

/** 权限按钮新增/编辑提交载荷 */
export interface MenuAuthUpsertPayload {
  /** 所属菜单 name */
  parentName: string
  /** 编辑时原权限标识 */
  originalAuthMark?: string
  title: string
  authMark: string
  sort?: number
}

/** 定位所属菜单并返回其 authList（调用方负责 persistDb） */
const locateAuthList = (
  parentName: string
): { menu: AppRouteRecord; authList: NonNullable<AppRouteRecord['meta']['authList']> } => {
  const db = getDb()
  const found = findMenuNode(db.menus, parentName)
  if (!found) fail('所属菜单不存在')
  found.node.meta.authList = found.node.meta.authList ?? []
  return { menu: found.node, authList: found.node.meta.authList }
}

/** 新增权限按钮（写入父菜单 meta.authList） */
export async function fetchCreateMenuAuth(
  payload: MenuAuthUpsertPayload
): Promise<AppRouteRecord[]> {
  await delay(160)
  const title = (payload.title || '').trim()
  const authMark = (payload.authMark || '').trim()
  if (!title) fail('请输入权限名称')
  if (!authMark) fail('请输入权限标识')
  const { menu, authList } = locateAuthList(payload.parentName)
  if (authList.some((a) => a.authMark === authMark)) fail('该权限标识已存在')
  authList.push({ title, authMark, sort: payload.sort ?? authList.length + 1 })
  menu.meta.updateTime = formatDateTime()
  persistDb()
  return cloneMenus()
}

/** 编辑权限按钮 */
export async function fetchUpdateMenuAuth(
  payload: MenuAuthUpsertPayload
): Promise<AppRouteRecord[]> {
  await delay(160)
  const originalAuthMark = (payload.originalAuthMark || '').trim()
  const title = (payload.title || '').trim()
  const authMark = (payload.authMark || '').trim()
  if (!title) fail('请输入权限名称')
  if (!authMark) fail('请输入权限标识')
  const { menu, authList } = locateAuthList(payload.parentName)
  const target = authList.find((a) => a.authMark === originalAuthMark)
  if (!target) fail('权限不存在')
  if (authMark !== originalAuthMark && authList.some((a) => a.authMark === authMark)) {
    fail('该权限标识已存在')
  }
  target.title = title
  target.authMark = authMark
  target.sort = payload.sort ?? target.sort
  menu.meta.updateTime = formatDateTime()
  persistDb()
  return cloneMenus()
}

/** 删除权限按钮 */
export async function fetchDeleteMenuAuth(
  parentName: string,
  authMark: string
): Promise<AppRouteRecord[]> {
  await delay(140)
  const db = getDb()
  const found = findMenuNode(db.menus, parentName)
  if (!found) fail('所属菜单不存在')
  const authList = found.node.meta.authList ?? []
  if (!authList.some((a) => a.authMark === authMark)) fail('权限不存在')
  found.node.meta.authList = authList.filter((a) => a.authMark !== authMark)
  found.node.meta.updateTime = formatDateTime()
  persistDb()
  return cloneMenus()
}
