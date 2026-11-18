/**
 * 工作台（经营驾驶舱）服务
 */
import { getDb, type MockDatabase } from './core/db'
import { delay, daysAgoStr, money, todayStr, offsetDateStr } from './core/helpers'
import { orderCostAmount } from './order.service'
import { useTenantStore } from '@/store/modules/tenant'
import { useUserStore } from '@/store/modules/user'

const currentTid = (): string => useTenantStore().currentId

/** 基于字符串种子的确定性伪随机（同 key 结果稳定，保证切换时间范围后数据不跳变） */
function seededValue(key: string, min: number, max: number): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  const ratio = Math.abs(hash % 1000) / 1000
  return Math.round(min + ratio * (max - min))
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const dateKeyOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`

/** 指定日期区间内的订单（租户内） */
const ordersInRange = (
  db: MockDatabase,
  tenantId: string,
  startDate: string,
  endDate: string
): Api.Order.SalesOrder[] =>
  db.orders.filter((o) => {
    if (o.tenantId !== tenantId) return false
    const date = o.createTime.slice(0, 10)
    return date >= startDate && date <= endDate
  })

/** 经营驾驶舱聚合数据 */
export async function fetchDashboardOverview(): Promise<Api.Dashboard.Overview> {
  await delay(200)
  const db = getDb()
  const tenantId = currentTid()
  const roles = useUserStore().info.roles ?? []
  const isSuperAdmin = roles.includes('R_SUPER')

  const today = todayStr()
  const monthStart = `${today.slice(0, 7)}-01`
  const todayOrders = ordersInRange(db, tenantId, today, today)

  const todaySales = money(todayOrders.reduce((sum, o) => sum + o.payAmount, 0))
  const todayProfit = money(
    todayOrders.reduce((sum, o) => sum + (o.payAmount - orderCostAmount(db, o)), 0)
  )
  const todayOrdersCount = todayOrders.length

  // 本月累计 & 环比（上月同期）
  const monthSales = money(
    ordersInRange(db, tenantId, monthStart, today).reduce((s, o) => s + o.payAmount, 0)
  )
  const dayOfMonth = Number(today.slice(8, 10))
  const prevMonthStartRaw = offsetDateStr(monthStart, -1)
  const prevMonthStart = `${prevMonthStartRaw.slice(0, 7)}-01`
  const prevMonthSameDay = offsetDateStr(prevMonthStart, dayOfMonth - 1)
  const prevSales = money(
    ordersInRange(db, tenantId, prevMonthStart, prevMonthSameDay).reduce(
      (s, o) => s + o.payAmount,
      0
    )
  )
  const monthGrowth = prevSales > 0 ? Math.round(((monthSales - prevSales) / prevSales) * 100) : 0

  const lowStock = db.stocks.filter((s) => s.tenantId === tenantId && s.stockStatus !== 'normal')
  const returnCount = db.returns.filter(
    (r) => r.tenantId === tenantId && r.createTime.startsWith(today.slice(0, 7))
  ).length

  // 近 14 天趋势
  const trend: Api.Dashboard.TrendItem[] = []
  for (let i = 13; i >= 0; i--) {
    const date = daysAgoStr(i)
    const dayOrders = ordersInRange(db, tenantId, date, date)
    trend.push({
      date: date.slice(5),
      sales: money(dayOrders.reduce((s, o) => s + o.payAmount, 0)),
      orders: dayOrders.length,
      profit: money(dayOrders.reduce((s, o) => s + (o.payAmount - orderCostAmount(db, o)), 0))
    })
  }

  // 近 7 天热销商品
  const weekStart = daysAgoStr(6)
  const weekOrders = ordersInRange(db, tenantId, weekStart, today)
  const hotMap = new Map<string, { quantity: number; amount: number }>()
  weekOrders.forEach((order) => {
    order.items.forEach((item) => {
      const current = hotMap.get(item.productId) ?? { quantity: 0, amount: 0 }
      current.quantity += item.quantity
      current.amount = money(current.amount + item.amount)
      hotMap.set(item.productId, current)
    })
  })
  const hotProducts: Api.Dashboard.HotItem[] = [...hotMap.entries()]
    .map(([productId, value]) => {
      const product = db.products.find((p) => p.id === productId)
      // 库存：汇总该商品在本租户的货架 + 仓库库存（含中央仓备货，与后端 setStockInfo 口径一致）
      const stocks = db.stocks.filter((s) => s.productId === productId && s.tenantId === tenantId)
      return {
        productId,
        name: product?.name ?? '已下架商品',
        image: product?.image ?? '',
        price: product?.salePrice ?? 0,
        quantity: value.quantity,
        amount: value.amount,
        shelfQuantity: stocks.reduce((s, item) => s + item.shelfQuantity, 0),
        warehouseQuantity: stocks.reduce((s, item) => s + item.warehouseQuantity, 0)
      }
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6)

  // 排行：总部看租户，门店看收银员
  const rankMap = new Map<string, { amount: number; orders: number }>()
  const rankSource = isSuperAdmin
    ? db.orders.filter((o) => {
        const date = o.createTime.slice(0, 10)
        return date >= weekStart && date <= today
      })
    : weekOrders
  const rankKey = (order: Api.Order.SalesOrder) => (isSuperAdmin ? order.tenantId : order.cashier)
  rankSource.forEach((order) => {
    const key = rankKey(order)
    const current = rankMap.get(key) ?? { amount: 0, orders: 0 }
    current.amount = money(current.amount + order.payAmount)
    current.orders += 1
    rankMap.set(key, current)
  })
  const rankList: Api.Dashboard.RankItem[] = [...rankMap.entries()]
    .map(([key, value]) => ({
      name: isSuperAdmin
        ? (db.tenants.find((t) => t.id === key)?.name ?? key)
        : key || '未知收银员',
      amount: value.amount,
      orders: value.orders
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 6)

  return {
    stats: {
      todaySales,
      todayOrders: todayOrdersCount,
      todayProfit,
      todayAov: todayOrdersCount ? money(todaySales / todayOrdersCount) : 0,
      monthSales,
      monthGrowth,
      lowStockCount: lowStock.length,
      returnCount
    },
    trend,
    hotProducts,
    rankList,
    lowStock: lowStock
      .map((s) => ({
        ...s,
        stockValue: money(s.totalQuantity * s.purchasePrice),
        warning: true
      }))
      .sort(
        (a, b) =>
          a.shelfQuantity / (a.warnThreshold || 1) - b.shelfQuantity / (b.warnThreshold || 1)
      )
      .slice(0, 5),
    recentOrders: db.orders
      .filter((o) => o.tenantId === tenantId)
      .sort((a, b) => b.createTime.localeCompare(a.createTime))
      .slice(0, 6)
  }
}

/** 销售总览趋势（日/周/月/年）：本地生成确定性模拟数据（网络不可达时的降级数据源） */
export async function fetchSalesTrend(
  range: 'day' | 'week' | 'month' | 'year'
): Promise<Api.Dashboard.SalesTrendPoint[]> {
  await delay(200)
  const now = new Date()
  // 桶：key 与真实后端 statKey 对齐；scale 控制各粒度的量级
  const buckets: { key: string; label: string; scale: number }[] = []

  if (range === 'day') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      buckets.push({ key: dateKeyOf(d), label: `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`, scale: 1 })
    }
  } else if (range === 'week') {
    const monday = new Date(now)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    for (let w = 11; w >= 0; w--) {
      const start = new Date(monday)
      start.setDate(start.getDate() - w * 7)
      buckets.push({ key: dateKeyOf(start), label: `${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`, scale: 7 })
    }
  } else if (range === 'month') {
    for (let m = 11; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1)
      buckets.push({
        key: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`,
        label: `${d.getMonth() + 1}月`,
        scale: 30
      })
    }
  } else {
    const year = now.getFullYear()
    for (let y = 4; y >= 0; y--) {
      buckets.push({ key: String(year - y), label: String(year - y), scale: 365 })
    }
  }

  return buckets.map(({ key, label, scale }) => {
    const orders = seededValue(`${key}-o`, Math.round(12 * scale), Math.round(35 * scale))
    // 客单价 25~55 元，毛利率 20%~32%
    const aov = seededValue(`${key}-a`, 2500, 5500) / 100
    const sales = money(orders * aov)
    const profit = money(sales * (seededValue(`${key}-p`, 20, 32) / 100))
    return { label, orders, sales, profit }
  })
}
