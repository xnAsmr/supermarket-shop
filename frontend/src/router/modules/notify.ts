import { AppRouteRecord } from '@/types/router'

/**
 * 消息通知模块路由
 *
 * 后端模式（VITE_ACCESS_MODE=backend，当前生效）下，菜单与动态路由由
 * sys_role_menu → sys_menu 驱动：路由 path 取自 sys_menu.path，组件由
 * ComponentLoader 按 path 到 views 下解析，菜单 key 由 deriveMenuKey
 * 优先命中「前端路由完整路径 → 路由名」注册表。
 *
 * 因此铁律：**sys_menu.path 必须与前端路由完整路径一致**。
 * 否则 key 退化为组件 basename——多个 index.vue 页面会碰撞成同一个 'Index'，
 * 导致角色授权树 node-key 重复、勾选/保存错配（授权静默丢失）。
 *
 *  - 消息中心：  /notify/center         （全员通用，不设 roles）
 *  - 平台公告：  /platform/announcement （R_SUPER，超管）
 *  - 租户通知：  /tenant/notice         （R_ADMIN，租户管理员/店长；
 *                超管同属租户，授予菜单后同样可访问）
 */
export const notifyRoutes: AppRouteRecord = {
  path: '/notify',
  name: 'Notify',
  component: '/index/index',
  meta: {
    title: 'menus.notify.title',
    icon: 'ri:notification-3-line'
  },
  children: [
    {
      path: 'center',
      name: 'NotifyCenter',
      component: '/notify/center',
      meta: {
        title: 'menus.notify.center',
        icon: 'ri:notification-3-line',
        keepAlive: false
      }
    }
  ]
}

/**
 * 平台公告管理（超管）
 * path 与 sys_menu id=1202 的 path 保持一致（/platform/announcement）
 */
export const platformAnnouncementRoutes: AppRouteRecord = {
  path: '/platform/announcement',
  name: 'PlatformAnnouncement',
  component: '/platform/announcement',
  meta: {
    title: 'menus.notify.announcement',
    icon: 'ri:megaphone-line',
    keepAlive: false,
    roles: ['R_SUPER']
  }
}

/**
 * 租户通知管理（租户管理员 / 店长；超管同属租户，授权后同样可访问）
 * path 与 sys_menu id=1203 的 path 保持一致（/tenant/notice）
 */
export const tenantNoticeRoutes: AppRouteRecord = {
  path: '/tenant/notice',
  name: 'TenantNoticeManage',
  component: '/tenant/notice',
  meta: {
    title: 'menus.notify.tenantNotice',
    icon: 'ri:send-plane-line',
    keepAlive: false,
    roles: ['R_ADMIN']
  }
}
