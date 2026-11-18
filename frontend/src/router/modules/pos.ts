import { AppRouteRecord } from '@/types/router'

export const posRoutes: AppRouteRecord = {
  path: '/pos',
  name: 'Pos',
  component: '/index/index',
  meta: {
    title: 'menus.pos.title',
    icon: 'ri:scan-line',
    roles: ['R_ADMIN', 'R_USER']
  },
  children: [
    {
      path: 'checkout',
      name: 'PosCheckout',
      component: '/pos/checkout',
      meta: {
        title: 'menus.pos.checkout',
        icon: 'ri:scan-line',
        keepAlive: false,
        fixedTab: true,
        roles: ['R_ADMIN', 'R_USER']
      }
    }
  ]
}
