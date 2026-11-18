import { AppRouteRecord } from '@/types/router'

export const orderRoutes: AppRouteRecord = {
  path: '/order',
  name: 'Order',
  component: '/index/index',
  meta: {
    title: 'menus.order.title',
    icon: 'ri:file-list-3-line',
    roles: ['R_ADMIN']
  },
  children: [
    {
      path: 'sales',
      name: 'OrderSales',
      component: '/order/sales',
      meta: {
        title: 'menus.order.sales',
        icon: 'ri:file-list-3-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [
          { title: '导出', authMark: 'export' },
          { title: '取消订单', authMark: 'cancel' },
          { title: '完成订单', authMark: 'complete' },
          { title: '退款', authMark: 'refund' }
        ]
      }
    },
    {
      path: 'returns',
      name: 'OrderReturns',
      component: '/order/returns',
      meta: {
        title: 'menus.order.returns',
        icon: 'ri:arrow-go-back-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [{ title: '新增退货', authMark: 'add' }]
      }
    }
  ]
}
