import { AppRouteRecord } from '@/types/router'

export const purchaseRoutes: AppRouteRecord = {
  path: '/purchase',
  name: 'Purchase',
  component: '/index/index',
  meta: {
    title: 'menus.purchase.title',
    icon: 'ri:shopping-cart-2-line',
    roles: ['R_ADMIN']
  },
  children: [
    {
      path: 'order',
      name: 'PurchaseOrder',
      component: '/purchase/order',
      meta: {
        title: 'menus.purchase.order',
        icon: 'ri:file-list-2-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [
          { title: '新建采购订单', authMark: 'add' },
          { title: '编辑采购订单', authMark: 'edit' },
          { title: '删除采购订单', authMark: 'delete' }
        ]
      }
    },
    {
      path: 'returns',
      name: 'PurchaseReturns',
      component: '/purchase/returns',
      meta: {
        title: 'menus.purchase.returns',
        icon: 'ri:arrow-go-back-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [
          { title: '新建采购退货单', authMark: 'add' },
          { title: '编辑采购退货单', authMark: 'edit' },
          { title: '删除采购退货单', authMark: 'delete' }
        ]
      }
    }
  ]
}
