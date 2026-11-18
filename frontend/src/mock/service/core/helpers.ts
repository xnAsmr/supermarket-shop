/**
 * Mock Service 通用工具
 */

/** 模拟网络延迟 */
export const delay = (ms = 120 + Math.random() * 180): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

let seq = 0

/** 生成唯一 ID */
export const genId = (prefix = 'ID'): string =>
  `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** 通用分页 */
export const paginate = <T>(
  list: T[],
  params: { current?: number | string; size?: number | string } = {}
): Api.Common.PaginatedResponse<T> => {
  const current = Math.max(1, Number(params.current) || 1)
  const size = Math.max(1, Number(params.size) || 20)
  const total = list.length
  const start = (current - 1) * size
  return { records: list.slice(start, start + size), current, size, total }
}

/** 保留两位小数（金额） */
export const money = (n: number): number => Math.round((Number(n) || 0) * 100) / 100

/** 随机整数 [min, max] */
export const randInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min

/** 从数组中随机取一个 */
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

const pad = (n: number): string => String(n).padStart(2, '0')

/** 格式化日期 YYYY-MM-DD */
export const formatDate = (input: Date | number | string = new Date()): string => {
  const d = input instanceof Date ? input : new Date(input)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 格式化时间 YYYY-MM-DD HH:mm:ss */
export const formatDateTime = (input: Date | number | string = new Date()): string => {
  const d = input instanceof Date ? input : new Date(input)
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 今天 YYYY-MM-DD */
export const todayStr = (): string => formatDate(new Date())

/** N 天前的日期 */
export const daysAgoStr = (n: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return formatDate(d)
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

/** 字符串稳定散列（生成演示数据时保证同一周结果不跳变） */
export const hashNum = (s: string): number => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** 在指定日期上偏移天数并格式化 */
export const offsetDateStr = (base: string, offset: number): string => {
  const d = new Date(`${base} 00:00:00`)
  d.setDate(d.getDate() + offset)
  return formatDate(d)
}

/** 生成单据编号：前缀 + 日期时间 + 序号 */
export const genNo = (prefix: string, serial: number): string => {
  const d = new Date()
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  return `${prefix}${stamp}${String(serial).padStart(3, '0')}`
}

/** 是否为“今天” */
export const isToday = (dateStr: string): boolean => dateStr.startsWith(todayStr())

/** 字符串是否包含关键字（忽略大小写与空格） */
export const includesKeyword = (source: unknown, keyword?: string): boolean => {
  if (!keyword) return true
  const kw = String(keyword).trim().toLowerCase()
  if (!kw) return true
  return String(source ?? '')
    .toLowerCase()
    .includes(kw)
}

/** 按时间倒序 */
export const sortByTimeDesc = <T>(list: T[], field: keyof T): T[] =>
  [...list].sort((a, b) => String(b[field]).localeCompare(String(a[field])))
