import * as financeService from '@/mock/service/finance.service'
import { daysAgoStr, formatDateTime, includesKeyword, todayStr } from '@/mock/service/core/helpers'
import type { BackendPageResult } from '@/types/common/response'
import { api, callWithFallback, toBackendPage, toPaginated } from './core/backend'

// 收支分类选项（供新增弹窗）
export const FLOW_CATEGORIES = financeService.FLOW_CATEGORIES

/** 后端按天/按支付方式聚合流水（DailyPaymentFlowVO：inflow 收款 / outflow 退款） */
interface BackendDailyPaymentFlowVO {
  payDate?: string
  paymentMethod?: string
  paymentMethodName?: string
  inflow?: number
  outflow?: number
  inflowCount?: number
  outflowCount?: number
}

/** 金额保留两位小数 */
const money = (n?: number): number => Math.round((Number(n ?? 0) || 0) * 100) / 100

/** 是否为完整日期（yyyy-MM-dd） */
const isFullDate = (v?: string): boolean => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** 后端聚合行 → 收支流水（收款→销售收款，退款→销售退款；后端无逐笔单号/操作人） */
const toFlowItems = (vo: BackendDailyPaymentFlowVO): Api.Finance.FlowItem[] => {
  const payDate = vo.payDate ?? ''
  const method = vo.paymentMethodName || vo.paymentMethod || ''
  const code = vo.paymentMethod || ''
  const inflow = money(vo.inflow)
  const outflow = money(vo.outflow)
  const items: Api.Finance.FlowItem[] = []
  if (inflow > 0) {
    items.push({
      id: `PF_IN_${payDate}_${code}`,
      tenantId: '',
      flowNo: `SR${payDate.replace(/-/g, '')}_${code}`,
      type: 'income',
      category: '销售收款',
      amount: inflow,
      method,
      relatedNo: '',
      operator: '',
      createTime: payDate,
      remark: `收款 ${Number(vo.inflowCount ?? 0)} 笔`
    })
  }
  if (outflow > 0) {
    items.push({
      id: `PF_OUT_${payDate}_${code}`,
      tenantId: '',
      flowNo: `TK${payDate.replace(/-/g, '')}_${code}`,
      type: 'expense',
      category: '销售退款',
      amount: outflow,
      method,
      relatedNo: '',
      operator: '',
      createTime: payDate,
      remark: `退款 ${Number(vo.outflowCount ?? 0)} 笔`
    })
  }
  return items
}

/** 指定日期的聚合行 → 日结单（后端为实时计算、无「待日结」状态，统一 settled） */
const toDailyItem = (date: string, rows: BackendDailyPaymentFlowVO[]): Api.Finance.DailyItem => {
  const income = money(rows.reduce((s, r) => s + (Number(r.inflow) || 0), 0))
  const expense = money(rows.reduce((s, r) => s + (Number(r.outflow) || 0), 0))
  return {
    id: `D_${date}`,
    tenantId: '',
    date,
    salesAmount: income,
    refundAmount: expense,
    incomeAmount: income,
    expenseAmount: expense,
    netAmount: money(income - expense),
    orderCount: rows.reduce((s, r) => s + (Number(r.inflowCount) || 0), 0),
    status: 'settled',
    operator: '',
    createTime: date
  }
}

/** 全量 List 本地分页（后端流水/日结接口不支持分页） */
function paginateLocally<T>(
  list: T[],
  params?: { current?: number; size?: number }
): Api.Common.PaginatedResponse<T> {
  const current = Math.max(1, Number(params?.current) || 1)
  const size = Math.max(1, Number(params?.size) || 20)
  const start = (current - 1) * size
  return { records: list.slice(start, start + size), current, size, total: list.length }
}

// 后端逐笔支付明细（oms_order_payment，含关联订单号与操作人），映射为收支流水项
interface BackendPaymentRecordVO {
  id?: number
  paymentNo?: string
  orderId?: number
  orderNo?: string
  recordType?: number
  type?: 'income' | 'expense'
  category?: string
  amount?: number
  receivedAmount?: number
  changeAmount?: number
  paymentMethod?: string
  paymentMethodName?: string
  operatorId?: number
  operatorName?: string
  payTime?: string
  remark?: string
}

/** 后端逐笔支付明细 → 收支流水项（补齐关联单号/操作人） */
const toFlowItem = (vo: BackendPaymentRecordVO): Api.Finance.FlowItem => {
  const isExpense = vo.type === 'expense'
  return {
    id: String(vo.id ?? ''),
    tenantId: '',
    flowNo: vo.paymentNo || '',
    type: isExpense ? 'expense' : 'income',
    category: vo.category || (isExpense ? '销售退款' : '销售收款'),
    amount: money(vo.amount),
    method: vo.paymentMethodName || vo.paymentMethod || '',
    relatedNo: vo.orderNo || '',
    operator: vo.operatorName || '',
    createTime: (vo.payTime || '').replace('T', ' ').slice(0, 19),
    remark: vo.remark || ''
  }
}

// 收支流水列表（逐笔支付明细：后端 oms_order_payment，已关联订单号与操作人；
// 类型/关联单号/日期走后端过滤，分类/流水号本地过滤；后端不可用时降级本地 Mock）
export function fetchGetFlowList(
  params: Api.Finance.FlowSearchParams
): Promise<Api.Finance.FlowList> {
  return callWithFallback(
    () => {
      const query = {
        ...toBackendPage(params),
        startDate: params.startTime || undefined,
        endDate: params.endTime || undefined,
        type: params.type || undefined,
        orderNo: params.relatedNo || undefined
      }
      return api
        .get<BackendPageResult<BackendPaymentRecordVO>>({
          url: '/api/v1/orders/payment-records',
          params: query
        })
        .then((page) => {
          const result = toPaginated(page, toFlowItem)
          if (params.category) {
            result.records = result.records.filter((f) => f.category === params.category)
          }
          if (params.flowNo) {
            result.records = result.records.filter((f) => includesKeyword(f.flowNo, params.flowNo))
          }
          return result
        })
    },
    () => financeService.fetchFlowList(params)
  )
}

// 新增收支流水（手动记账，后端无对应接口：oms_order_payment 仅由订单结算自动写入，
// 无新增收支的 Controller，保留本地 Mock）
export function fetchCreateFlow(
  data: Partial<Api.Finance.FlowItem>
): Promise<Api.Finance.FlowItem> {
  return financeService.fetchCreateFlow(data)
}

// 日结列表（后端无落库日结单，按支付流水按天聚合实时生成；
// 支持 yyyy-MM-dd 精确查询，否则查近 90 天并按日期子串本地过滤）
export function fetchGetDailyList(
  params: Api.Finance.DailySearchParams
): Promise<Api.Finance.DailyList> {
  return callWithFallback(
    () => {
      const dateFilter = params.date
      const statusFilter = params.status
      const fullDate = isFullDate(dateFilter) ? dateFilter : undefined
      return api
        .get<BackendDailyPaymentFlowVO[]>({
          url: '/api/v1/orders/daily-payment-flow',
          params: { startDate: fullDate ?? daysAgoStr(89), endDate: fullDate ?? todayStr() }
        })
        .then((rows) => {
          const grouped = new Map<string, BackendDailyPaymentFlowVO[]>()
          ;(rows ?? []).forEach((r) => {
            const date = r.payDate ?? ''
            if (!grouped.has(date)) grouped.set(date, [])
            grouped.get(date)?.push(r)
          })
          let list = [...grouped.entries()]
            .map(([date, dayRows]) => toDailyItem(date, dayRows))
            .filter((d) => !dateFilter || d.date.includes(dateFilter))
            .filter((d) => !statusFilter || d.status === statusFilter)
          list = list.sort((a, b) => b.date.localeCompare(a.date))
          return paginateLocally(list, params)
        })
    },
    () => financeService.fetchDailyList(params)
  )
}

// 生成/重算日结单（后端 daily-settlement 为只读实时计算、不落库，映射为当天聚合结果）
export function fetchGenerateDaily(date?: string): Promise<Api.Finance.DailyItem> {
  return callWithFallback(
    () => {
      const targetDate = date || todayStr()
      return api
        .get<BackendDailyPaymentFlowVO[]>({
          url: '/api/v1/orders/daily-settlement',
          params: { date: targetDate }
        })
        .then((rows) => ({ ...toDailyItem(targetDate, rows ?? []), createTime: formatDateTime() }))
    },
    () => financeService.fetchGenerateDaily(date)
  )
}

// 经营报表（由 daily-payment-flow 按天聚合 trend/summary/收入构成；
// 支出构成仅能取到退款（outflow）；/reports/dashboard 仅今日/本月聚合，无法映射任意天数窗口，未采用）
export function fetchGetFinanceReport(days = 30): Promise<Api.Finance.ReportData> {
  return callWithFallback(
    () => {
      const startDate = daysAgoStr(days - 1)
      const endDate = todayStr()
      return api
        .get<BackendDailyPaymentFlowVO[]>({
          url: '/api/v1/orders/daily-payment-flow',
          params: { startDate, endDate }
        })
        .then((rows) => {
          const list = rows ?? []
          const income = money(list.reduce((s, r) => s + (Number(r.inflow) || 0), 0))
          const expense = money(list.reduce((s, r) => s + (Number(r.outflow) || 0), 0))
          const orderCount = list.reduce((s, r) => s + (Number(r.inflowCount) || 0), 0)

          const trend: Api.Finance.ReportTrendItem[] = []
          for (let i = 0; i < days; i++) {
            const date = daysAgoStr(days - 1 - i)
            const dayRows = list.filter((r) => r.payDate === date)
            const dayIncome = money(dayRows.reduce((s, r) => s + (Number(r.inflow) || 0), 0))
            const dayExpense = money(dayRows.reduce((s, r) => s + (Number(r.outflow) || 0), 0))
            trend.push({
              date: date.slice(5),
              income: dayIncome,
              expense: dayExpense,
              net: money(dayIncome - dayExpense)
            })
          }

          // 收入构成按支付方式聚合
          const incomeGrouped = new Map<string, number>()
          list.forEach((r) => {
            const inflow = money(r.inflow)
            if (inflow > 0) {
              const name = r.paymentMethodName || r.paymentMethod || '其它'
              incomeGrouped.set(name, money((incomeGrouped.get(name) ?? 0) + inflow))
            }
          })
          const incomeTotal = money([...incomeGrouped.values()].reduce((s, v) => s + v, 0)) || 1
          const incomeCategory: Api.Finance.ReportCategoryItem[] = [...incomeGrouped.entries()]
            .map(([name, amount]) => ({
              name,
              amount,
              ratio: Math.round((amount / incomeTotal) * 1000) / 10,
              type: 'income' as const
            }))
            .sort((a, b) => b.amount - a.amount)

          // 支出构成：后端支出仅为订单退款
          const refundAmount = money(expense)
          const expenseCategory: Api.Finance.ReportCategoryItem[] =
            refundAmount > 0
              ? [{ name: '销售退款', amount: refundAmount, ratio: 100, type: 'expense' }]
              : []

          return {
            summary: {
              income,
              expense,
              net: money(income - expense),
              orderCount,
              refundAmount,
              avgOrderAmount: orderCount ? money(income / orderCount) : 0
            },
            trend,
            incomeCategory,
            expenseCategory
          }
        })
    },
    () => financeService.fetchFinanceReport(days)
  )
}

/* ------------------------------ 支付账户（GET/POST/PUT/DELETE /api/v1/payment-methods） ------------------------------ */

/** 后端支付账户（sys_payment_method 实体） */
interface BackendPaymentMethodVO {
  id: number
  tenantId?: number
  name?: string
  code?: string
  icon?: string
  sort?: number
  /** 1 启用 / 0 停用 */
  status?: number
  balance?: number
  remark?: string
  createTime?: string
  updateTime?: string
}

/** 后端状态（1 启用）→ 前端启用状态（'1' 启用 / '2' 停用） */
const toEnableStatus = (status?: number): Api.Common.EnableStatus => (status === 1 ? '1' : '2')

/** 前端启用状态 → 后端状态 */
const toBackendStatus = (status?: Api.Common.EnableStatus): number | undefined =>
  status === '1' ? 1 : status === '2' ? 0 : undefined

/** 后端支付账户 → 前端支付账户 */
const toPaymentAccount = (vo: BackendPaymentMethodVO): Api.Finance.PaymentAccountItem => ({
  id: String(vo.id),
  tenantId: vo.tenantId != null ? String(vo.tenantId) : undefined,
  name: vo.name ?? '',
  code: vo.code ?? '',
  icon: vo.icon ?? undefined,
  sort: Number(vo.sort ?? 0),
  status: toEnableStatus(vo.status),
  balance: money(vo.balance),
  remark: vo.remark ?? '',
  createTime: vo.createTime ? vo.createTime.replace('T', ' ').slice(0, 19) : '',
  updateTime: vo.updateTime ? vo.updateTime.replace('T', ' ').slice(0, 19) : ''
})

/** 前端入参 → 后端实体（balance 由结算/充值维护，不由页面编辑） */
const toPaymentMethodBody = (data: Api.Finance.PaymentAccountUpsertPayload) => ({
  name: (data.name ?? '').trim(),
  code: (data.code ?? '').trim(),
  sort: data.sort != null ? Number(data.sort) : undefined,
  status: toBackendStatus(data.status),
  remark: data.remark ?? ''
})

// 支付账户列表
export function fetchGetPaymentAccountList(): Promise<Api.Finance.PaymentAccountItem[]> {
  return callWithFallback(
    () =>
      api
        .get<BackendPaymentMethodVO[]>({ url: '/api/v1/payment-methods' })
        .then((list) => (list ?? []).map(toPaymentAccount)),
    () => financeService.fetchPaymentAccountList()
  )
}

// 新增支付账户
export function fetchCreatePaymentAccount(
  data: Api.Finance.PaymentAccountUpsertPayload
): Promise<Api.Finance.PaymentAccountItem> {
  return callWithFallback(
    async () => {
      const id = await api.post<number>({
        url: '/api/v1/payment-methods',
        data: toPaymentMethodBody(data)
      })
      const list = await api.get<BackendPaymentMethodVO[]>({ url: '/api/v1/payment-methods' })
      const vo = (list ?? []).find((item) => item.id === Number(id))
      return toPaymentAccount(vo ?? { id, ...toPaymentMethodBody(data) })
    },
    () => financeService.fetchCreatePaymentAccount(data)
  )
}

// 编辑支付账户
export function fetchUpdatePaymentAccount(
  data: Api.Finance.PaymentAccountUpsertPayload
): Promise<Api.Finance.PaymentAccountItem> {
  return callWithFallback(
    async () => {
      await api.put<void>({
        url: `/api/v1/payment-methods/${data.id}`,
        data: toPaymentMethodBody(data)
      })
      const list = await api.get<BackendPaymentMethodVO[]>({ url: '/api/v1/payment-methods' })
      const vo = (list ?? []).find((item) => item.id === Number(data.id))
      return toPaymentAccount(vo ?? { id: Number(data.id), ...toPaymentMethodBody(data) })
    },
    () => financeService.fetchUpdatePaymentAccount(data)
  )
}

// 删除支付账户
export function fetchDeletePaymentAccount(id: string): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/payment-methods/${id}` }),
    () => financeService.fetchDeletePaymentAccount(id)
  )
}
