import { AppRouteRecord } from '@/types/router'

export const financeRoutes: AppRouteRecord = {
  path: '/finance',
  name: 'Finance',
  component: '/index/index',
  meta: {
    title: 'menus.finance.title',
    icon: 'ri:money-cny-circle-line',
    roles: ['R_ADMIN']
  },
  children: [
    {
      path: 'flow',
      name: 'FinanceFlow',
      component: '/finance/flow',
      meta: {
        title: 'menus.finance.flow',
        icon: 'ri:money-cny-circle-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [{ title: '新增收支', authMark: 'add' }]
      }
    },
    {
      path: 'daily',
      name: 'FinanceDaily',
      component: '/finance/daily',
      meta: {
        title: 'menus.finance.daily',
        icon: 'ri:bank-card-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [{ title: '生成日结', authMark: 'add' }]
      }
    },
    {
      path: 'report',
      name: 'FinanceReport',
      component: '/finance/report',
      meta: {
        title: 'menus.finance.report',
        icon: 'ri:line-chart-line',
        keepAlive: false,
        roles: ['R_ADMIN']
      }
    },
    {
      path: 'account',
      name: 'FinanceAccount',
      component: '/finance/account',
      meta: {
        title: 'menus.finance.account',
        icon: 'ri:wallet-3-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [
          { title: '新增账户', authMark: 'add' },
          { title: '编辑账户', authMark: 'edit' },
          { title: '删除账户', authMark: 'delete' }
        ]
      }
    }
  ]
}
