/**
 * 本地 Mock 数据库
 *
 * - 数据保存在内存中，变更后写入 localStorage（键：mksmart-db-v1）
 * - 首次加载时由 seed.ts 生成演示数据
 * - 提供 resetMockDb() 可恢复初始演示数据
 */
import { seedDatabase, seedMembers, seedMenus, seedPaymentAccounts, seedScheduleDemo } from './seed'
import { normalizeStockRow } from './inventory'
import type { AppRouteRecord } from '@/types/router'

export const DB_STORAGE_KEY = 'mksmart-db-v1'
export const DB_VERSION = 1

/** 系统用户（含登录口令，仅本地演示） */
export type SystemUser = Api.SystemManage.UserListItem & {
  password: string
  realName?: string
  buttons?: string[]
  warehouseId?: string
  warehouseName?: string
}

/** 数据库结构 */
export interface MockDatabase {
  version: number
  /** 各类单据流水号计数器 */
  seq: Record<string, number>
  /** 系统菜单（可持久化增删改） */
  menus: AppRouteRecord[]
  plans: Api.Tenant.PlanItem[]
  tenants: Api.Tenant.TenantItem[]
  /** 品牌门店（sys_store，本地演示） */
  stores: Api.Tenant.StoreItem[]
  users: SystemUser[]
  roles: Api.SystemManage.RoleListItem[]
  categories: Api.Product.CategoryItem[]
  suppliers: Api.Product.SupplierItem[]
  products: Api.Product.ProductItem[]
  warehouses: Api.Warehouse.WarehouseItem[]
  stocks: Api.Warehouse.StockItem[]
  stockDocs: Api.Warehouse.StockDoc[]
  purchases: Api.Purchase.PurchaseOrder[]
  /** 采购订单（pms_purchase_order） */
  purchaseOrders: Api.Purchase.PurchaseOrderDetail[]
  /** 采购收货单（wms_purchase_receipt） */
  purchaseReceipts: Api.Purchase.PurchaseReceipt[]
  /** 采购退货单（pms_purchase_return） */
  purchaseReturns: Api.Purchase.PurchaseReturn[]
  /** 上架单（wms_shelf_up） */
  shelfUps: Api.Warehouse.ShelfUpOrder[]
  orders: Api.Order.SalesOrder[]
  /** 会员（ums_member，本地演示） */
  members: Api.Member.MemberItem[]
  /** 会员充值记录（ums_member_recharge_log） */
  memberLogs: Api.Member.RechargeLogItem[]
  returns: Api.Order.ReturnOrder[]
  flows: Api.Finance.FlowItem[]
  dailies: Api.Finance.DailyItem[]
  holds: Api.Pos.HoldItem[]
  paymentMethods: Api.Finance.PaymentAccountItem[]
  /** TODO(DB): 排班演示数据，对应 sch_shift / sch_schedule / sch_schedule_item / sch_shift_change */
  shifts: Api.Schedule.ShiftItem[]
  schedules: Api.Schedule.WeekSchedule[]
  scheduleItems: Api.Schedule.ScheduleItem[]
  changeRequests: Api.Schedule.ChangeItem[]
}

let cache: MockDatabase | null = null

/** 获取数据库（首次访问时初始化种子数据） */
export const getDb = (): MockDatabase => {
  if (cache) return cache

  let loaded: MockDatabase | null = null
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MockDatabase
      if (parsed && parsed.version === DB_VERSION) {
        loaded = parsed
      }
    }
  } catch (error) {
    console.warn('[MockDB] 读取本地数据失败，将重新生成演示数据', error)
  }

  cache = loaded ?? seedDatabase()
  // 兼容老版本本地数据：缺 menus 字段时回退初始化，避免升级后读取崩溃
  if (!Array.isArray(cache.menus)) {
    cache.menus = seedMenus()
  }
  // 兼容缺少 stores 集合的老数据
  if (!Array.isArray(cache.stores)) {
    cache.stores = []
  }
  // 兼容缺少会员集合的老数据
  if (!Array.isArray(cache.members)) {
    cache.members = seedMembers()
  }
  if (!Array.isArray(cache.memberLogs)) {
    cache.memberLogs = []
  }
  // 兼容缺少支付账户集合的老数据
  if (!Array.isArray(cache.paymentMethods)) {
    cache.paymentMethods = seedPaymentAccounts()
  }
  // 兼容缺少采购新单据集合的老数据
  if (!Array.isArray(cache.purchaseOrders)) {
    cache.purchaseOrders = []
  }
  if (!Array.isArray(cache.purchaseReceipts)) {
    cache.purchaseReceipts = []
  }
  if (!Array.isArray(cache.purchaseReturns)) {
    cache.purchaseReturns = []
  }
  // 兼容缺少上架单集合的老数据
  if (!Array.isArray(cache.shelfUps)) {
    cache.shelfUps = []
  }
  // 兼容缺少排班集合的老数据（本地已有 mksmart-db-v1 时补齐演示班表）
  if (
    !Array.isArray(cache.shifts) ||
    !Array.isArray(cache.schedules) ||
    !Array.isArray(cache.scheduleItems) ||
    !Array.isArray(cache.changeRequests)
  ) {
    const demo = seedScheduleDemo()
    if (!Array.isArray(cache.shifts)) cache.shifts = demo.shifts
    if (!Array.isArray(cache.schedules)) cache.schedules = demo.schedules
    if (!Array.isArray(cache.scheduleItems)) cache.scheduleItems = demo.scheduleItems
    if (!Array.isArray(cache.changeRequests)) cache.changeRequests = demo.changeRequests
  }
  // 兼容旧库存数据：拆分仓库 / 货架 / 在途并补齐预警字段
  if (Array.isArray(cache.stocks)) {
    cache.stocks.forEach((row) => normalizeStockRow(row))
  }
  persistDb()
  return cache
}

/** 持久化数据库到 localStorage */
export const persistDb = (): void => {
  if (!cache) return
  try {
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.warn('[MockDB] 本地存储写入失败（可能超出配额）', error)
  }
}

/** 生成自增流水号 */
export const nextSerial = (db: MockDatabase, key: string): number => {
  db.seq[key] = (db.seq[key] ?? 0) + 1
  return db.seq[key]
}

/** 取数据库快照（用于“重置演示数据”） */
export const peekDbVersion = (): number | null => {
  try {
    const raw = localStorage.getItem(DB_STORAGE_KEY)
    if (!raw) return null
    return (JSON.parse(raw) as MockDatabase).version ?? null
  } catch {
    return null
  }
}

/** 重置为初始演示数据 */
export const resetMockDb = (): MockDatabase => {
  localStorage.removeItem(DB_STORAGE_KEY)
  cache = null
  return getDb()
}
