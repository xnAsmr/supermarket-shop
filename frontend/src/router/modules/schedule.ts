import { AppRouteRecord } from '@/types/router'

/**
 * 排班模块（独立菜单页）
 * 后端菜单由 seed-schedule-menu.sql 提供，本文件保留组件解析所需的路由与角色元信息。
 */
export const scheduleRoutes: AppRouteRecord = {
  path: '/schedule',
  name: 'Schedule',
  component: '/index/index',
  meta: {
    title: 'menus.schedule.title',
    icon: 'ri:calendar-line',
    roles: ['R_SUPER', 'R_ADMIN', 'R_USER']
  },
  children: [
    {
      path: 'roster',
      name: 'ScheduleRoster',
      component: '/schedule/roster',
      meta: {
        title: 'menus.schedule.roster',
        icon: 'ri:file-list-3-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_USER'],
        authList: [
          { title: '编辑排班', authMark: 'edit' },
          { title: '发布班表', authMark: 'publish' }
        ]
      }
    },
    {
      path: 'shift',
      name: 'ScheduleShift',
      component: '/schedule/shift',
      meta: {
        title: 'menus.schedule.shift',
        icon: 'ri:time-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_USER'],
        authList: [
          { title: '新增班次', authMark: 'add' },
          { title: '编辑班次', authMark: 'edit' }
        ]
      }
    },
    {
      path: 'change',
      name: 'ScheduleChange',
      component: '/schedule/change',
      meta: {
        title: 'menus.schedule.change',
        icon: 'ri:exchange-2-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_USER'],
        authList: [{ title: '审批调班', authMark: 'review' }]
      }
    },
    {
      path: 'mine',
      name: 'ScheduleMine',
      component: '/schedule/mine',
      meta: {
        title: 'menus.schedule.mine',
        icon: 'ri:user-line',
        keepAlive: true,
        roles: ['R_SUPER', 'R_ADMIN', 'R_USER']
      }
    }
  ]
}
