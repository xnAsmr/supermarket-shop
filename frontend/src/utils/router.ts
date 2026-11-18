/**
 * 路由工具函数
 *
 * 提供路由相关的工具函数
 *
 * @module utils/router
 */
import { RouteLocationNormalized, RouteRecordRaw } from 'vue-router'
import AppConfig from '@/config'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import i18n, { $t } from '@/locales'
import { LanguageEnum } from '@/enums/appEnum'

/** 扩展的路由配置类型 */
export type AppRouteRecordRaw = RouteRecordRaw & {
  hidden?: boolean
}

/** 顶部进度条配置 */
export const configureNProgress = () => {
  NProgress.configure({
    easing: 'ease',
    speed: 600,
    showSpinner: false,
    parent: 'body'
  })
}

/**
 * 设置页面标题，根据路由元信息和系统信息拼接标题
 * @param to 当前路由对象
 */
export const setPageTitle = (to: RouteLocationNormalized): void => {
  const { title } = to.meta
  if (title) {
    setTimeout(() => {
      document.title = `${formatMenuTitle(String(title), to.path)} - ${AppConfig.systemInfo.name}`
    }, 150)
  }
}

/**
 * 路径与 menus.* key 命名不一致的例外。
 *
 * sys_menu.path 是路由地址，locale key 是按模块归类的（公告挂在 notify 下），
 * 两者对不上时按路径约定推不出 key，只能显式声明。
 */
const MENU_I18N_ALIAS: Record<string, string> = {
  '/platform/announcement': 'menus.notify.announcement',
  '/tenant/notice': 'menus.notify.tenantNotice'
}

/** kebab-case 段转 camelCase，用于兼容 operation-log → operationLog 这类 key 写法差异 */
const toCamelCase = (segment: string): string =>
  segment.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())

/** key 是否真实存在（zh/en 任一语言包有即可，避免某语言缺 key 时误判） */
const hasMenuKey = (key: string): boolean =>
  i18n.global.te(key, LanguageEnum.ZH) || i18n.global.te(key, LanguageEnum.EN)

/**
 * 路由 path 反查菜单 i18n key。
 *
 * 后端模式下 sys_menu.menu_name 存的是中文显示名，而 formatMenuTitle 只会翻译
 * 以 menus. 开头的 key，所以这里按路径约定拼出候选 key 并校验它真的存在：
 *   /product            → menus.product.title
 *   /product/list       → menus.product.list
 *   /system/operation-log → menus.system.operationLog
 *
 * @param path 路由路径
 * @returns 存在的 i18n key，找不到时返回 undefined（调用方回退到原始标题）
 */
export const resolveMenuI18nKey = (path: string): string | undefined => {
  const segments = (path ?? '').split('/').filter(Boolean)
  if (!segments.length) return undefined

  const aliased = MENU_I18N_ALIAS['/' + segments.join('/')]
  if (aliased && hasMenuKey(aliased)) return aliased

  const head = ['menus', segments[0]]
  const tails = segments.length > 1 ? [segments[1]] : ['title']
  for (const tail of tails) {
    for (const candidate of [tail, toCamelCase(tail)]) {
      const key = [...head, candidate].join('.')
      if (hasMenuKey(key)) return key
    }
  }
  return undefined
}

/**
 * 格式化菜单标题
 * @param title 菜单标题，可以是 i18n 的 key，也可以是字符串
 * @param path 可选的路由路径；title 不是 i18n key 时（后端中文菜单名、
 *        localStorage 里历史遗留的中文标签标题）用它回查 key 后再翻译
 * @returns 格式化后的菜单标题
 */
export const formatMenuTitle = (title: string, path?: string): string => {
  if (!title) return ''
  if (title.startsWith('menus.')) {
    if (i18n.global.te(title)) {
      return $t(title)
    }
    // 如果翻译不存在，返回键值的最后部分作为fallback
    return title.split('.').pop() || title
  }
  const key = path ? resolveMenuI18nKey(path) : undefined
  return (key && $t(key)) || title
}
