import { AppRouteRecord } from '@/types/router'

export const systemRoutes: AppRouteRecord = {
  path: '/system',
  name: 'System',
  component: '/index/index',
  meta: {
    title: 'menus.system.title',
    icon: 'ri:user-3-line',
    roles: ['R_SUPER', 'R_ADMIN']
  },
  children: [
    {
      path: 'user',
      name: 'User',
      component: '/system/user',
      meta: {
        title: 'menus.system.user',
        icon: 'ri:user-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN'],
        authList: [
          { title: '新增', authMark: 'add' },
          { title: '编辑', authMark: 'edit' },
          { title: '删除', authMark: 'delete' },
          { title: '重置密码', authMark: 'resetpwd' },
          { title: '模拟登录', authMark: 'impersonate' }
        ]
      }
    },
    {
      path: 'role',
      name: 'Role',
      component: '/system/role',
      meta: {
        title: 'menus.system.role',
        icon: 'ri:user-settings-line',
        keepAlive: true,
        roles: ['R_SUPER']
      }
    },
    {
      path: 'menu',
      name: 'Menus',
      component: '/system/menu',
      meta: {
        title: 'menus.system.menu',
        icon: 'ri:menu-line',
        keepAlive: true,
        roles: ['R_SUPER'],
        authList: [
          { title: '新增', authMark: 'add' },
          { title: '编辑', authMark: 'edit' },
          { title: '删除', authMark: 'delete' }
        ]
      }
    },
    {
      path: 'user-center',
      name: 'UserCenter',
      component: '/system/user-center',
      meta: {
        title: 'menus.system.userCenter',
        icon: 'ri:user-line',
        isHide: true,
        keepAlive: true,
        isHideTab: true
      }
    },
    {
      path: 'operation-log',
      name: 'OperationLog',
      component: '/system/operation-log',
      meta: {
        title: 'menus.system.operationLog',
        icon: 'ri:file-list-3-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    },
    {
      path: 'login-log',
      name: 'LoginLog',
      component: '/system/login-log',
      meta: {
        title: 'menus.system.loginLog',
        icon: 'ri:login-circle-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN']
      }
    }
  ]
}
