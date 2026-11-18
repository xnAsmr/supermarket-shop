/**
 * 用户引导行为上报
 *
 * P0 后端接口尚未提供，默认仅写入本地队列（便于排查与后续补传），不产生网络请求；
 * 后端 `/api/v1/system/guide/report` 就绪后，将 `VITE_GUIDE_REPORT_ENABLED` 置为 true 即可启用。
 *
 * @module api/guide
 */
import { api } from './core/backend'

/** 上报事件类型 */
export type GuideReportEventType = 'start' | 'step_view' | 'finish' | 'skip'

/** 上报内容 */
export interface GuideReportPayload {
  event: GuideReportEventType
  /** 引导脚本标识 */
  scriptId: string
  /** 引导脚本版本 */
  scriptVersion: string
  /** 步骤标识（step_view 时必填） */
  stepKey?: string
  /** 过滤后的步骤总数 */
  total?: number
  /** 操作人 */
  userId?: string
}

/** 本地队列中的记录 */
export interface GuideReportRecord extends GuideReportPayload {
  /** 事件时间戳 */
  at: number
}

/** 本地队列存储键 */
const QUEUE_KEY = 'sys-guide-report-queue'

/** 队列上限，超出丢弃最早记录 */
const MAX_QUEUE_SIZE = 100

/** 上报开关（后端接口就绪前保持关闭） */
const REPORT_ENABLED = import.meta.env.VITE_GUIDE_REPORT_ENABLED === 'true'

/**
 * 读取本地上报队列
 */
function readQueue(): GuideReportRecord[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as GuideReportRecord[]) : []
  } catch {
    return []
  }
}

/**
 * 写入本地上报队列
 * @param queue 队列数据
 */
function writeQueue(queue: GuideReportRecord[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_SIZE)))
  } catch {
    // 存储不可用时静默放弃，引导本身不依赖上报
  }
}

/**
 * 记录一次引导行为
 * @param payload 上报内容
 */
export function reportGuideEvent(payload: GuideReportPayload): void {
  const record: GuideReportRecord = { ...payload, at: Date.now() }
  writeQueue([...readQueue(), record])

  if (REPORT_ENABLED) {
    void flushGuideReports()
  }
}

/**
 * 批量上报队列中的行为（后端接口就绪后由开关启用）
 * 失败时保留队列，等待下次上报
 */
export async function flushGuideReports(): Promise<void> {
  if (!REPORT_ENABLED) return
  const queue = readQueue()
  if (!queue.length) return

  try {
    await api.post({
      url: '/api/v1/system/guide/report',
      data: { events: queue },
      showErrorMessage: false
    })
    writeQueue([])
  } catch {
    // 保留队列，下次再传
  }
}

/**
 * 读取本地留痕（排查与验收用）
 */
export function readGuideReports(): GuideReportRecord[] {
  return readQueue()
}
