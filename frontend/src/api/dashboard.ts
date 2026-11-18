/**
 * 工作台（经营驾驶舱）API
 *
 * 真实后端：/reports/dashboard + /reports/daily(近14天) + /products/hot + /orders + /stock 聚合，
 * 网络不可达时由 callWithFallback 统一降级本地 Mock；
 * 单个数据源业务失败只做局部兜底（对应区块给默认值），避免看板整体挂掉
 */
import * as dashboardService from '@/mock/service/dashboard.service'
import * as memberService from '@/mock/service/member.service'
import { api, callWithFallback } from './core/backend'
import { isNetworkError } from '@/utils/http/error'
import { useUserStore } from '@/store/modules/user'
import type { BackendPageResult } from '@/types/common/response'

/* ------------------------------ 后端数据结构 ------------------------------ */

/** 仪表盘汇总（GET /reports/dashboard → DashboardVO） */
interface BackendDashboardVO {
  todaySalesAmount?: number
  todayOrderCount?: number
  monthSalesAmount?: number
  monthOrderCount?: number
  monthProfitAmount?: number
  lowStockCount?: number
}

/** 日报（GET /reports/daily → DailyReportVO，仅取趋势所需字段） */
interface BackendDailyReportVO {
  statDate?: string
  orderCount?: number
  payAmount?: number
  profitAmount?: number
}

/** 商品（GET /products/hot → ProductVO，仅取热销映射所需字段） */
interface BackendHotProductVO {
  id?: number
  name?: string
  /** 销量（后端按订单明细聚合的真实销量） */
  saleCount?: number
  salePrice?: number
  /** 销售额（后端按订单明细聚合的真实销售额） */
  salesAmount?: number
  /** 商品图片 */
  image?: string
  /** 货架库存 */
  shelfQuantity?: number
  /** 仓库库存 */
  warehouseQuantity?: number
}

/** 订单（GET /orders → OrderVO，仅取看板最近订单所需字段） */
interface BackendOrderVO {
  id?: number
  orderNo?: string
  memberName?: string
  totalAmount?: number
  discountAmount?: number
  payAmount?: number
  orderStatus?: number
  totalQuantity?: number
  cashierName?: string
  createTime?: string
}

/** 库存（GET /stock → StockVO，仅取低库存映射所需字段） */
interface BackendStockVO {
  id?: number
  tenantId?: number
  storeId?: number
  storeName?: string
  productId?: number
  productName?: string
  barcode?: string
  shelfQuantity?: number
  avgCost?: number
}

/** 收银员业绩排行项（GET /reports/cashier-rank → CashierRankVO） */
interface BackendCashierRankVO {
  operatorId?: number
  operatorName?: string
  orderCount?: number
  salesAmount?: number
}

/* ------------------------------ 常量 ------------------------------ */

/** 趋势天数（与看板「近 14 天销售趋势」一致） */
const TREND_DAYS = 14

/** 热销商品条数（与本地 Mock 一致） */
const HOT_LIMIT = 6

/** 最近订单条数 */
const RECENT_LIMIT = 5

/** 后端低库存口径：货架库存 < 10（与 reports/dashboard 的 lowStockCount 一致，后端无按商品的安全库存字段） */
const LOW_STOCK_LIMIT = 10

/** 低库存扫描窗口（/stock 无按库存量排序能力，取首屏商品本地过滤） */
const LOW_STOCK_SCAN = 200

/** 低库存展示条数（与本地 Mock 一致） */
const LOW_STOCK_SHOWN = 5

/* ------------------------------ 工具与映射 ------------------------------ */

/** 金额保留两位小数 */
const money = (n?: number): number => Math.round((Number(n ?? 0) || 0) * 100) / 100

/** 指定偏移天数的日期（yyyy-MM-dd，取浏览器本地时区） */
function dayStr(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() - offset)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Date → yyyy-MM-dd（本地时区） */
function dateKeyOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * 数据源局部兜底：业务错误给默认值，网络错误继续抛出（交由 callWithFallback 统一降级 Mock）
 * @param task 真实后端取数
 * @param fallback 业务失败时的默认值
 * @param label 数据源标识（用于 console.warn 排查）
 */
async function safe<T>(task: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await task()
  } catch (error) {
    if (isNetworkError(error)) throw error
    console.warn(`[API] 驾驶舱数据源 ${label} 获取失败，已使用默认值`, error)
    return fallback
  }
}

/**
 * 后端订单状态数字（0 待支付 / 1 已支付 / 2 已完成 / 3 已取消 / 4 已退款）→ 前端状态
 * 看板仅展示状态标签，其余（含待支付）兜底为 paid
 */
const toStatus = (orderStatus?: number): Api.Order.OrderStatus => {
  if (orderStatus === 4) return 'refunded'
  if (orderStatus === 3) return 'cancelled'
  return 'paid'
}

/** 后端 OrderVO → 前端销售订单（精简映射：看板只用单号/收银员/金额/状态，其余给默认值） */
const toRecentOrder = (vo: BackendOrderVO): Api.Order.SalesOrder => ({
  id: String(vo.id ?? ''),
  tenantId: '',
  orderNo: vo.orderNo ?? '',
  source: 'pos',
  warehouseId: '',
  warehouseName: '',
  items: [],
  quantity: Number(vo.totalQuantity ?? 0),
  totalAmount: money(vo.totalAmount),
  discountAmount: money(vo.discountAmount),
  payAmount: money(vo.payAmount),
  payments: [],
  status: toStatus(vo.orderStatus),
  memberName: vo.memberName ?? '',
  cashier: vo.cashierName ?? '',
  createTime: vo.createTime ?? '',
  remark: ''
})

/** 后端 StockVO → 前端库存项（看板低库存以货架库存为口径，后端无安全库存字段时取默认阈值） */
const toLowStockItem = (vo: BackendStockVO): Api.Warehouse.StockItem => {
  const quantity = Number(vo.shelfQuantity ?? 0)
  const avgCost = Number(vo.avgCost ?? 0)
  return {
    id: String(vo.id ?? ''),
    tenantId: String(vo.tenantId ?? ''),
    warehouseId: String(vo.storeId ?? ''),
    warehouseName: vo.storeName ?? '',
    productId: String(vo.productId ?? ''),
    barcode: vo.barcode ?? '',
    productName: vo.productName ?? '',
    categoryId: '',
    unit: '',
    warehouseQuantity: 0,
    shelfQuantity: quantity,
    pendingInQuantity: 0,
    totalQuantity: quantity,
    warnThreshold: LOW_STOCK_LIMIT,
    urgentThreshold: Math.max(1, Math.floor(LOW_STOCK_LIMIT / 3)),
    thresholdOverridden: false,
    stockStatus: quantity <= 0 ? 'out_of_stock' : 'warning',
    replenishType: 'purchase',
    quantity: 0,
    safetyStock: LOW_STOCK_LIMIT,
    purchasePrice: avgCost,
    salePrice: 0,
    stockValue: money(quantity * avgCost),
    warning: true,
    updateTime: ''
  }
}

/* ------------------------------ 真实后端聚合 ------------------------------ */

/**
 * 收银员业绩排行：将后端 /reports/cashier-rank 映射为前端 RankItem
 * - 仅非总部（R_SUPER）角色填充；总部看门店营业额，后端暂无对应接口，返回空
 * - 按销售订单数量（orderCount）降序，取前 6
 */
function buildCashierRankList(data: BackendCashierRankVO[] | null): Api.Dashboard.RankItem[] {
  const roles = useUserStore().info.roles ?? []
  if (roles.includes('R_SUPER') || !data || data.length === 0) return []
  return data
    .map((c) => ({
      name: c.operatorName || '未知收银员',
      amount: money(c.salesAmount),
      orders: Number(c.orderCount ?? 0)
    }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 6)
}

/** 真实后端聚合取数：各数据源并行请求，业务失败局部兜底，网络错误整体降级 Mock */
async function fetchOverviewFromBackend(): Promise<Api.Dashboard.Overview> {
  const today = dayStr(0)
  const monthStart = `${today.slice(0, 7)}-01`
  const trendDates = Array.from({ length: TREND_DAYS }, (_, i) => dayStr(TREND_DAYS - 1 - i))
  // 后端无批量日报接口，近 14 天趋势按天并行拉取（业务错误各自兜底为 0，保持图表刻度完整）
  const dailyTasks = trendDates.map((date) =>
    safe<BackendDailyReportVO | null>(
      () =>
        api.get<BackendDailyReportVO>({
          url: '/api/v1/reports/daily',
          params: { date },
          showErrorMessage: false
        }),
      null,
      `reports/daily ${date}`
    )
  )

  const [dashboard, dailies, hotProducts, orderPage, stockPage, refundPage, cashierRank] =
    await Promise.all([
      safe<BackendDashboardVO | null>(
        () =>
          api.get<BackendDashboardVO>({ url: '/api/v1/reports/dashboard', showErrorMessage: false }),
        null,
        'reports/dashboard'
      ),
      Promise.all(dailyTasks),
      safe<BackendHotProductVO[] | null>(
        () =>
          api.get<BackendHotProductVO[]>({
            url: '/api/v1/products/hot',
            params: { limit: HOT_LIMIT },
            showErrorMessage: false
          }),
        null,
        'products/hot'
      ),
      safe<BackendPageResult<BackendOrderVO> | null>(
        () =>
          api.get<BackendPageResult<BackendOrderVO>>({
            url: '/api/v1/orders',
            params: { page: 1, pageSize: RECENT_LIMIT },
            showErrorMessage: false
          }),
        null,
        'orders'
      ),
      safe<BackendPageResult<BackendStockVO> | null>(
        () =>
          api.get<BackendPageResult<BackendStockVO>>({
            url: '/api/v1/stock',
            params: { page: 1, pageSize: LOW_STOCK_SCAN },
            showErrorMessage: false
          }),
        null,
        'stock'
      ),
      // 后端无退货单接口，用「本月已退款订单数」近似 Mock 的本月退货单笔数
      safe<BackendPageResult<unknown> | null>(
        () =>
          api.get<BackendPageResult<unknown>>({
            url: '/api/v1/orders',
            params: {
              page: 1,
              pageSize: 1,
              orderStatus: 4,
              startDate: `${monthStart} 00:00:00`,
              endDate: `${today} 23:59:59`
            },
            showErrorMessage: false
          }),
        null,
        'orders/refund'
      ),
      // 收银员业绩排行：仅非总部角色展示（总部看门店营业额，后端暂无对应接口）
      safe<BackendCashierRankVO[] | null>(
        () =>
          api.get<BackendCashierRankVO[]>({
            url: '/api/v1/reports/cashier-rank',
            params: { days: 7, limit: 6 },
            showErrorMessage: false
          }),
        null,
        'reports/cashier-rank'
      )
    ])

  const todaySales = money(dashboard?.todaySalesAmount)
  const todayOrders = Number(dashboard?.todayOrderCount ?? 0)
  // DashboardVO 无今日毛利，取今日日报的 profitAmount
  const todayDaily = dailies[dailies.length - 1]

  const trend: Api.Dashboard.TrendItem[] = trendDates.map((date, index) => {
    const daily = dailies[index]
    return {
      date: date.slice(5),
      sales: money(daily?.payAmount),
      orders: Number(daily?.orderCount ?? 0),
      profit: money(daily?.profitAmount)
    }
  })

  // 低库存：本地过滤货架库存 < 10（仅保留有库存记录的商品，口径对齐后端 lowStockCount）
  const lowStock = (stockPage?.list ?? [])
    .filter((vo) => vo.id != null && Number(vo.shelfQuantity ?? 0) < LOW_STOCK_LIMIT)
    .map(toLowStockItem)
    .sort((a, b) => a.shelfQuantity - b.shelfQuantity)
    .slice(0, LOW_STOCK_SHOWN)

  return {
    stats: {
      todaySales,
      todayOrders,
      todayProfit: money(todayDaily?.profitAmount),
      todayAov: todayOrders > 0 ? money(todaySales / todayOrders) : 0,
      monthSales: money(dashboard?.monthSalesAmount),
      // DashboardVO 无上月同期口径，无法计算环比，给 0
      monthGrowth: 0,
      lowStockCount: Number(dashboard?.lowStockCount ?? 0),
      returnCount: refundPage?.total ?? 0
    },
    trend,
    hotProducts: (hotProducts ?? []).map((p) => ({
      productId: String(p.id ?? ''),
      name: p.name ?? '',
      image: p.image ?? '',
      price: money(Number(p.salePrice ?? 0)),
      quantity: Number(p.saleCount ?? 0),
      // 后端已按订单明细聚合真实销售额；兼容旧后端：缺省时按 销量 × 售价 估算
      amount: money(
        p.salesAmount != null
          ? Number(p.salesAmount)
          : Number(p.saleCount ?? 0) * Number(p.salePrice ?? 0)
      ),
      // 库存状态推导用（缺省 0：后端未返回库存时按缺货展示，待后端补全）
      shelfQuantity: Number(p.shelfQuantity ?? 0),
      warehouseQuantity: Number(p.warehouseQuantity ?? 0)
    })),
    // 收银员业绩排行：按销售订单数量排序（后端 /reports/cashier-rank，仅非总部角色填充；
    // 总部看门店营业额，后端暂无对应接口，保持空数组，页面有空态兜底）
    rankList: buildCashierRankList(cashierRank),
    lowStock,
    recentOrders: (orderPage?.list ?? []).map(toRecentOrder)
  }
}

/* ------------------------------ 对外接口 ------------------------------ */

// 工作台经营驾驶舱数据（真实后端聚合，网络不可达降级本地 Mock；角色数据范围由后端租户隔离处理）
export function fetchDashboardOverview(): Promise<Api.Dashboard.Overview> {
  return callWithFallback(
    () => fetchOverviewFromBackend(),
    () => dashboardService.fetchDashboardOverview()
  )
}

/* ------------------------------ 销售总览趋势（日/周/月/年） ------------------------------ */

/** 时间范围：日=近14天按日 / 周=近12周按周 / 月=近12月按月 / 年=近5年按年 */
export type SalesTrendRange = 'day' | 'week' | 'month' | 'year'

/** 后端销售总览趋势（GET /reports/sales-trend → SalesTrendVO） */
interface BackendSalesTrendVO {
  /** 分组键：日/周=yyyy-MM-dd，月=yyyy-MM，年=yyyy */
  statKey?: string
  payAmount?: number
  orderCount?: number
  profitAmount?: number
}

/**
 * 生成各 range 的分组桶（key 与后端 statKey 对齐）：
 * 周 key 为周一日期，由前端聚合该周 7 天的日数据
 */
function buildSalesTrendBuckets(range: SalesTrendRange): { key: string; label: string }[] {
  const today = new Date()
  const buckets: { key: string; label: string }[] = []

  if (range === 'day') {
    for (let i = 13; i >= 0; i--) buckets.push({ key: dayStr(i), label: dayStr(i).slice(5) })
  } else if (range === 'week') {
    const monday = new Date(today)
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    for (let w = 11; w >= 0; w--) {
      const start = new Date(monday)
      start.setDate(start.getDate() - w * 7)
      buckets.push({ key: dateKeyOf(start), label: dateKeyOf(start).slice(5) })
    }
  } else if (range === 'month') {
    for (let m = 11; m >= 0; m--) {
      const d = new Date(today.getFullYear(), today.getMonth() - m, 1)
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: `${d.getMonth() + 1}月`
      })
    }
  } else {
    const year = today.getFullYear()
    for (let y = 4; y >= 0; y--) buckets.push({ key: String(year - y), label: String(year - y) })
  }
  return buckets
}

/** 真实后端取数：后端单条 SQL 聚合；缺失分组补 0，保证 X 轴刻度完整 */
async function fetchSalesTrendFromBackend(
  range: SalesTrendRange
): Promise<Api.Dashboard.SalesTrendPoint[]> {
  const rows = await api.get<BackendSalesTrendVO[]>({
    url: '/api/v1/reports/sales-trend',
    params: { range },
    showErrorMessage: false
  })
  const rowMap = new Map((rows ?? []).map((r) => [String(r.statKey), r]))
  const buckets = buildSalesTrendBuckets(range)

  // 周维度：后端按日返回近 84 天，前端按周一聚合该周 7 天
  if (range === 'week') {
    return buckets.map(({ key, label }) => {
      const [y, m, d] = key.split('-').map(Number)
      const monday = new Date(y, m - 1, d)
      let orders = 0
      let sales = 0
      let profit = 0
      for (let i = 0; i < 7; i++) {
        const day = new Date(monday)
        day.setDate(day.getDate() + i)
        const row = rowMap.get(dateKeyOf(day))
        orders += Number(row?.orderCount ?? 0)
        sales += Number(row?.payAmount ?? 0)
        profit += Number(row?.profitAmount ?? 0)
      }
      return { label, orders, sales: money(sales), profit: money(profit) }
    })
  }

  return buckets.map(({ key, label }) => {
    const row = rowMap.get(key)
    return {
      label,
      orders: Number(row?.orderCount ?? 0),
      sales: money(row?.payAmount),
      profit: money(row?.profitAmount)
    }
  })
}

/** 销售总览趋势（真实后端 /reports/sales-trend，网络不可达降级本地 Mock） */
export function fetchSalesTrend(range: SalesTrendRange): Promise<Api.Dashboard.SalesTrendPoint[]> {
  return callWithFallback(
    () => fetchSalesTrendFromBackend(range),
    () => dashboardService.fetchSalesTrend(range)
  )
}

/* ------------------------------ 会员累计消费排行（重点客户） ------------------------------ */

/** 后端会员（MemberVO，仅取排行所需字段） */
interface BackendMemberRankVO {
  id?: number
  name?: string
  phone?: string
  levelName?: string
  totalConsume?: number
}

/** 会员累计消费排行 TOP（真实后端 /members/top-consume，网络不可达降级本地 Mock） */
export function fetchMemberConsumeRank(limit = 8): Promise<Api.Dashboard.MemberRankItem[]> {
  return callWithFallback(
    async () => {
      const rows = await api.get<BackendMemberRankVO[]>({
        url: '/api/v1/members/top-consume',
        params: { limit },
        showErrorMessage: false
      })
      return (rows ?? []).map((vo) => ({
        id: String(vo.id),
        name: vo.name ?? '',
        phone: vo.phone ?? '',
        levelName: vo.levelName || undefined,
        totalConsume: money(vo.totalConsume ?? 0)
      }))
    },
    () => memberService.fetchMemberConsumeRank(limit)
  )
}
