/**
 * 会员管理服务（ums_member）
 */
import { getDb, persistDb, nextSerial, type MockDatabase } from './core/db'
import {
  delay,
  formatDateTime,
  genId,
  genNo,
  includesKeyword,
  money,
  paginate
} from './core/helpers'
import { fail } from './core/result'
import { MEMBER_LEVELS } from './core/seed'
import { useTenantStore } from '@/store/modules/tenant'

const currentTid = (): string => useTenantStore().currentId

/** 会员等级 id → 名称 */
const levelNameOf = (levelId?: string): string =>
  MEMBER_LEVELS.find((l) => l.id === levelId)?.name ?? ''

/** 支付方式编码 → 名称 */
const PAY_LABEL: Record<string, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  card: '银行卡',
  stored: '储值卡'
}

/**
 * 订单状态 → 后端 orderStatus
 * 后端 order_status：0 待支付 / 1 已支付 / 2 已完成 / 3 已取消 / 4 已退款
 * 已取消与已退款在消费记录里都视为「订单已终结」，分别保留各自文案
 */
const orderStatusOf = (status: Api.Order.OrderStatus): { code: number; name: string } => {
  if (status === 'paid') return { code: 2, name: '已完成' }
  if (status === 'partial_refund') return { code: 3, name: '已退款' }
  if (status === 'refunded') return { code: 3, name: '已退款' }
  return { code: 2, name: '已取消' }
}

/** 校验手机号格式 */
const assertPhone = (phone?: string): string => {
  const value = (phone ?? '').trim()
  if (!/^1[3-9]\d{9}$/.test(value)) fail('请输入正确的手机号')
  return value
}

/** 按 id + 租户查找会员 */
const findMember = (db: MockDatabase, id: string): Api.Member.MemberItem | undefined => {
  const tenantId = currentTid()
  return db.members.find((m) => m.id === id && m.tenantId === tenantId)
}

/** 按手机号查会员（POS 收银台关联会员，查不到返回 null） */
export async function fetchMemberByPhone(phone: string): Promise<Api.Member.MemberItem | null> {
  await delay(60)
  const value = (phone ?? '').trim()
  if (!value) return null
  const db = getDb()
  const tenantId = currentTid()
  return db.members.find((m) => m.tenantId === tenantId && m.phone === value) ?? null
}

/** 会员列表 */
export async function fetchMemberList(
  params: Api.Member.MemberSearchParams
): Promise<Api.Member.MemberList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const list = db.members
    .filter((m) => {
      if (m.tenantId !== tenantId) return false
      if (
        params.keyword &&
        !includesKeyword(m.name, params.keyword) &&
        !includesKeyword(m.phone, params.keyword) &&
        !includesKeyword(m.memberNo, params.keyword)
      ) {
        return false
      }
      if (params.status && m.status !== params.status) return false
      if (params.levelId && m.levelId !== params.levelId) return false
      return true
    })
    .sort((a, b) => String(b.registerTime).localeCompare(String(a.registerTime)))
  return paginate(list, params)
}

/** 新增会员 */
export async function fetchCreateMember(
  data: Api.Member.MemberUpsertPayload
): Promise<Api.Member.MemberItem> {
  await delay(220)
  const db = getDb()
  const tenantId = currentTid()
  const name = (data.name ?? '').trim()
  if (!name) fail('请输入会员姓名')
  const phone = assertPhone(data.phone)
  if (db.members.some((m) => m.tenantId === tenantId && m.phone === phone)) {
    fail('该手机号已注册会员')
  }

  const memberNo = genNo('M', nextSerial(db, 'MEMBER'))
  const now = formatDateTime()
  const member: Api.Member.MemberItem = {
    id: genId('M'),
    tenantId,
    memberNo,
    name,
    phone,
    gender: data.gender ?? 0,
    birthday: data.birthday || undefined,
    levelId: data.levelId || undefined,
    levelName: levelNameOf(data.levelId || undefined),
    points: 0,
    balance: 0,
    totalConsume: 0,
    totalPoints: 0,
    email: (data.email ?? '').trim() || undefined,
    address: (data.address ?? '').trim() || undefined,
    status: '1',
    registerTime: now,
    createTime: now
  }
  db.members.push(member)
  persistDb()
  return member
}

/** 编辑会员 */
export async function fetchUpdateMember(
  id: string,
  data: Api.Member.MemberUpsertPayload
): Promise<Api.Member.MemberItem> {
  await delay(220)
  const db = getDb()
  const member = findMember(db, id)
  if (!member) fail('会员不存在')
  const name = (data.name ?? '').trim()
  if (!name) fail('请输入会员姓名')
  const phone = assertPhone(data.phone)
  if (db.members.some((m) => m.tenantId === member.tenantId && m.phone === phone && m.id !== id)) {
    fail('该手机号已被其他会员使用')
  }

  member.name = name
  member.phone = phone
  member.gender = data.gender ?? 0
  member.birthday = data.birthday || undefined
  member.levelId = data.levelId || undefined
  member.levelName = levelNameOf(data.levelId || undefined)
  member.email = (data.email ?? '').trim() || undefined
  member.address = (data.address ?? '').trim() || undefined
  persistDb()
  return member
}

/** 删除会员（连同充值记录） */
export async function fetchDeleteMember(id: string): Promise<void> {
  await delay(200)
  const db = getDb()
  const member = findMember(db, id)
  if (!member) fail('会员不存在')
  db.members = db.members.filter((m) => m.id !== id)
  db.memberLogs = db.memberLogs.filter((l) => l.memberId !== id)
  persistDb()
}

/** 会员充值（余额 = 原余额 + 充值金额 + 赠送金额） */
export async function fetchRechargeMember(
  id: string,
  data: Api.Member.RechargePayload
): Promise<void> {
  await delay(240)
  const db = getDb()
  const member = findMember(db, id)
  if (!member) fail('会员不存在')
  const amount = Number(data.amount) || 0
  if (amount <= 0) fail('充值金额需大于 0')
  const giftAmount = money(Number(data.giftAmount) || 0)

  const beforeBalance = money(member.balance)
  const afterBalance = money(beforeBalance + amount + giftAmount)
  member.balance = afterBalance
  db.memberLogs.unshift({
    id: genId('RL'),
    memberId: member.id,
    memberName: member.name,
    type: 1,
    amount: money(amount),
    giftAmount,
    beforeBalance,
    afterBalance,
    payMethod: data.payMethod || undefined,
    operatorName: '当前操作员',
    remark: (data.remark ?? '').trim(),
    createTime: formatDateTime()
  })
  persistDb()
}

/** 充值记录列表 */
export async function fetchMemberRechargeLog(
  id: string,
  params: Api.Member.LogSearchParams
): Promise<Api.Member.RechargeLogList> {
  await delay()
  const db = getDb()
  if (!findMember(db, id)) return paginate([], params)
  const list = db.memberLogs
    .filter((l) => l.memberId === id)
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
  return paginate(list, params)
}

/** 消费记录列表（该会员的销售订单） */
export async function fetchMemberConsumeLog(
  id: string,
  params: Api.Member.LogSearchParams
): Promise<Api.Member.ConsumeLogList> {
  await delay()
  const db = getDb()
  const member = findMember(db, id)
  if (!member) return paginate([], params)
  const list: Api.Member.ConsumeLogItem[] = db.orders
    .filter((o) => o.tenantId === member.tenantId && o.memberName === member.name)
    .map((o) => {
      const status = orderStatusOf(o.status)
      const method = o.payments[0]?.method
      return {
        id: o.id,
        orderNo: o.orderNo,
        amount: money(o.totalAmount),
        payAmount: money(o.payAmount),
        payMethod: method,
        payMethodName: method ? (PAY_LABEL[method] ?? method) : undefined,
        orderStatus: status.code,
        orderStatusName: status.name,
        orderTime: o.createTime,
        storeName: o.warehouseName
      }
    })
    .sort((a, b) => String(b.orderTime).localeCompare(String(a.orderTime)))
  return paginate(list, params)
}

/** 会员累计消费排行 TOP（经营驾驶舱「会员客户」区域，网络不可达时的降级数据源） */
export async function fetchMemberConsumeRank(
  limit = 8
): Promise<Api.Dashboard.MemberRankItem[]> {
  await delay(150)
  const db = getDb()
  const tenantId = currentTid()
  return db.members
    .filter((m) => m.tenantId === tenantId)
    .sort((a, b) => (b.totalConsume ?? 0) - (a.totalConsume ?? 0))
    .slice(0, limit)
    .map((m) => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      levelName: m.levelName || undefined,
      totalConsume: money(m.totalConsume ?? 0)
    }))
}
