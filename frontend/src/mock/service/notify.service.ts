/**
 * 消息通知服务（本地 Mock）
 *
 * 覆盖三块能力，与后端 /api/v1/notify、/api/v1/platform/announcements、/api/v1/tenant/notices 对齐：
 * 1. 消息中心（用户侧）：系统公告 / 我的通知 / 事件提醒 + 已读/确认
 * 2. 平台公告管理（超管）：发布/撤回/定向租户/强制确认/已读统计
 * 3. 租户通知管理（管理员）：按门店/角色/指定人发送 + 已读统计
 */
import { getDb, type SystemUser } from './core/db'
import { delay, formatDateTime } from './core/helpers'
import { useTenantStore } from '@/store/modules/tenant'
import { useUserStore } from '@/store/modules/user'

const currentTid = (): string => useTenantStore().currentId
const currentUid = (): string => String(useUserStore().info.userId ?? '')
const nowStr = (): string => formatDateTime(new Date())

/** Mock 套餐类型：plan 在套餐列表中的序号（从 1 开始），与真实后端 plan_type 口径对应 */
const planTypeOf = (planId: string): number => {
  const index = getDb().plans.findIndex((p) => p.id === planId)
  return index >= 0 ? index + 1 : 0
}

/* ------------------------------ 内存状态 ------------------------------ */

let serial = 1000
const nextId = (prefix: string) => `${prefix}${++serial}`

interface MockAnnouncement {
  id: string
  title: string
  content: string
  noticeType: Api.Notify.AnnouncementType
  targetScope: Api.Notify.AnnouncementScope
  targetPlanType?: number
  targetTenantIds?: string
  effectiveAt: string
  expireAt: string
  requireAck: boolean
  targetUserType?: number
  status: Api.Notify.AnnouncementStatus
  publisherName: string
  createTime: string
}

interface MockNotice {
  id: string
  tenantId: string
  storeId?: string
  title: string
  content: string
  /** 通知类型：1=门店通知 2=制度规范 3=活动安排 */
  noticeType?: number
  targetScope: Api.Notify.NoticeScope
  targetStoreIds?: string
  targetRoleIds?: string
  targetUserIds?: string
  senderName: string
  sendTime: string
  /** 通知状态：0=已发送 1=已撤回 */
  status?: number
}

interface MockEvent {
  id: string
  tenantId: string
  userId: string
  eventType: string
  title: string
  content: string
  bizType: string
  bizId: string
  read: boolean
  createTime: string
}

const state = {
  announcements: [
    {
      id: 'A1001',
      title: 'v2.3 版本更新：收银台支持组合支付',
      content:
        '本次更新内容：\n1. 收银台支持现金+扫码组合支付；\n2. 收支流水新增逐笔单号与操作人；\n3. 修复若干已知问题。\n请各门店知悉。',
      noticeType: 1,
      targetScope: 'ALL',
      effectiveAt: nowStr(),
      expireAt: '',
      requireAck: false,
      status: 1,
      publisherName: '总部管理员',
      createTime: nowStr()
    },
    {
      id: 'A1002',
      title: '价格库合规整改通知（需确认）',
      content:
        '根据平台规则，所有商品售价必须与货架价签一致。请各租户管理员在本周内完成自查，并点击「我已知晓」确认。',
      noticeType: 3,
      targetScope: 'ALL',
      effectiveAt: nowStr(),
      expireAt: '',
      requireAck: true,
      status: 1,
      publisherName: '总部管理员',
      createTime: nowStr()
    }
  ] as MockAnnouncement[],
  notices: [] as MockNotice[],
  events: [] as MockEvent[],
  /** 已读/确认记录：`${type}:${id}:${userId}` */
  reads: new Set<string>(),
  acks: new Set<string>()
}

const readKey = (type: string, id: string, userId: string) => `${type}:${id}:${userId}`

/* ------------------------------ 消息中心（用户侧） ------------------------------ */

/** 平台公告是否对当前用户可见（Mock 口径：ALL / 按套餐 / 指定当前租户 / 定向用户类型） */
const announcementVisible = (a: MockAnnouncement): boolean => {
  if (a.status !== 1) return false
  // 定向用户类型：2=仅系统管理员（不勾选=全部用户）
  if (a.targetUserType != null) {
    const me = getDb().users.find((u) => String(u.id) === currentUid())
    if (!me || me.userType !== a.targetUserType) return false
  }
  if (a.targetScope === 'ALL') return true
  if (a.targetScope === 'ASSIGN') return (a.targetTenantIds ?? '').split(',').includes(currentTid())
  if (a.targetScope === 'PLAN') {
    const tenant = getDb().tenants.find((t) => t.id === currentTid())
    return !!tenant && planTypeOf(tenant.planId) === a.targetPlanType
  }
  return false
}

export async function fetchAnnouncements(): Promise<Api.Notify.AnnouncementItem[]> {
  await delay()
  const uid = currentUid()
  return state.announcements.filter(announcementVisible).map((a) => {
    const read = state.reads.has(readKey('ann', a.id, uid))
    const ack = state.acks.has(readKey('ann', a.id, uid))
    return {
      id: a.id,
      title: a.title,
      content: a.content,
      noticeType: a.noticeType,
      requireAck: a.requireAck,
      targetUserType: a.targetUserType,
      effectiveAt: a.effectiveAt,
      publisherName: a.publisherName,
      read,
      readAt: read ? a.createTime : '',
      ackAt: ack ? a.createTime : '',
      needAck: a.requireAck && !ack
    }
  })
}

/** 租户通知是否对当前用户可见（Mock 口径：门店归属 + 定向范围，与真实后端一致） */
const noticeVisible = (n: MockNotice): boolean => {
  const db = getDb()
  const uid = currentUid()
  const user = db.users.find((u) => String(u.id) === uid)
  if (!user || n.tenantId !== user.tenantId) return false
  // 已撤回通知对接收人不可见
  if (n.status === 1) return false
  // 门店归属约束：store_id 非空 = 仅该门店员工可见
  if (n.storeId && user.warehouseName !== n.storeId) return false
  if (n.targetScope === 'ALL') return true
  if (n.targetScope === 'STORE')
    return (n.targetStoreIds ?? '').split(',').includes(String(user.warehouseName ?? ''))
  if (n.targetScope === 'ROLE') {
    return (n.targetRoleIds ?? '')
      .split(',')
      .some((rid) => user.userRoles.includes(rid))
  }
  if (n.targetScope === 'USER') return (n.targetUserIds ?? '').split(',').includes(uid)
  return false
}

export async function fetchNotices(): Promise<Api.Notify.NoticeItem[]> {
  await delay()
  const uid = currentUid()
  return state.notices.filter(noticeVisible).map((n) => {
    const read = state.reads.has(readKey('notice', n.id, uid))
    return {
      id: n.id,
      title: n.title,
      content: n.content,
      noticeType: n.noticeType ?? 1,
      senderName: n.senderName,
      sendTime: n.sendTime,
      read,
      readAt: read ? n.sendTime : ''
    }
  })
}

export async function fetchEvents(): Promise<Api.Notify.EventItem[]> {
  await delay()
  const uid = currentUid()
  return state.events
    .filter((e) => e.userId === uid)
    .map((e) => ({
      id: e.id,
      eventType: e.eventType,
      title: e.title,
      content: e.content,
      bizType: e.bizType,
      bizId: e.bizId,
      read: e.read,
      createTime: e.createTime
    }))
}

export async function fetchUnreadCount(): Promise<Api.Notify.UnreadCount> {
  const [announcements, notices, events] = await Promise.all([
    fetchAnnouncements(),
    fetchNotices(),
    fetchEvents()
  ])
  return {
    announcements: announcements.filter((a) => !a.read).length,
    notices: notices.filter((n) => !n.read).length,
    events: events.filter((e) => !e.read).length
  }
}

export async function readAnnouncement(id: string): Promise<void> {
  await delay(100)
  state.reads.add(readKey('ann', id, currentUid()))
}

export async function ackAnnouncement(id: string): Promise<void> {
  await delay(100)
  const key = readKey('ann', id, currentUid())
  state.reads.add(key)
  state.acks.add(key)
}

export async function readNotice(id: string): Promise<void> {
  await delay(100)
  state.reads.add(readKey('notice', id, currentUid()))
}

export async function readEvent(id: string): Promise<void> {
  await delay(80)
  const event = state.events.find((e) => e.id === id)
  if (event) event.read = true
}

export async function readAllEvents(): Promise<void> {
  await delay(100)
  const uid = currentUid()
  state.events.filter((e) => e.userId === uid).forEach((e) => (e.read = true))
}

/* ------------------------------ 平台公告管理（超管） ------------------------------ */

export async function fetchAnnouncementPage(params: {
  current: number
  size: number
  keyword?: string
  status?: number
}): Promise<Api.Common.PaginatedResponse<Api.Notify.AnnouncementAdmin>> {
  await delay()
  let list = [...state.announcements].sort((a, b) => b.createTime.localeCompare(a.createTime))
  if (params.keyword) list = list.filter((a) => a.title.includes(params.keyword!))
  if (params.status != null) list = list.filter((a) => a.status === params.status)
  const start = (params.current - 1) * params.size
  const pageList = list.slice(start, start + params.size).map((a) => {
    const readCount = [...state.reads].filter((k) => k.startsWith(`ann:${a.id}:`)).length
    const ackCount = [...state.acks].filter((k) => k.startsWith(`ann:${a.id}:`)).length
    return { ...a, readCount, ackCount } as Api.Notify.AnnouncementAdmin
  })
  return { records: pageList, current: params.current, size: params.size, total: list.length }
}

export async function saveAnnouncement(params: Api.Notify.AnnouncementSaveParams): Promise<void> {
  await delay()
  if (params.id) {
    const target = state.announcements.find((a) => a.id === params.id)
    if (!target) throw new Error('公告不存在')
    Object.assign(target, params)
    if (params.publishNow) target.status = 1
  } else {
    state.announcements.push({
      id: nextId('A'),
      title: params.title,
      content: params.content,
      noticeType: params.noticeType,
      targetScope: params.targetScope,
      targetPlanType: params.targetPlanType,
      targetTenantIds: params.targetTenantIds,
      effectiveAt: params.effectiveAt,
      expireAt: params.expireAt ?? '',
      requireAck: params.requireAck,
      targetUserType: params.targetUserType,
      status: params.publishNow ? 1 : 0,
      publisherName: useUserStore().info.realName ?? useUserStore().info.userName ?? '平台管理员',
      createTime: nowStr()
    })
  }
}

export async function publishAnnouncement(id: string): Promise<void> {
  await delay(120)
  const target = state.announcements.find((a) => a.id === id)
  if (target) target.status = 1
}

export async function withdrawAnnouncement(id: string): Promise<void> {
  await delay(120)
  const target = state.announcements.find((a) => a.id === id)
  if (target) target.status = 2
}

export async function deleteAnnouncement(id: string): Promise<void> {
  await delay(120)
  state.announcements = state.announcements.filter((a) => a.id !== id)
}

export async function fetchAnnouncementStats(id: string): Promise<Api.Notify.AnnouncementStats> {
  await delay()
  const db = getDb()
  const target = state.announcements.find((a) => a.id === id)
  const userType = target?.targetUserType
  const tenants = db.tenants.map((t) => {
    let users = db.users.filter((u) => u.tenantId === t.id)
    if (userType != null) users = users.filter((u) => u.userType === userType)
    const readCount = users.filter((u) => state.reads.has(readKey('ann', id, String(u.id)))).length
    const ackCount = users.filter((u) => state.acks.has(readKey('ann', id, String(u.id)))).length
    return { tenantId: t.id, tenantName: t.name, userCount: users.length, readCount, ackCount }
  })
  return {
    announcementId: id,
    title: target?.title ?? '',
    requireAck: target?.requireAck ?? false,
    targetUserType: userType,
    userCount: tenants.reduce((s, t) => s + t.userCount, 0),
    readCount: tenants.reduce((s, t) => s + t.readCount, 0),
    ackCount: tenants.reduce((s, t) => s + t.ackCount, 0),
    tenants
  }
}

export async function fetchTenantOptions(): Promise<Api.Notify.NotifyOption[]> {
  await delay(100)
  return getDb().tenants.map((t) => ({ id: t.id, name: t.name, planType: planTypeOf(t.planId) }))
}

/* ------------------------------ 租户通知管理（管理员） ------------------------------ */

export async function fetchNoticePage(params: {
  current: number
  size: number
  keyword?: string
}): Promise<Api.Common.PaginatedResponse<Api.Notify.NoticeAdmin>> {
  await delay()
  const tid = currentTid()
  let list = state.notices
    .filter((n) => n.tenantId === tid)
    .sort((a, b) => b.sendTime.localeCompare(a.sendTime))
  if (params.keyword) list = list.filter((n) => n.title.includes(params.keyword!))
  const start = (params.current - 1) * params.size
  const pageList = list.slice(start, start + params.size).map((n) => {
    const audience = mockAudience(n)
    return {
      id: n.id,
      title: n.title,
      content: n.content,
      noticeType: n.noticeType ?? 1,
      targetScope: n.targetScope,
      targetStoreIds: n.targetStoreIds,
      targetRoleIds: n.targetRoleIds,
      targetUserIds: n.targetUserIds,
      storeId: n.storeId,
      senderName: n.senderName,
      sendTime: n.sendTime,
      status: n.status ?? 0,
      audienceCount: audience.length,
      readCount: audience.filter((u) => state.reads.has(readKey('notice', n.id, String(u.id)))).length,
      createTime: n.sendTime
    } as Api.Notify.NoticeAdmin
  })
  return { records: pageList, current: params.current, size: params.size, total: list.length }
}

/** Mock 定向用户匹配（与真实后端口径一致） */
const mockAudience = (n: MockNotice): SystemUser[] => {
  const db = getDb()
  let users = db.users.filter((u) => u.tenantId === n.tenantId)
  if (n.storeId) users = users.filter((u) => u.warehouseName === n.storeId)
  if (n.targetScope === 'STORE') {
    const ids = (n.targetStoreIds ?? '').split(',')
    users = users.filter((u) => ids.includes(String(u.warehouseName ?? '')))
  } else if (n.targetScope === 'ROLE') {
    const ids = (n.targetRoleIds ?? '').split(',')
    users = users.filter((u) => u.userRoles.some((r) => ids.includes(r)))
  } else if (n.targetScope === 'USER') {
    const ids = (n.targetUserIds ?? '').split(',')
    users = users.filter((u) => ids.includes(String(u.id)))
  }
  return users
}

export async function sendNotice(params: Api.Notify.NoticeSendParams): Promise<void> {
  await delay()
  const userStore = useUserStore()
  const notice: MockNotice = {
    id: nextId('N'),
    tenantId: currentTid(),
    title: params.title,
    content: params.content,
    noticeType: params.noticeType ?? 1,
    targetScope: params.targetScope,
    targetStoreIds: params.targetStoreIds,
    targetRoleIds: params.targetRoleIds,
    targetUserIds: params.targetUserIds,
    senderName: userStore.info.realName ?? userStore.info.userName ?? '管理员',
    sendTime: nowStr()
  }
  state.notices.push(notice)
  // Mock 事件闭环演示：为命中用户生成一条「新通知」事件提醒（真实后端事件仅由系统业务触发）
  mockAudience(notice).forEach((u) => {
    state.events.push({
      id: nextId('E'),
      tenantId: notice.tenantId,
      userId: String(u.id),
      eventType: 'NOTICE_SENT',
      title: '您有一条新的租户通知',
      content: params.title,
      bizType: 'TENANT_NOTICE',
      bizId: notice.id,
      read: false,
      createTime: nowStr()
    })
  })
}

/** Mock 编辑通知：标题/正文/定向范围原地更新，发送人与发送时间不变 */
export async function updateNotice(id: string, params: Api.Notify.NoticeSendParams): Promise<void> {
  await delay()
  const notice = state.notices.find((n) => n.id === id)
  if (!notice) throw new Error('通知不存在')
  notice.title = params.title
  notice.content = params.content
  notice.noticeType = params.noticeType ?? 1
  notice.targetScope = params.targetScope
  notice.targetStoreIds = params.targetStoreIds
  notice.targetRoleIds = params.targetRoleIds
  notice.targetUserIds = params.targetUserIds
}

export async function fetchNoticeStats(id: string): Promise<Api.Notify.NoticeStats> {
  await delay()
  const notice = state.notices.find((n) => n.id === id)
  const audience = notice ? mockAudience(notice) : []
  const storeMap = new Map<string, Api.Notify.NoticeStoreStat>()
  const unreadUsers: Api.Notify.NoticeUnreadUser[] = []
  let readCount = 0
  audience.forEach((u) => {
    const storeName = u.warehouseName || '未分配门店'
    if (!storeMap.has(storeName)) {
      storeMap.set(storeName, { storeId: storeName, storeName, userCount: 0, readCount: 0 })
    }
    const stat = storeMap.get(storeName)!
    stat.userCount++
    if (state.reads.has(readKey('notice', id, String(u.id)))) {
      readCount++
      stat.readCount++
    } else {
      unreadUsers.push({ userId: String(u.id), userName: u.realName || u.userName, storeName })
    }
  })
  return {
    noticeId: id,
    title: notice?.title ?? '',
    audienceCount: audience.length,
    readCount,
    unreadCount: unreadUsers.length,
    unreadUsers,
    stores: [...storeMap.values()]
  }
}

export async function deleteNotice(id: string): Promise<void> {
  await delay(120)
  state.notices = state.notices.filter((n) => n.id !== id)
}

// 撤回通知（mock：标记 status=1，用户侧过滤不再可见）
export async function withdrawNotice(id: string): Promise<void> {
  await delay(120)
  const notice = state.notices.find((n) => n.id === id)
  if (notice) notice.status = 1
}

// 重新发布通知（mock：status=0 并刷新发送时间）
export async function publishNotice(id: string): Promise<void> {
  await delay(120)
  const notice = state.notices.find((n) => n.id === id)
  if (notice) {
    notice.status = 0
    notice.sendTime = new Date().toISOString()
  }
}

export async function fetchStoreOptions(): Promise<Api.Notify.NotifyOption[]> {
  await delay(100)
  const tid = currentTid()
  // 店长（有门店归属）仅本门店
  const ownStore = useUserStore().info.warehouseName ?? ''
  return getDb()
    .stores.filter((s) => s.tenantId === tid && (!ownStore || s.storeName === ownStore))
    .map((s) => ({ id: s.storeName, name: s.storeName }))
}

export async function fetchRoleOptions(): Promise<Api.Notify.NotifyOption[]> {
  await delay(100)
  return getDb().roles.map((r) => ({ id: r.roleCode, name: r.roleName }))
}

export async function fetchUserOptions(): Promise<Api.Notify.NotifyOption[]> {
  await delay(100)
  const tid = currentTid()
  const ownStore = useUserStore().info.warehouseName ?? ''
  return getDb()
    .users.filter((u) => u.tenantId === tid && (!ownStore || u.warehouseName === ownStore))
    .map((u) => ({ id: String(u.id), name: u.realName || u.userName }))
}
