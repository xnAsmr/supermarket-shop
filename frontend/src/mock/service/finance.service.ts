/**
 * 财务管理服务（收支流水 / 日结 / 报表）
 */
import { getDb, persistDb, type MockDatabase } from './core/db'
import {
  delay,
  daysAgoStr,
  formatDateTime,
  genId,
  includesKeyword,
  money,
  paginate,
  todayStr
} from './core/helpers'
import { pushFlow } from './core/effects'
import { fail } from './core/result'
import { useTenantStore } from '@/store/modules/tenant'

const currentTid = (): string => useTenantStore().currentId

/** 支出分类（手动新增时可选） */
export const FLOW_CATEGORIES = {
  income: ['销售收款', '其它收入'],
  expense: [
    '采购付款',
    '销售退款',
    '门店租金',
    '水电费用',
    '人员工资',
    '物流运费',
    '损耗报废',
    '其它支出'
  ]
} as const

/** 收支流水列表 */
export async function fetchFlowList(
  params: Api.Finance.FlowSearchParams
): Promise<Api.Finance.FlowList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const list = db.flows
    .filter((f) => {
      if (f.tenantId !== tenantId) return false
      if (params.type && f.type !== params.type) return false
      if (params.category && f.category !== params.category) return false
      if (params.flowNo && !includesKeyword(f.flowNo, params.flowNo)) return false
      if (params.relatedNo && !includesKeyword(f.relatedNo, params.relatedNo)) return false
      const date = f.createTime.slice(0, 10)
      if (params.startTime && date < params.startTime) return false
      if (params.endTime && date > params.endTime) return false
      return true
    })
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
  return paginate(list, params)
}

/** 新增收支（手动记账） */
export async function fetchCreateFlow(
  data: Partial<Api.Finance.FlowItem>
): Promise<Api.Finance.FlowItem> {
  await delay(180)
  const db = getDb()
  const tenantId = currentTid()
  const amount = money(Number(data.amount) || 0)
  if (amount <= 0) fail('金额必须大于 0')
  if (!data.category) fail('请选择收支分类')
  if (data.type !== 'income' && data.type !== 'expense') fail('请选择收支类型')

  const flow = pushFlow(db, {
    tenantId,
    type: data.type,
    category: data.category,
    amount,
    method: data.method || '现金',
    operator: data.operator || '当前用户',
    remark: data.remark || ''
  })
  persistDb()
  return flow
}

/** 按日期+类型聚合流水 */
const aggregateByDate = (db: MockDatabase, tenantId: string, date: string) => {
  const flows = db.flows.filter((f) => f.tenantId === tenantId && f.createTime.startsWith(date))
  const income = money(flows.filter((f) => f.type === 'income').reduce((s, f) => s + f.amount, 0))
  const refund = money(
    flows
      .filter((f) => f.type === 'expense' && f.category === '销售退款')
      .reduce((s, f) => s + f.amount, 0)
  )
  const expense = money(flows.filter((f) => f.type === 'expense').reduce((s, f) => s + f.amount, 0))
  const orderCount = db.orders.filter(
    (o) => o.tenantId === tenantId && o.createTime.startsWith(date)
  ).length
  return { income, refund, expense, orderCount }
}

/** 日结列表 */
export async function fetchDailyList(
  params: Api.Finance.DailySearchParams
): Promise<Api.Finance.DailyList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const list = db.dailies
    .filter(
      (d) =>
        d.tenantId === tenantId &&
        (!params.date || d.date.includes(params.date)) &&
        (!params.status || d.status === params.status)
    )
    .sort((a, b) => b.date.localeCompare(a.date))
  return paginate(list, params)
}

/** 生成/重算指定日期的日结单 */
export async function fetchGenerateDaily(date?: string): Promise<Api.Finance.DailyItem> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()
  const targetDate = date || todayStr()
  if (targetDate > todayStr()) fail('不能对未来的日期生成日结')

  const stats = aggregateByDate(db, tenantId, targetDate)
  let daily = db.dailies.find((d) => d.tenantId === tenantId && d.date === targetDate)
  if (!daily) {
    daily = {
      id: genId('D'),
      tenantId,
      date: targetDate,
      salesAmount: 0,
      refundAmount: 0,
      incomeAmount: 0,
      expenseAmount: 0,
      netAmount: 0,
      orderCount: 0,
      status: 'pending',
      operator: '',
      createTime: ''
    }
    db.dailies.push(daily)
  }

  daily.salesAmount = stats.income
  daily.refundAmount = stats.refund
  daily.incomeAmount = stats.income
  daily.expenseAmount = stats.expense
  daily.netAmount = money(stats.income - stats.expense)
  daily.orderCount = stats.orderCount
  daily.status = 'settled'
  daily.operator = '当前操作员'
  daily.createTime = formatDateTime()

  persistDb()
  return daily
}

/** 财务报表 */
export async function fetchFinanceReport(days = 30): Promise<Api.Finance.ReportData> {
  await delay(200)
  const db = getDb()
  const tenantId = currentTid()
  const endDate = todayStr()
  const startDate = daysAgoStr(days - 1)

  const flows = db.flows.filter((f) => {
    if (f.tenantId !== tenantId) return false
    const date = f.createTime.slice(0, 10)
    return date >= startDate && date <= endDate
  })

  const income = money(flows.filter((f) => f.type === 'income').reduce((s, f) => s + f.amount, 0))
  const expense = money(flows.filter((f) => f.type === 'expense').reduce((s, f) => s + f.amount, 0))
  const refundAmount = money(
    flows
      .filter((f) => f.type === 'expense' && f.category === '销售退款')
      .reduce((s, f) => s + f.amount, 0)
  )
  const orders = db.orders.filter((o) => {
    if (o.tenantId !== tenantId) return false
    const date = o.createTime.slice(0, 10)
    return date >= startDate && date <= endDate
  })
  const orderCount = orders.length

  const trend: Api.Finance.ReportTrendItem[] = []
  for (let i = 0; i < days; i++) {
    const date = daysAgoStr(days - 1 - i)
    const dayFlows = flows.filter((f) => f.createTime.startsWith(date))
    const dayIncome = money(
      dayFlows.filter((f) => f.type === 'income').reduce((s, f) => s + f.amount, 0)
    )
    const dayExpense = money(
      dayFlows.filter((f) => f.type === 'expense').reduce((s, f) => s + f.amount, 0)
    )
    trend.push({
      date: date.slice(5),
      income: dayIncome,
      expense: dayExpense,
      net: money(dayIncome - dayExpense)
    })
  }

  const buildCategory = (type: Api.Finance.FlowType): Api.Finance.ReportCategoryItem[] => {
    const grouped = new Map<string, number>()
    flows
      .filter((f) => f.type === type)
      .forEach((f) => grouped.set(f.category, money((grouped.get(f.category) ?? 0) + f.amount)))
    const total = money([...grouped.values()].reduce((s, v) => s + v, 0)) || 1
    return [...grouped.entries()]
      .map(([name, amount]) => ({
        name,
        amount,
        ratio: Math.round((amount / total) * 1000) / 10,
        type
      }))
      .sort((a, b) => b.amount - a.amount)
  }

  return {
    summary: {
      income,
      expense,
      net: money(income - expense),
      orderCount,
      refundAmount,
      avgOrderAmount: orderCount
        ? money(orders.reduce((s, o) => s + o.payAmount, 0) / orderCount)
        : 0
    },
    trend,
    incomeCategory: buildCategory('income'),
    expenseCategory: buildCategory('expense')
  }
}

/* ------------------------------ 支付账户（sys_payment_method） ------------------------------ */

const findAccount = (db: MockDatabase, id: string): Api.Finance.PaymentAccountItem | undefined => {
  const tenantId = currentTid()
  return db.paymentMethods.find((a) => a.id === id && a.tenantId === tenantId)
}

/** 支付账户列表 */
export async function fetchPaymentAccountList(): Promise<Api.Finance.PaymentAccountItem[]> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  return db.paymentMethods.filter((a) => a.tenantId === tenantId).sort((a, b) => a.sort - b.sort)
}

/** 新增支付账户 */
export async function fetchCreatePaymentAccount(
  data: Api.Finance.PaymentAccountUpsertPayload
): Promise<Api.Finance.PaymentAccountItem> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const name = (data.name ?? '').trim()
  const code = (data.code ?? '').trim()
  if (!name) fail('请输入账户名称')
  if (!/^[a-z][a-z0-9_]*$/.test(code)) fail('支付编码只能由小写字母/数字/下划线组成，且以字母开头')
  if (db.paymentMethods.some((a) => a.tenantId === tenantId && a.code === code)) {
    fail('支付编码已存在')
  }

  const now = formatDateTime()
  const account: Api.Finance.PaymentAccountItem = {
    id: genId('PA'),
    tenantId,
    name,
    code,
    sort: Number(data.sort) || db.paymentMethods.filter((a) => a.tenantId === tenantId).length + 1,
    status: data.status ?? '1',
    balance: 0,
    remark: data.remark ?? '',
    createTime: now,
    updateTime: now
  }
  db.paymentMethods.push(account)
  persistDb()
  return account
}

/** 编辑支付账户 */
export async function fetchUpdatePaymentAccount(
  data: Api.Finance.PaymentAccountUpsertPayload
): Promise<Api.Finance.PaymentAccountItem> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const account = data.id ? findAccount(db, data.id) : undefined
  if (!account) fail('支付账户不存在')

  const name = (data.name ?? '').trim()
  const code = (data.code ?? '').trim()
  if (!name) fail('请输入账户名称')
  if (!/^[a-z][a-z0-9_]*$/.test(code)) fail('支付编码只能由小写字母/数字/下划线组成，且以字母开头')
  if (
    db.paymentMethods.some((a) => a.tenantId === tenantId && a.code === code && a.id !== account.id)
  ) {
    fail('支付编码已存在')
  }

  account.name = name
  account.code = code
  if (data.sort != null) account.sort = Number(data.sort) || account.sort
  if (data.status) account.status = data.status
  if (data.remark != null) account.remark = data.remark
  account.updateTime = formatDateTime()
  persistDb()
  return account
}

/** 删除支付账户 */
export async function fetchDeletePaymentAccount(id: string): Promise<void> {
  await delay()
  const db = getDb()
  const account = findAccount(db, id)
  if (!account) fail('支付账户不存在')
  if (account.balance > 0) fail('账户仍有余额，请先清零后再删除')
  db.paymentMethods = db.paymentMethods.filter((a) => a.id !== id)
  persistDb()
}
