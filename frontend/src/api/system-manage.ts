/**
 * 系统管理 API（用户 / 角色 / 菜单）
 *
 * 优先请求真实后端，网络不可达时自动降级本地 Mock（callWithFallback）。
 *
 * 映射要点：
 * - 用户：后端 /api/v1/system/users 返回 Map，status 1启用/0停用 ↔ 前端 '1'/'2'；
 *   userRoles 前端存 roleCode，后端只返回 roleId+roleName，经角色字典缓存转换
 * - 角色：后端 /api/v1/roles 返回 RoleVO；roleMenus（前端树 node-key）↔ menuIds（sys_menu id）
 *   采用启发式映射（component basename / permission 末段），未匹配项丢弃
 * - 菜单：后端 /api/v1/menus/tree（全量，菜单管理页）与 /api/v1/menus/current（按角色授权过滤，登录渲染）
 *   均经 mapMenuTree 转为 AppRouteRecord；menu_type=2 按钮行映射为 meta.authList 供 v-auth 使用
 */
import {
  fetchSystemUserList,
  fetchCreateSystemUser,
  fetchUpdateSystemUser,
  fetchDeleteSystemUser,
  fetchResetSystemUserPassword,
  fetchRoleList,
  fetchCreateRole as serviceCreateRole,
  fetchUpdateRole as serviceUpdateRole,
  fetchDeleteRole as serviceDeleteRole,
  fetchMenuTree,
  fetchCreateMenu as serviceCreateMenu,
  fetchUpdateMenu as serviceUpdateMenu,
  fetchDeleteMenu as serviceDeleteMenu,
  fetchCreateMenuAuth as serviceCreateMenuAuth,
  fetchUpdateMenuAuth as serviceUpdateMenuAuth,
  fetchDeleteMenuAuth as serviceDeleteMenuAuth,
  type MenuUpsertPayload,
  type MenuAuthUpsertPayload
} from '@/mock/service/system.service'
import avatarDefault from '@/assets/images/avatar/avatar.webp'
import type { AppRouteRecord } from '@/types/router'
import type { BackendPageResult } from '@/types/common/response'
import { asyncRoutes } from '@/router/routes/asyncRoutes'
import { RoutesAlias } from '@/router/routesAlias'
import { resolveMenuI18nKey } from '@/utils/router'
import { api, callWithFallback, toBackendPage } from './core/backend'

/* ------------------------------ 后端数据结构 ------------------------------ */

/** 用户列表行（GET /system/users 返回的 Map） */
interface BackendUserRow {
  id?: number
  tenantId?: number | string | null
  tenantName?: string | null
  username?: string
  name?: string | null
  phone?: string | null
  email?: string | null
  storeId?: number | null
  userType?: number
  status?: number
  roleId?: number | null
  roleName?: string | null
  createTime?: string
  updateTime?: string
}

/** 角色（GET /roles 返回 RoleVO） */
interface BackendRoleVO {
  id?: number
  tenantId?: number | string | null
  roleName?: string
  roleCode?: string
  description?: string | null
  status?: number
  roleScope?: number
  menuIds?: number[] | null
}

/** 菜单（GET /menus/tree 返回 MenuVO 树，menuType: 0目录 1菜单 2按钮） */
interface BackendMenuVO {
  id?: number
  parentId?: number | null
  menuName?: string
  menuType?: number
  path?: string | null
  component?: string | null
  permission?: string | null
  icon?: string | null
  sort?: number | null
  visible?: number | null
  status?: number | null
  children?: BackendMenuVO[] | null
}

/** MyBatis-Plus 分页（兼容 Page{records,current,size,total} 返回） */
interface MpPage<T> {
  records?: T[]
  total?: number
  size?: number
  current?: number
}

/* ------------------------------ 公共工具 ------------------------------ */

/** 时间格式（后端 yyyy-MM-dd HH:mm:ss 或 ISO，统一兜底） */
function formatTime(time?: string | null): string {
  if (!time) return ''
  return time.replace('T', ' ').slice(0, 19)
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

/** 前端用户状态 '1'启用/'2'停用 → 后端 1/0 */
function toBackendUserStatus(status?: string): number | undefined {
  if (!status) return undefined
  return status === '1' ? 1 : 0
}

/** 后端用户状态 1/0 → 前端 '1'/'2' */
function fromBackendUserStatus(status?: number | null): string {
  return status === 1 ? '1' : '2'
}

/** 关键字模糊匹配（对齐 mock 的 includesKeyword 语义） */
function includesKeyword(value: string | undefined | null, keyword?: string): boolean {
  if (!keyword) return true
  return (value ?? '').toLowerCase().includes(String(keyword).toLowerCase())
}

/* ------------------------------ 字典缓存 ------------------------------ */

/** 角色字典（roleId→roleCode，用于用户 userRoles 转换），60 秒缓存 */
let roleCodeCache: { at: number; byId: Map<number, string> } | null = null

async function loadRoleIdToRoleCode(): Promise<Map<number, string>> {
  if (roleCodeCache && Date.now() - roleCodeCache.at < 60_000) return roleCodeCache.byId
  const page = await api.get<BackendPageResult<BackendRoleVO> | MpPage<BackendRoleVO>>({
    url: '/api/v1/roles',
    params: { page: 1, pageSize: 500 }
  })
  const byId = new Map<number, string>()
  normalizePage<BackendRoleVO>(page).list.forEach((role) => {
    if (role.id != null && role.roleCode) byId.set(Number(role.id), role.roleCode)
  })
  roleCodeCache = { at: Date.now(), byId }
  return byId
}

/* ------------------------------ 菜单树 name↔id 映射 ------------------------------ */

/** 前端路由注册表（规范化 path → 路由 name），用于 sys_menu.path 与前端路由名精确对齐 */
let routeNameRegistry: Map<string, string> | null = null

function loadRouteNameRegistry(): Map<string, string> {
  if (routeNameRegistry) return routeNameRegistry
  const registry = new Map<string, string>()
  const walk = (routes: AppRouteRecord[], parent = '') => {
    for (const route of routes) {
      const path = (route.path ?? '').startsWith('/')
        ? route.path
        : `${parent}/${route.path}`.replace(/\/+/g, '/')
      if (path && route.name) registry.set(path, String(route.name))
      if (route.children?.length) walk(route.children, path)
    }
  }
  walk(asyncRoutes)
  routeNameRegistry = registry
  return registry
}

/** path 全段 PascalCase，如 /warehouse/stock → WarehouseStock */
function pascalPath(path: string): string {
  return (path ?? '')
    .split('/')
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join('')
}

/**
 * 从 sys_menu 节点派生前端树 node-key（路由 name）：
 * 优先按 path 命中前端路由注册表；兜底 component basename 去 .vue；再兜底 path PascalCase；最后 menuName
 *
 * 注意：组件为 index.vue 时 basename 无区分度（views/a/index.vue 与 views/b/index.vue
 * 都会得到 'Index'），node-key 碰撞会让角色授权树勾选/保存错配（授权静默丢失），
 * 此种情况跳过 basename，改用路径 PascalCase 保证唯一。
 */
function deriveMenuKey(menu: BackendMenuVO): string {
  const path = menu.path ?? ''
  const byPath = loadRouteNameRegistry().get(path)
  if (byPath) return byPath
  const component = (menu.component ?? '').trim()
  if (component) {
    const base = component.split('/').filter(Boolean).pop() ?? ''
    const name = base.replace(/\.vue$/i, '')
    if (name && name.toLowerCase() !== 'index') {
      return name.charAt(0).toUpperCase() + name.slice(1)
    }
  }
  const byPathPascal = pascalPath(path)
  if (byPathPascal) return byPathPascal
  return menu.menuName ?? String(menu.id ?? '')
}

/**
 * 权限标识：sys_menu.permission 末两段，如 pms:product:add → product:add
 *
 * 只取末段会冲突：出库管理(703) 下同时存在
 * wms:stock:outbound:add(新增出库) 与 wms:stock:shelf-up:add(新增上架)，
 * 末段都是 'add'，两个按钮无法区分，授权与 hasAuth 判定都会串。
 */
function deriveAuthMark(menu: BackendMenuVO): string {
  const segments = (menu.permission ?? '').split(':').filter(Boolean)
  return segments.length > 1 ? segments.slice(-2).join(':') : (segments[0] ?? '')
}

/** 按钮节点 key：`${父菜单 key}_${sys_menu 主键}`（主键全局唯一，避免 permission 末段重复导致 key 冲突） */
function deriveAuthKey(menu: BackendMenuVO, parentKey: string): string {
  const mark = deriveAuthMark(menu) || menu.menuName || String(menu.id ?? '')
  const id = menu.id != null ? Number(menu.id) : ''
  return `${parentKey}_${id != '' ? id : mark}`
}

/** 菜单树 key↔id 正反映射，60 秒缓存 */
let menuKeyCache: {
  at: number
  idToKey: Map<number, string>
  keyToId: Map<string, number>
  tree: BackendMenuVO[]
} | null = null

async function loadMenuKeyMaps(force = false) {
  if (!force && menuKeyCache && Date.now() - menuKeyCache.at < 60_000) return menuKeyCache
  const tree = (await api.get<BackendMenuVO[]>({ url: '/api/v1/menus/tree' })) ?? []
  const idToKey = new Map<number, string>()
  const keyToId = new Map<string, number>()
  const walk = (nodes: BackendMenuVO[], parentKey?: string) => {
    for (const node of nodes ?? []) {
      if (node.id == null) continue
      const id = Number(node.id)
      if (node.menuType === 2) {
        // 按钮节点：key 为 `${父菜单名}_${authMark}`
        if (parentKey) {
          const key = deriveAuthKey(node, parentKey)
          idToKey.set(id, key)
          if (!keyToId.has(key)) keyToId.set(key, id)
        }
      } else {
        const key = deriveMenuKey(node)
        idToKey.set(id, key)
        if (!keyToId.has(key)) keyToId.set(key, id)
        walk(node.children ?? [], key)
      }
    }
  }
  walk(tree)
  menuKeyCache = { at: Date.now(), idToKey, keyToId, tree }
  return menuKeyCache
}

/** 在缓存的菜单树中按前端 name 查找 sys_menu 节点 id（不含按钮行） */
async function findMenuIdByName(name: string): Promise<number | undefined> {
  const { keyToId } = await loadMenuKeyMaps()
  return keyToId.get(name)
}

/** 后端 menuIds → 前端 roleMenus（树 node-key），未匹配项丢弃 */
function menuIdsToRoleMenus(menuIds: number[] | null | undefined, idToKey: Map<number, string>) {
  if (!Array.isArray(menuIds)) return []
  return menuIds.map((id) => idToKey.get(Number(id))).filter((key): key is string => Boolean(key))
}

/** 前端 roleMenus → 后端 menuIds，未匹配项丢弃 */
function roleMenusToMenuIds(roleMenus: string[] | undefined, keyToId: Map<string, number>) {
  if (!Array.isArray(roleMenus)) return undefined
  return roleMenus.map((key) => keyToId.get(key)).filter((id): id is number => id !== undefined)
}

/* ------------------------------ 映射函数 ------------------------------ */

/** 后端用户行 → 前端 UserListItem */
function mapUserRow(
  row: BackendUserRow,
  roleIdToCode: Map<number, string>
): Api.SystemManage.UserListItem {
  const roleId = row.roleId != null ? Number(row.roleId) : undefined
  const roleCode = roleId != null ? roleIdToCode.get(roleId) : undefined
  return {
    id: Number(row.id ?? 0),
    avatar: avatarDefault,
    status: fromBackendUserStatus(row.status),
    userName: row.username ?? '',
    userGender: '男', // 后端无性别字段
    nickName: row.name ?? row.username ?? '',
    userPhone: row.phone ?? '',
    userEmail: row.email ?? '',
    // 前端 userRoles 存 roleCode；字典缺失时回退 roleName
    userRoles: roleId != null ? [String(roleCode ?? row.roleName ?? '')].filter(Boolean) : [],
    // 角色名称（RoleVO 直接提供 roleName）
    userRoleNames: roleId != null ? [String(row.roleName ?? '')].filter(Boolean) : [],
    userType: row.userType ?? 1,
    tenantId: row.tenantId != null ? String(row.tenantId) : '',
    tenantName: row.tenantName ?? undefined,
    createBy: '',
    createTime: formatTime(row.createTime),
    updateBy: '',
    updateTime: formatTime(row.updateTime)
  }
}

/** 后端角色 → 前端 RoleListItem */
function mapRoleItem(
  vo: BackendRoleVO,
  idToKey: Map<number, string>
): Api.SystemManage.RoleListItem {
  return {
    roleId: Number(vo.id ?? 0),
    roleName: vo.roleName ?? '',
    roleCode: vo.roleCode ?? '',
    description: vo.description ?? '',
    enabled: vo.status === 1,
    roleScope: (vo.roleScope === 2 || vo.roleScope === 3 ? vo.roleScope : 1) as Api.SystemManage.RoleScope,
    createTime: '', // RoleVO 未返回 createTime
    roleMenus: menuIdsToRoleMenus(vo.menuIds, idToKey)
  }
}

/** 后端菜单树（sys_menu）→ 前端 AppRouteRecord 树 */
/**
 * 后端菜单树（sys_menu）→ 前端 AppRouteRecord 树：
 * - 目录(menuType=0) component 用布局容器；页面(menuType=1) component 用 path，对齐 views/<path>/index.vue
 * - 按钮(menuType=2) 不进 children，映射为 meta.authList，供 v-auth 按用户实际授权显隐
 * - title 优先按 path 回查 i18n key：后端 menu_name 存的是中文显示名，直接放进
 *   meta.title 会导致侧边栏/标签栏/面包屑无法随语言切换（formatMenuTitle 只翻译 menus.* key）
 */
function mapMenuTree(menus: BackendMenuVO[]): AppRouteRecord[] {
  return (menus ?? []).map((menu) => {
    const isDir = menu.menuType === 0
    const authList = (menu.children ?? [])
      .filter((child) => child.menuType === 2)
      .map((child) => ({
        title: child.menuName ?? '',
        authMark: deriveAuthMark(child),
        menuId: child.id != null ? Number(child.id) : undefined
      }))
      .filter((item) => item.authMark)
    const fallbackTitle = menu.menuName ?? ''
    const node: AppRouteRecord = {
      path: menu.path ?? '',
      name: deriveMenuKey(menu),
      component: isDir ? RoutesAlias.Layout : (menu.path ?? ''),
      meta: {
        title: resolveMenuI18nKey(menu.path ?? '') ?? fallbackTitle,
        icon: menu.icon ?? '',
        sort: menu.sort ?? 1,
        isHide: menu.visible === 0,
        isEnable: menu.status === 1,
        updateTime: '',
        authList
      }
    }
    const children = (menu.children ?? []).filter((child) => child.menuType !== 2)
    if (children.length) node.children = mapMenuTree(children)
    return node
  })
}

/** 前端菜单载荷 → 后端 Menu 提交体 */
function buildMenuSubmit(payload: MenuUpsertPayload, parentId: number) {
  return {
    parentId,
    menuName: payload.title,
    menuType: payload.component ? 1 : 0,
    path: payload.path,
    component: payload.component,
    permission: payload.name, // 存路由 name，便于按 name 回查
    icon: payload.icon,
    sort: payload.sort ?? 1,
    visible: payload.isHide ? 0 : 1,
    status: payload.isEnable === false ? 0 : 1
  }
}

/** 由载荷在本地构造返回节点（与 mock 行为一致，不回读树） */
function buildMenuNode(payload: MenuUpsertPayload): AppRouteRecord {
  const node: AppRouteRecord = {
    path: payload.path,
    name: payload.name,
    meta: {
      title: payload.title,
      icon: payload.icon || '',
      roles: payload.roles ?? [],
      sort: payload.sort ?? 1,
      link: payload.link || '',
      showTextBadge: payload.showTextBadge || '',
      activePath: payload.activePath || '',
      isEnable: payload.isEnable ?? true,
      keepAlive: payload.keepAlive ?? false,
      isHide: payload.isHide ?? false,
      isIframe: payload.isIframe ?? false,
      showBadge: payload.showBadge ?? false,
      fixedTab: payload.fixedTab ?? false,
      isHideTab: payload.isHideTab ?? false,
      isFullPage: payload.isFullPage ?? false
    }
  }
  if (payload.component) node.component = payload.component
  return node
}

/** 读取当前角色详情（更新前合并，防止把 description/status 覆盖为 null） */
async function getRoleDetail(roleId: number): Promise<BackendRoleVO> {
  return (await api.get<BackendRoleVO>({ url: `/api/v1/roles/${roleId}` })) ?? {}
}

/** 读取当前用户详情（创建/更新后回读组装完整项） */
async function getUserDetail(id: number | string): Promise<BackendUserRow> {
  return (await api.get<BackendUserRow>({ url: `/api/v1/system/users/${id}` })) ?? {}
}

/* ------------------------------ 用户 ------------------------------ */

// 获取用户列表
export function fetchGetUserList(
  params: Api.SystemManage.UserSearchParams
): Promise<Api.SystemManage.UserList> {
  return callWithFallback(
    async () => {
      const res = await api.get<BackendPageResult<BackendUserRow> | MpPage<BackendUserRow>>({
        url: '/api/v1/system/users',
        params: {
          ...toBackendPage(params),
          // 后端 keyword 同时模糊 username/name/phone，取首个非空搜索词
          keyword: params.userName || params.userPhone || params.userEmail || undefined,
          tenantId: params.tenantId || undefined,
          status: toBackendUserStatus(params.status)
          // userGender 后端无对应字段，忽略
        }
      })
      const roleIdToCode = await loadRoleIdToRoleCode()
      const page = normalizePage<BackendUserRow>(res)
      return {
        records: page.list.map((row) => mapUserRow(row, roleIdToCode)),
        current: page.page,
        size: page.pageSize,
        total: page.total
      }
    },
    () => fetchSystemUserList(params)
  )
}

// 新增用户
export function fetchCreateUser(
  data: Partial<Api.SystemManage.UserListItem>
): Promise<Api.SystemManage.UserListItem> {
  return callWithFallback(
    async () => {
      const roleIdToCode = await loadRoleIdToRoleCode()
      // userRoles 存 roleCode，后端仅支持单角色 roleId
      const firstRoleCode = data.userRoles?.[0]
      const roleId = firstRoleCode
        ? [...roleIdToCode.entries()].find(([, code]) => code === firstRoleCode)?.[0]
        : undefined
      // dialog 会附带 password 字段（类型外），默认初始密码 123456
      const password = (data as { password?: string }).password || '123456'
      const id = await api.post<number | string>({
        url: '/api/v1/system/users',
        data: {
          username: data.userName,
          password,
          name: data.nickName,
          phone: data.userPhone || undefined,
          email: data.userEmail || undefined,
          userType: data.userType ?? 1,
          tenantId:
            data.tenantId && /^\d+$/.test(data.tenantId) ? Number(data.tenantId) : undefined,
          roleId,
          status: data.status === '2' ? 0 : 1
        }
      })
      const created = await getUserDetail(id)
      return mapUserRow(created, roleIdToCode)
    },
    () => fetchCreateSystemUser(data)
  )
}

// 编辑用户
export function fetchUpdateUser(
  data: Partial<Api.SystemManage.UserListItem>
): Promise<Api.SystemManage.UserListItem> {
  return callWithFallback(
    async () => {
      const roleIdToCode = await loadRoleIdToRoleCode()
      const firstRoleCode = data.userRoles?.[0]
      const roleId = firstRoleCode
        ? [...roleIdToCode.entries()].find(([, code]) => code === firstRoleCode)?.[0]
        : undefined
      // 后端 UserUpdateDTO 不含 username，不支持修改用户名
      await api.put({
        url: `/api/v1/system/users/${data.id}`,
        data: {
          name: data.nickName,
          phone: data.userPhone,
          email: data.userEmail,
          tenantId:
            data.tenantId && /^\d+$/.test(data.tenantId) ? Number(data.tenantId) : undefined,
          roleId,
          userType: data.userType,
          status: data.status === '2' ? 0 : 1
        }
      })
      const updated = await getUserDetail(Number(data.id))
      return mapUserRow(updated, roleIdToCode)
    },
    () => fetchUpdateSystemUser(data)
  )
}

// 删除用户
export function fetchDeleteUser(id: number): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/system/users/${id}` }),
    () => fetchDeleteSystemUser(id)
  )
}

// 重置密码（重置为默认密码 123456）
export function fetchResetUserPassword(id: number): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/system/users/${id}/reset-password` }),
    () => fetchResetSystemUserPassword(id)
  )
}

/* ------------------------------ 角色 ------------------------------ */

// 获取角色列表
export function fetchGetRoleList(
  params: Api.SystemManage.RoleSearchParams
): Promise<Api.SystemManage.RoleList> {
  return callWithFallback(
    async () => {
      // 后端列表接口无关键字/时间过滤，取全量后前端过滤再分页
      const res = await api.get<BackendPageResult<BackendRoleVO> | MpPage<BackendRoleVO>>({
        url: '/api/v1/roles',
        params: { page: 1, pageSize: 500 }
      })
      const { idToKey } = await loadMenuKeyMaps()
      const filtered = normalizePage<BackendRoleVO>(res)
        .list.filter(
          (role) =>
            includesKeyword(role.roleName, params.roleName) &&
            includesKeyword(role.roleCode, params.roleCode) &&
            includesKeyword(role.description, params.description) &&
            (params.enabled === undefined ||
              params.enabled === null ||
              (role.status === 1) === params.enabled)
          // startTime/endTime 后端无创建时间过滤，忽略
        )
        .map((role) => mapRoleItem(role, idToKey))
      const current = params.current ?? 1
      const size = params.size ?? 20
      return {
        records: filtered.slice((current - 1) * size, current * size),
        current,
        size,
        total: filtered.length
      }
    },
    () => fetchRoleList(params)
  )
}

// 新增角色
export function fetchCreateRole(
  data: Partial<Api.SystemManage.RoleListItem>
): Promise<Api.SystemManage.RoleListItem> {
  return callWithFallback(
    async () => {
      const { idToKey, keyToId } = await loadMenuKeyMaps(true)
      const id = await api.post<number>({
        url: '/api/v1/roles',
        data: {
          roleName: data.roleName,
          roleCode: data.roleCode,
          description: data.description,
          status: data.enabled === false ? 0 : 1,
          roleScope: data.roleScope ?? 1,
          menuIds: roleMenusToMenuIds(data.roleMenus, keyToId) ?? []
        }
      })
      roleCodeCache = null // 角色变更后刷新字典
      const created = await getRoleDetail(id)
      return mapRoleItem(created, idToKey)
    },
    () => serviceCreateRole(data)
  )
}

// 编辑角色
export function fetchUpdateRole(
  data: Partial<Api.SystemManage.RoleListItem>
): Promise<Api.SystemManage.RoleListItem> {
  return callWithFallback(
    async () => {
      const roleId = Number(data.roleId)
      const { idToKey, keyToId } = await loadMenuKeyMaps(true)
      // 后端为全量 copyProperties 更新，先取当前值合并，防止清空 description/status
      const current = await getRoleDetail(roleId)
      const menuIds = Array.isArray(data.roleMenus)
        ? (roleMenusToMenuIds(data.roleMenus, keyToId) ?? [])
        : (current.menuIds ?? [])
      await api.put({
        url: `/api/v1/roles/${roleId}`,
        data: {
          roleName: data.roleName ?? current.roleName,
          roleCode: data.roleCode ?? current.roleCode,
          description: data.description ?? current.description ?? '',
          status: data.enabled !== undefined ? (data.enabled ? 1 : 0) : (current.status ?? 1),
          roleScope: data.roleScope ?? current.roleScope ?? 1,
          menuIds
        }
      })
      roleCodeCache = null
      const updated = await getRoleDetail(roleId)
      return mapRoleItem(updated, idToKey)
    },
    () => serviceUpdateRole(data)
  )
}

// 删除角色
export function fetchDeleteRole(roleId: number): Promise<void> {
  return callWithFallback(
    async () => {
      await api.del<void>({ url: `/api/v1/roles/${roleId}` })
      roleCodeCache = null
    },
    () => serviceDeleteRole(roleId)
  )
}

/* ------------------------------ 菜单 ------------------------------ */

// 获取菜单列表（全量菜单树，供菜单管理页与角色授权映射使用）
export function fetchGetMenuList(): Promise<AppRouteRecord[]> {
  return callWithFallback(
    async () => {
      const tree = (await api.get<BackendMenuVO[]>({ url: '/api/v1/menus/tree' })) ?? []
      return mapMenuTree(tree)
    },
    () => fetchMenuTree()
  )
}

// 获取当前登录用户菜单（后端按角色授权过滤，登录时渲染菜单用）
export function fetchGetCurrentMenuList(): Promise<AppRouteRecord[]> {
  return callWithFallback(
    async () => {
      const tree = (await api.get<BackendMenuVO[]>({ url: '/api/v1/menus/current' })) ?? []
      return mapMenuTree(tree)
    },
    () => fetchMenuTree()
  )
}

// 新增菜单
export function fetchCreateMenu(payload: MenuUpsertPayload): Promise<AppRouteRecord> {
  return callWithFallback(
    async () => {
      const parentId = payload.parentId ? ((await findMenuIdByName(payload.parentId)) ?? 0) : 0
      await api.post<number>({
        url: '/api/v1/menus',
        data: buildMenuSubmit(payload, parentId)
      })
      menuKeyCache = null // 菜单变更后刷新映射
      return buildMenuNode(payload)
    },
    () => serviceCreateMenu(payload)
  )
}

// 编辑菜单
export function fetchUpdateMenu(payload: MenuUpsertPayload): Promise<AppRouteRecord> {
  return callWithFallback(
    async () => {
      const originalName = (payload.originalName || '').trim()
      const menuId = await findMenuIdByName(originalName)
      if (!menuId) throw new Error('菜单不存在')
      const parentId = payload.parentId ? ((await findMenuIdByName(payload.parentId)) ?? 0) : 0
      await api.put({
        url: `/api/v1/menus/${menuId}`,
        data: buildMenuSubmit(payload, parentId)
      })
      menuKeyCache = null
      return buildMenuNode(payload)
    },
    () => serviceUpdateMenu(payload)
  )
}

// 删除菜单
export function fetchDeleteMenu(name: string): Promise<void> {
  return callWithFallback(
    async () => {
      const menuId = await findMenuIdByName(name)
      if (!menuId) throw new Error('菜单不存在')
      await api.del<void>({ url: `/api/v1/menus/${menuId}` })
      menuKeyCache = null
    },
    () => serviceDeleteMenu(name)
  )
}

// 新增菜单权限按钮（后端 sys_menu 无 meta.authList 概念，保留本地 Mock）
export function fetchCreateMenuAuth(payload: MenuAuthUpsertPayload): Promise<AppRouteRecord[]> {
  return serviceCreateMenuAuth(payload)
}

// 编辑菜单权限按钮（保留本地 Mock）
export function fetchUpdateMenuAuth(payload: MenuAuthUpsertPayload): Promise<AppRouteRecord[]> {
  return serviceUpdateMenuAuth(payload)
}

// 删除菜单权限按钮（保留本地 Mock）
export function fetchDeleteMenuAuth(
  parentName: string,
  authMark: string
): Promise<AppRouteRecord[]> {
  return serviceDeleteMenuAuth(parentName, authMark)
}
