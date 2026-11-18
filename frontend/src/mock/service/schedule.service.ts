/**
 * 排班模块 Mock 服务（前端先行版）
 *
 * 数据保存在项目既有的本地 Mock 数据库（localStorage: mksmart-db-v1），
 * 增删后刷新页面仍保留，可用「重置演示数据」恢复。
 *
 * TODO(BACKEND): 全部函数对应 /api/v1/schedule/* 接口，后端就绪后由 api/schedule.ts 切换。
 * TODO(DB): shifts/schedules/scheduleItems/changeRequests 对应
 *           sch_shift / sch_schedule / sch_schedule_item / sch_shift_change
 */
import { getDb, persistDb } from './core/db'
import { dateOfWeek, delay, formatDate, formatDateTime, genId, weekStartStr } from './core/helpers'
import { fail } from './core/result'
import {
  SCHEDULE_CURRENT_USER,
  SCHEDULE_EMPLOYEES,
  SCHEDULE_STORES,
  buildDemoWeekItems
} from './core/seed'

/** 一店一周一张班表 */
const weekId = (storeId: string, weekStart: string) => `${storeId}_${weekStart}`

/** 日期所在周的周一 */
const weekStartOfDate = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  return formatDate(dt)
}

/** 冲突集合：同一员工同一营业日出现在多个班次 */
const conflictKeys = (items: Api.Schedule.ScheduleItem[]): Set<string> => {
  const seen = new Set<string>()
  const duplicated = new Set<string>()
  items.forEach((item) => {
    const key = `${item.date}_${item.userId}`
    if (seen.has(key)) duplicated.add(key)
    else seen.add(key)
  })
  return duplicated
}

/** 确保某周班表存在（首次访问自动生成演示数据，便于任意周切换都有内容） */
function ensureWeek(storeId: string, weekStart: string): Api.Schedule.WeekSchedule {
  const db = getDb()
  const id = weekId(storeId, weekStart)
  let schedule = db.schedules.find((s) => s.id === id)
  if (!schedule) {
    const { items } = buildDemoWeekItems(storeId, weekStart, db.shifts.filter((s) => s.enabled))
    db.scheduleItems.push(...items)
    schedule = {
      id,
      storeId,
      weekStart,
      // 过去周只读归档；本周及未来周为可编辑草稿
      status: weekStart < weekStartStr(0) ? 'archived' : 'draft',
      items: []
    }
    db.schedules.push(schedule)
    persistDb()
  }
  return schedule
}

/* ------------------------------ 基础数据 ------------------------------ */

/** 排班可选门店 */
export async function fetchStores(): Promise<Api.Schedule.StoreOption[]> {
  await delay(80)
  return [...SCHEDULE_STORES]
}

/** 某门店在职员工（真实实现应查 sys_user：tenant_id + store_id + status=1） */
export async function fetchEmployees(storeId: string): Promise<Api.Schedule.EmployeeOption[]> {
  await delay(80)
  return SCHEDULE_EMPLOYEES.filter((e) => e.storeId === storeId)
}

/** 班次列表（租户通用 + 指定门店） */
export async function fetchShifts(storeId?: string): Promise<Api.Schedule.ShiftItem[]> {
  await delay(80)
  return getDb()
    .shifts.filter((s) => !s.storeId || !storeId || s.storeId === storeId)
    .sort((a, b) => a.sort - b.sort)
}

/** 新增 / 编辑班次 */
export async function upsertShift(
  payload: Api.Schedule.ShiftUpsertPayload
): Promise<Api.Schedule.ShiftItem> {
  await delay(160)
  const db = getDb()
  const start = payload.start ?? '08:00'
  const end = payload.end ?? '16:00'
  const crossDay = end <= start

  if (payload.id) {
    const target = db.shifts.find((s) => s.id === payload.id)
    if (!target) fail('班次不存在')
    Object.assign(target, payload, { crossDay })
    persistDb()
    return { ...target }
  }

  const created: Api.Schedule.ShiftItem = {
    id: genId('SH'),
    storeId: payload.storeId,
    name: payload.name?.trim() || '新班次',
    code: payload.code || genId('SHIFT').toUpperCase(),
    start,
    end,
    crossDay,
    color: payload.color || '#FFB200',
    minStaff: Number(payload.minStaff) || 1,
    role: payload.role || '店员',
    rest: Number(payload.rest) || 0,
    sort: db.shifts.length + 1,
    enabled: payload.enabled ?? true,
    remark: payload.remark
  }
  db.shifts.push(created)
  persistDb()
  return { ...created }
}

/** 启用 / 停用班次（停用不影响历史班表） */
export async function toggleShift(id: string): Promise<void> {
  await delay(100)
  const db = getDb()
  const target = db.shifts.find((s) => s.id === id)
  if (!target) fail('班次不存在')
  target.enabled = !target.enabled
  persistDb()
}

/* ------------------------------ 周班表 ------------------------------ */

/** 查询周班表（明细始终以 scheduleItems 为准重新组装，避免冗余不一致） */
export async function fetchWeek(
  storeId: string,
  weekStart: string
): Promise<Api.Schedule.WeekSchedule> {
  await delay(180)
  const db = getDb()
  const schedule = ensureWeek(storeId, weekStart)
  return {
    ...schedule,
    items: db.scheduleItems.filter((i) => i.scheduleId === schedule.id)
  }
}

/** 整周批量保存（事务语义：先清该周明细，再整体写入） */
export async function saveWeek(payload: Api.Schedule.WeekSavePayload): Promise<void> {
  await delay(260)
  const db = getDb()
  const schedule = ensureWeek(payload.storeId, payload.weekStart)
  if (schedule.status !== 'draft') fail('已发布或已归档的班表不可直接修改，请先撤回发布或走调班审批')

  const id = schedule.id
  db.scheduleItems = db.scheduleItems.filter((i) => i.scheduleId !== id)
  payload.items.forEach((item) => {
    db.scheduleItems.push({
      ...item,
      id: `IT_${id}_${item.date}_${item.shiftId}_${item.userId}_${genId('X')}`,
      scheduleId: id
    })
  })
  persistDb()
}

/** 复制上周班表（日期整体 +7 天，来源标记 copy） */
export async function copyPrevWeek(
  storeId: string,
  weekStart: string
): Promise<Api.Schedule.WeekSchedule> {
  await delay(220)
  const db = getDb()
  const schedule = ensureWeek(storeId, weekStart)
  if (schedule.status !== 'draft') fail('已发布或已归档的班表不可覆盖')

  const [y, m, d] = weekStart.split('-').map(Number)
  const prev = new Date(y, (m || 1) - 1, d || 1)
  prev.setDate(prev.getDate() - 7)
  const prevStart = formatDate(prev)
  const prevSchedule = ensureWeek(storeId, prevStart)
  const source = db.scheduleItems.filter((i) => i.scheduleId === prevSchedule.id)

  if (!source.length) fail('上周暂无排班数据可复制')

  const id = schedule.id
  db.scheduleItems = db.scheduleItems.filter((i) => i.scheduleId !== id)
  source.forEach((item, index) => {
    const dayIndex = Math.round(
      (new Date(item.date).getTime() - new Date(prevStart).getTime()) / 86400000
    )
    const date = dateOfWeek(weekStart, Math.max(0, Math.min(6, dayIndex)))
    db.scheduleItems.push({
      ...item,
      id: `IT_${id}_${date}_${item.shiftId}_${item.userId}_${index}`,
      scheduleId: id,
      date,
      source: 'copy'
    })
  })
  persistDb()
  return {
    ...schedule,
    items: db.scheduleItems.filter((i) => i.scheduleId === id)
  }
}

/** 发布班表：校验同一员工同一营业日不可多班次重叠 */
export async function publishWeek(id: string): Promise<void> {
  await delay(240)
  const db = getDb()
  const schedule = db.schedules.find((s) => s.id === id)
  if (!schedule) fail('班表不存在')
  const items = db.scheduleItems.filter((i) => i.scheduleId === id)
  const duplicated = conflictKeys(items)
  if (duplicated.size) fail(`存在 ${duplicated.size} 处排班冲突，请先调整后再发布`)

  schedule.status = 'published'
  schedule.publishTime = formatDateTime()
  persistDb()
  // TODO(BACKEND): 发布时通过 INotifyEventService 给当周当班员工推送「事件提醒」
}

/** 撤回发布，恢复草稿可编辑 */
export async function revokeWeek(id: string): Promise<void> {
  await delay(160)
  const db = getDb()
  const schedule = db.schedules.find((s) => s.id === id)
  if (!schedule) fail('班表不存在')
  schedule.status = 'draft'
  schedule.publishTime = undefined
  persistDb()
}

/* ------------------------------ 调班审批 ------------------------------ */

/** 调班申请列表（待办优先） */
export async function fetchChanges(): Promise<Api.Schedule.ChangeItem[]> {
  await delay(140)
  return [...getDb().changeRequests].sort((a, b) => {
    if (a.status !== b.status) return a.status - b.status
    return String(b.createTime).localeCompare(String(a.createTime))
  })
}

/** 发起调班（申请人固定为当前登录员工） */
export async function createChange(
  payload: Api.Schedule.ChangeCreatePayload
): Promise<Api.Schedule.ChangeItem> {
  await delay(220)
  const db = getDb()
  const applicant = SCHEDULE_EMPLOYEES.find((e) => e.id === SCHEDULE_CURRENT_USER)
  const target = SCHEDULE_EMPLOYEES.find((e) => e.id === payload.targetUserId)
  if (!applicant || !target) fail('请选择有效的接班同事')
  if (payload.targetUserId === SCHEDULE_CURRENT_USER) fail('不能与自己调班')
  if (!payload.reason?.trim()) fail('请填写调班原因')

  const created: Api.Schedule.ChangeItem = {
    id: genId('CH'),
    storeId: payload.storeId,
    applicantId: applicant.id,
    applicantName: applicant.name,
    targetUserId: target.id,
    targetUserName: target.name,
    date: payload.date,
    shiftId: payload.shiftId,
    changeType: payload.changeType,
    reason: payload.reason.trim(),
    status: 0,
    createTime: formatDateTime()
  }
  db.changeRequests.unshift(created)
  persistDb()
  return created
}

/** 审批：通过后自动改写排班明细并留痕（source=change），无需店长手工再改班表 */
export async function reviewChange(
  id: string,
  status: 1 | 2
): Promise<Api.Schedule.ChangeItem> {
  await delay(240)
  const db = getDb()
  const change = db.changeRequests.find((c) => c.id === id)
  if (!change) fail('申请不存在')
  if (change.status !== 0) fail('该申请已处理')

  change.status = status
  change.reviewerName = '李店长'
  change.reviewTime = formatDateTime()

  if (status === 1) {
    const scheduleId = weekId(change.storeId, weekStartOfDate(change.date))
    const exists = db.scheduleItems.some(
      (i) =>
        i.scheduleId === scheduleId &&
        i.date === change.date &&
        i.shiftId === change.shiftId &&
        i.userId === change.targetUserId
    )
    // 移除申请人该班次，加入接班人
    db.scheduleItems = db.scheduleItems.filter(
      (i) =>
        !(
          i.scheduleId === scheduleId &&
          i.date === change.date &&
          i.shiftId === change.shiftId &&
          i.userId === change.applicantId
        )
    )
    if (!exists) {
      const target = SCHEDULE_EMPLOYEES.find((e) => e.id === change.targetUserId)
      db.scheduleItems.push({
        id: genId('IT'),
        scheduleId,
        date: change.date,
        shiftId: change.shiftId,
        userId: change.targetUserId,
        roleCode: target?.role ?? '',
        source: 'change'
      })
    }
  }
  persistDb()
  return { ...change }
}

/* ------------------------------ 我的排班 ------------------------------ */

/** 当前登录员工在指定周的排班 */
export async function fetchMySchedule(
  weekStart: string,
  userId: string = SCHEDULE_CURRENT_USER
): Promise<Api.Schedule.ScheduleItem[]> {
  await delay(140)
  const from = weekStart
  const to = dateOfWeek(weekStart, 6)
  return getDb().scheduleItems.filter(
    (i) => i.userId === userId && i.date >= from && i.date <= to
  )
}

/** 当前登录员工信息（我的排班页头部展示） */
export async function fetchCurrentEmployee(): Promise<Api.Schedule.EmployeeOption> {
  await delay(60)
  return SCHEDULE_EMPLOYEES.find((e) => e.id === SCHEDULE_CURRENT_USER) ?? SCHEDULE_EMPLOYEES[0]
}
