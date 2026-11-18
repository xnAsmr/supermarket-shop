import { AppRouteRecord } from '@/types/router'

export const warehouseRoutes: AppRouteRecord = {
  path: '/warehouse',
  name: 'Warehouse',
  component: '/index/index',
  meta: {
    title: 'menus.warehouse.title',
    icon: 'ri:archive-drawer-line',
    roles: ['R_ADMIN']
  },
  children: [
    {
      path: 'stock',
      name: 'WarehouseStock',
      component: '/warehouse/stock',
      meta: {
        title: 'menus.warehouse.stock',
        icon: 'ri:box-3-line',
        keepAlive: true,
        roles: ['R_ADMIN']
      }
    },
    {
      path: 'inbound',
      name: 'WarehouseInbound',
      component: '/warehouse/inbound',
      meta: {
        title: 'menus.warehouse.inbound',
        icon: 'ri:download-2-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [
          { title: '新增入库', authMark: 'add' },
          { title: '编辑入库', authMark: 'edit' },
          { title: '删除入库', authMark: 'delete' }
        ]
      }
    },
    {
      path: 'outbound',
      name: 'WarehouseOutbound',
      component: '/warehouse/outbound',
      meta: {
        title: 'menus.warehouse.outbound',
        icon: 'ri:upload-2-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [
          { title: '新增出库', authMark: 'outbound:add' },
          { title: '新增上架', authMark: 'shelf-up:add' },
          { title: '确认上架', authMark: 'shelf-up:edit' },
          { title: '撤销上架', authMark: 'shelf-up:delete' }
        ]
      }
    },
    {
      path: 'stock-warning',
      name: 'StockWarning',
      component: '/warehouse/stock-warning',
      meta: {
        title: 'menus.warehouse.stockWarning',
        icon: 'ri:alarm-warning-line',
        keepAlive: true,
        roles: ['R_ADMIN'],
        authList: [{ title: '批量设置预警线/紧急线', authMark: 'settings' }]
      }
    }
  ]
}
