/**
 * 按钮权限标识（authMark）匹配工具
 *
 * authList 里的 authMark 由 sys_menu.permission 末两段派生，例如：
 *   pms:product:add            -> product:add
 *   wms:stock:shelf-up:delete  -> shelf-up:delete
 *
 * 页面里既写完整标识（'product:add'），也常只写动作段（'add'），两种都要认。
 * 纯函数，无任何副作用，供 useAuth 与 v-auth 指令共用。
 */
export function matchesAuthMark(
  mark: string | undefined | null,
  auth: string | undefined | null
): boolean {
  if (!mark || !auth) return false
  return mark === auth || mark.endsWith(`:${auth}`)
}

/** 当前路由的按钮权限列表是否包含目标权限 */
export function hasAuthMark(
  authList: Array<{ authMark?: string }> | undefined | null,
  auth: string
): boolean {
  if (!Array.isArray(authList)) return false
  return authList.some((item) => matchesAuthMark(item?.authMark, auth))
}
