import { AppRouteRecord } from '@/types/router'

export const tenantRoutes: AppRouteRecord = {
  path: '/tenant',
  name: 'Tenant',
  component: '/index/index',
  meta: {
    title: 'menus.tenant.title',
    icon: 'ri:store-2-line',
    roles: ['R_SUPER']
  },
  children: [
    {
      path: 'list',
      name: 'TenantList',
      component: '/tenant/list',
      meta: {
        title: 'menus.tenant.list',
        icon: 'ri:building-2-line',
        keepAlive: true,
        roles: ['R_SUPER'],
        authList: [
          { title: '新增租户', authMark: 'add' },
          { title: '编辑', authMark: 'edit' },
          { title: '删除', authMark: 'delete' }
        ]
      }
    },
    {
      path: 'store',
      name: 'TenantStore',
      component: '/tenant/store',
      meta: {
        title: 'menus.tenant.store',
        icon: 'ri:store-3-line',
        keepAlive: true,
        roles: ['R_SUPER'],
        authList: [
          { title: '新增门店', authMark: 'add' },
          { title: '编辑', authMark: 'edit' },
          { title: '删除', authMark: 'delete' }
        ]
      }
    },
    {
      path: 'plan',
      name: 'TenantPlan',
      component: '/tenant/plan',
      meta: {
        title: 'menus.tenant.plan',
        icon: 'ri:vip-crown-2-line',
        keepAlive: true,
        roles: ['R_SUPER'],
        authList: [
          { title: '新增套餐', authMark: 'add' },
          { title: '编辑', authMark: 'edit' }
        ]
      }
    }
  ]
}
