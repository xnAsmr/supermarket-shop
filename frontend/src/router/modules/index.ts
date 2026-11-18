import { AppRouteRecord } from '@/types/router'
import { dashboardRoutes } from './dashboard'
import { platformRoutes } from './platform'
import { posRoutes } from './pos'
import { productRoutes } from './product'
import { purchaseRoutes } from './purchase'
import { orderRoutes } from './order'
import { memberRoutes } from './member'
import { warehouseRoutes } from './warehouse'
import { notifyRoutes, platformAnnouncementRoutes, tenantNoticeRoutes } from './notify'
import { financeRoutes } from './finance'
import { scheduleRoutes } from './schedule'
import { tenantRoutes } from './tenant'
import { systemRoutes } from './system'
import { exceptionRoutes } from './exception'

/**
 * 导出所有模块化路由
 */
export const routeModules: AppRouteRecord[] = [
  platformRoutes,
  dashboardRoutes,
  posRoutes,
  orderRoutes,
  productRoutes,
  purchaseRoutes,
  warehouseRoutes,
  memberRoutes,
  financeRoutes,
  scheduleRoutes,
  tenantRoutes,
  systemRoutes,
  notifyRoutes,
  platformAnnouncementRoutes,
  tenantNoticeRoutes,
  exceptionRoutes
]
