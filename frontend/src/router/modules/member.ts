import { AppRouteRecord } from '@/types/router'

export const memberRoutes: AppRouteRecord = {
  path: '/member',
  name: 'Member',
  component: '/index/index',
  meta: {
    title: 'menus.member.title',
    icon: 'ri:user-star-line',
    roles: ['R_ADMIN']
  },
  children: [
    {
      path: 'list',
      name: 'MemberList',
      component: '/member/list',
      meta: {
        title: 'menus.member.list',
        icon: 'ri:user-star-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [
          { title: '新增', authMark: 'add' },
          { title: '编辑', authMark: 'edit' },
          { title: '删除', authMark: 'delete' },
          { title: '充值', authMark: 'recharge' }
        ]
      }
    }
  ]
}
