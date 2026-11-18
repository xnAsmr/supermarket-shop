import { AppRouteRecordRaw } from '@/utils/router'

/**
 * 扩展路由（非菜单页：详情页专用）
 *
 * 设计取舍：
 * - 本项目为「后端菜单驱动路由」，真实路由由 sys_menu 下发，且 ComponentLoader 按
 *   sys_menu.path 到 views/<path>/index.vue 找组件，因此带参路径（/notify/detail/:id）
 *   无法解析 —— 详情页统一用「静态路径 + query 参数」（type/id）承载，直链与刷新都可用。
 * - 这些页面不属于任何菜单，不参与侧边栏渲染与角色授权树；但仍需登录：
 *   它们不在 staticRoutes 里（守卫的 isStaticRoute 白名单只看 staticRoutes），
 *   所以未登录访问会被重定向到登录页；数据可见性由后端接口把关。
 * - 必须显式用 views/index/index.vue（Layout）包裹，否则会脱离后台框架（无侧边栏/标签页）。
 */
export const extraRoutes: AppRouteRecordRaw[] = [
  {
    // 消息中心详情（系统公告 / 我的通知 / 事件提醒共用，type 区分）
    path: '/notify/detail',
    name: 'NotifyDetailRoot',
    component: () => import('@views/index/index.vue'),
    meta: { title: '消息详情' },
    children: [
      {
        path: '',
        name: 'NotifyDetail',
        component: () => import('@views/notify/detail/index.vue'),
        meta: { title: '消息详情', keepAlive: false }
      }
    ]
  },
  {
    // 平台公告管理详情（超管）
    path: '/platform/announcement/detail',
    name: 'PlatformAnnouncementDetailRoot',
    component: () => import('@views/index/index.vue'),
    meta: { title: '公告详情' },
    children: [
      {
        path: '',
        name: 'PlatformAnnouncementDetail',
        component: () => import('@views/platform/announcement/detail/index.vue'),
        meta: { title: '公告详情', keepAlive: false }
      }
    ]
  },
  {
    // 租户通知管理详情（租户管理员 / 店长）
    path: '/tenant/notice/detail',
    name: 'TenantNoticeDetailRoot',
    component: () => import('@views/index/index.vue'),
    meta: { title: '通知详情' },
    children: [
      {
        path: '',
        name: 'TenantNoticeDetail',
        component: () => import('@views/tenant/notice/detail/index.vue'),
        meta: { title: '通知详情', keepAlive: false }
      }
    ]
  }
]
