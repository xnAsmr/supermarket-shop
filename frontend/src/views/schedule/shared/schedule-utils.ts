/**
 * 排班页面通用计算（纯前端即时反馈 + 员工字典）
 *
 * 权威校验在后端：一人一天一班、归一化时间段不重叠、最低在岗人数、租户/门店隔离。
 * 这里的冲突与缺员计算只用于输入时的即时高亮，规则与后端保持一致。
 * 员工姓名/岗位不再依赖本地演示数据，由各页面加载员工列表后通过 setEmployeeDirectory 注册。
 */

const AVATAR_COLORS = [
  '#3D7FFF', '#2ED3B7', '#FFB200', '#FF7D5C',
  '#7C5CFF', '#36CFC9', '#F0709A', '#5B8FF9'
]

const pad = (n: number): string => String(n).padStart(2, '0')

export const formatDate = (input: Date | number | string = new Date()): string => {
  const d = input instanceof Date ? input : new Date(input)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 周一为锚的周起始日期（offset 为周偏移，0=本周） */
export const weekStartStr = (weekOffset = 0): string => {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekOffset * 7)
  return formatDate(d)
}

/** 周内第 index 天（0=周一）的日期 */
export const dateOfWeek = (weekStart: string, index: number): string => {
  const [y, m, day] = weekStart.split('-').map(Number)
  const d = new Date(y, (m || 1) - 1, day || 1)
  d.setDate(d.getDate() + index)
  return formatDate(d)
}

/** 字符串稳定散列（头像配色按 id 固定） */
export const hashNum = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/* ------------------------------ 员工字典 ------------------------------ */

let directory = new Map<string, Api.Schedule.EmployeeOption>()

/** 由页面在加载员工列表后注册，供 empName / empRole 查询 */
export const setEmployeeDirectory = (list: Api.Schedule.EmployeeOption[]): void => {
  directory = new Map(list.map((e) => [e.id, e]))
}

/** 员工姓名 */
export const empName = (id: string): string => directory.get(id)?.name ?? id

/** 员工岗位 */
export const empRole = (id: string): string => directory.get(id)?.role ?? ''

/** 头像配色（按 id 稳定） */
export const avatarColor = (id: string): string => AVATAR_COLORS[hashNum(id) % AVATAR_COLORS.length]

/** 班次时长（分钟，跨夜 +24h），扣除休息后用于工时统计 */
export const shiftMinutes = (shift: Api.Schedule.ShiftItem): number => {
  const [sh, sm] = shift.start.split(':').map(Number)
  const [eh, em] = shift.end.split(':').map(Number)
  let minutes = eh * 60 + em - (sh * 60 + sm)
  if (shift.crossDay) minutes += 24 * 60
  return Math.max(0, minutes - (shift.rest || 0))
}

/** 把「营业日 + HH:mm + 跨夜」转成绝对分钟数，用于时间段重叠判断 */
const absoluteMinutes = (date: string, hhmm: string, plusDay = false): number => {
  const [h, m] = hhmm.split(':').map(Number)
  const [y, mo, d] = date.split('-').map(Number)
  return new Date(y, (mo || 1) - 1, d || 1, h || 0, m || 0).getTime() / 60000 +
    (plusDay ? 1440 : 0)
}

/* ------------------------------ 一周展示 ------------------------------ */

/** 一周 7 天的展示信息 */
export interface DayInfo {
  date: string
  label: string
  md: string
  isToday: boolean
  weekend: boolean
}

export const buildDays = (weekStart: string): DayInfo[] => {
  const today = formatDate(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const date = dateOfWeek(weekStart, i)
    const [, m, d] = date.split('-')
    return {
      date,
      label: `周${'一二三四五六日'[i]}`,
      md: `${m}/${d}`,
      isToday: date === today,
      weekend: i >= 5
    }
  })
}

/** 某格（某天某班次）的排班明细 */
export const cellItems = (
  items: Api.Schedule.ScheduleItem[],
  date: string,
  shiftId: string
): Api.Schedule.ScheduleItem[] => items.filter((i) => i.date === date && i.shiftId === shiftId)

interface RangedItem {
  item: Api.Schedule.ScheduleItem
  start: number
  end: number
}

/**
 * 冲突集合，返回 `${date}_${userId}` 集合用于单元格标红。
 *
 * 与后端一致的两条规则：
 *   A. 一人一天一班：同一员工同一营业日出现在多个班次；
 *   B. 时间段不重叠：跨夜班与次日班次的归一化区间重叠（需要传入 shifts 才启用）。
 */
export const conflictUserKeys = (
  items: Api.Schedule.ScheduleItem[],
  shifts: Api.Schedule.ShiftItem[] = []
): Set<string> => {
  const duplicated = new Set<string>()

  const seen = new Map<string, Api.Schedule.ScheduleItem>()
  items.forEach((item) => {
    const key = `${item.date}_${item.userId}`
    if (seen.has(key)) duplicated.add(key)
    else seen.set(key, item)
  })

  if (!shifts.length) return duplicated

  const byUser = new Map<string, RangedItem[]>()
  items.forEach((item) => {
    const shift = shifts.find((s) => s.id === item.shiftId)
    if (!shift) return
    const crossDay = shift.crossDay || shift.end <= shift.start
    const start = absoluteMinutes(item.date, shift.start)
    const end = Math.max(absoluteMinutes(item.date, shift.end, crossDay), start + 1)
    const group = byUser.get(item.userId) ?? []
    group.push({ item, start, end })
    byUser.set(item.userId, group)
  })

  byUser.forEach((group) => {
    group.sort((a, b) => a.start - b.start)
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1]
      const cur = group[i]
      // 同日组合已由规则 A 覆盖；这里只处理跨日（跨夜班延续到次日）的重叠
      if (prev.end > cur.start && prev.item.date !== cur.item.date) {
        duplicated.add(`${prev.item.date}_${prev.item.userId}`)
        duplicated.add(`${cur.item.date}_${cur.item.userId}`)
      }
    }
  })

  return duplicated
}

/** 可读的冲突描述列表 */
export const conflictMessages = (
  items: Api.Schedule.ScheduleItem[],
  shifts: Api.Schedule.ShiftItem[] = []
): string[] =>
  [...conflictUserKeys(items, shifts)].map((key) => {
    const date = key.slice(0, 10)
    const userId = key.slice(11)
    return `${empName(userId)} ${date.slice(5)} 存在班次冲突`
  })

/**
 * 某格缺口人数：与后端一致，完全未排人的格子视为「当日未开放该班次」，不计缺员。
 */
export const shortageOf = (
  items: Api.Schedule.ScheduleItem[],
  date: string,
  shift: Api.Schedule.ShiftItem
): number => {
  const assigned = cellItems(items, date, shift.id).length
  if (!assigned) return 0
  return Math.max(0, (shift.minStaff || 0) - assigned)
}

/** 底部统计 */
export const statsOf = (
  items: Api.Schedule.ScheduleItem[],
  shifts: Api.Schedule.ShiftItem[],
  days: DayInfo[]
) => {
  const hours = items.reduce((sum, item) => {
    const shift = shifts.find((s) => s.id === item.shiftId)
    return sum + (shift ? shiftMinutes(shift) / 60 : 0)
  }, 0)
  const shortageCount = days.reduce(
    (n, day) => n + shifts.filter((s) => shortageOf(items, day.date, s) > 0).length,
    0
  )
  return {
    slots: days.length * shifts.length,
    people: items.length,
    hours: Math.round(hours),
    shortageCount
  }
}

/** 状态文案 */
export const statusTextOf = (status: Api.Schedule.WeekStatus): string =>
  status === 'draft' ? '草稿 · 员工不可见' : status === 'published' ? '已发布' : '已归档'

/** 调班类型文案 */
export const changeTypeText = (type: Api.Schedule.ChangeType): string =>
  type === 1 ? '换班' : type === 2 ? '替班' : '请假'
