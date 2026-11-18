import { AppRouteRecord } from '@/types/router'

export const platformRoutes: AppRouteRecord = {
  path: '/platform',
  name: 'Platform',
  component: '/index/index',
  meta: {
    title: 'menus.platform.title',
    icon: 'ri:admin-line',
    roles: ['R_SUPER']
  },
  children: [
    {
      path: 'workbench',
      name: 'PlatformWorkbench',
      component: '/platform/workbench',
      meta: {
        title: 'menus.platform.workbench',
        icon: 'ri:bar-chart-box-line',
        keepAlive: false,
        fixedTab: true,
        roles: ['R_SUPER']
      }
    }
  ]
}
