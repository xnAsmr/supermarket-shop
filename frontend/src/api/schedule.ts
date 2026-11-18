/**
 * 排班模块 API
 *
 * 默认直连真实后端 /api/v1/schedule/*（数据库 sch_* 四张表）。
 * 页面代码无需感知数据来源：所有出参均与 Api.Schedule 类型契约一致（id 为字符串）。
 *
 * SCHEDULE_MOCK_ONLY 保留为演示开关：置为 true 时全部走本地 Mock 服务（localStorage），
 * 便于后端不可用或离线演示。默认 false，切换到真实后端后无 404、无降级误导。
 *
 * TODO(BACKEND): 发布/调班结果推送消息通知；班前提醒与过期周归档定时任务。
 */
import { api } from './core/backend'
import * as scheduleService from '@/mock/service/schedule.service'

/** 数据源开关：false=真实后端（默认），true=本地演示数据 */
export const SCHEDULE_MOCK_ONLY = false

/** 统一调用入口：默认真实后端；开启演示开关时走本地 Mock 服务 */
const request = <T>(real: () => Promise<T>, mock: () => Promise<T>): Promise<T> =>
  SCHEDULE_MOCK_ONLY ? mock() : real()

/* ------------------------------ 基础数据 ------------------------------ */

export function fetchScheduleStores(): Promise<Api.Schedule.StoreOption[]> {
  return request<Api.Schedule.StoreOption[]>(
    () => api.get<Api.Schedule.StoreOption[]>({ url: '/api/v1/schedule/stores' }),
    () => scheduleService.fetchStores()
  )
}

export function fetchScheduleEmployees(storeId: string): Promise<Api.Schedule.EmployeeOption[]> {
  return request<Api.Schedule.EmployeeOption[]>(
    () =>
      api.get<Api.Schedule.EmployeeOption[]>({
        url: '/api/v1/schedule/employees',
        params: { storeId }
      }),
    () => scheduleService.fetchEmployees(storeId)
  )
}

export function fetchCurrentEmployee(): Promise<Api.Schedule.EmployeeOption> {
  return request<Api.Schedule.EmployeeOption>(
    () => api.get<Api.Schedule.EmployeeOption>({ url: '/api/v1/schedule/current-employee' }),
    () => scheduleService.fetchCurrentEmployee()
  )
}

export function fetchShifts(storeId?: string): Promise<Api.Schedule.ShiftItem[]> {
  return request<Api.Schedule.ShiftItem[]>(
    () => api.get<Api.Schedule.ShiftItem[]>({ url: '/api/v1/schedule/shifts', params: { storeId } }),
    () => scheduleService.fetchShifts(storeId)
  )
}

export function upsertShift(
  payload: Api.Schedule.ShiftUpsertPayload
): Promise<Api.Schedule.ShiftItem> {
  return request<Api.Schedule.ShiftItem>(
    () => api.post<Api.Schedule.ShiftItem>({ url: '/api/v1/schedule/shifts', data: payload }),
    () => scheduleService.upsertShift(payload)
  )
}

export function toggleShift(id: string): Promise<void> {
  return request<void>(
    () => api.put<void>({ url: `/api/v1/schedule/shifts/${id}/toggle` }),
    () => scheduleService.toggleShift(id)
  )
}

/** 删除班次：已被排班引用时后端会返回明确错误，建议改用「停用」 */
export function deleteShift(id: string): Promise<void> {
  return api.del<void>({ url: `/api/v1/schedule/shifts/${id}` })
}

/* ------------------------------ 周班表 ------------------------------ */

export function fetchWeek(
  storeId: string,
  weekStart: string
): Promise<Api.Schedule.WeekSchedule> {
  return request<Api.Schedule.WeekSchedule>(
    () =>
      api.get<Api.Schedule.WeekSchedule>({
        url: '/api/v1/schedule/week',
        params: { storeId, weekStart }
      }),
    () => scheduleService.fetchWeek(storeId, weekStart)
  )
}

/** 发布前校验报告：conflicts 为阻断项，shortages 为最低人数提示项 */
export function fetchValidateWeek(
  storeId: string,
  weekStart: string
): Promise<Api.Schedule.ValidationResult> {
  return api.get<Api.Schedule.ValidationResult>({
    url: '/api/v1/schedule/week/validate',
    params: { storeId, weekStart }
  })
}

export function saveWeek(payload: Api.Schedule.WeekSavePayload): Promise<void> {
  return request<void>(
    () => api.put<void>({ url: '/api/v1/schedule/week', data: payload }),
    () => scheduleService.saveWeek(payload)
  )
}

export function copyPrevWeek(
  storeId: string,
  weekStart: string
): Promise<Api.Schedule.WeekSchedule> {
  return request<Api.Schedule.WeekSchedule>(
    () =>
      api.post<Api.Schedule.WeekSchedule>({
        url: '/api/v1/schedule/week/copy-prev',
        data: { storeId, weekStart }
      }),
    () => scheduleService.copyPrevWeek(storeId, weekStart)
  )
}

export function publishWeek(id: string): Promise<void> {
  return request<void>(
    () => api.post<void>({ url: '/api/v1/schedule/week/publish', data: { id } }),
    () => scheduleService.publishWeek(id)
  )
}

export function revokeWeek(id: string): Promise<void> {
  return request<void>(
    () => api.post<void>({ url: '/api/v1/schedule/week/revoke', data: { id } }),
    () => scheduleService.revokeWeek(id)
  )
}

/** 明细粒度 CRUD：单条新增 / 删除（后端同样执行冲突校验） */
export function addScheduleItem(
  payload: Api.Schedule.ScheduleItemCreatePayload
): Promise<Api.Schedule.ScheduleItem> {
  return api.post<Api.Schedule.ScheduleItem>({ url: '/api/v1/schedule/items', data: payload })
}

export function deleteScheduleItem(id: string): Promise<void> {
  return api.del<void>({ url: `/api/v1/schedule/items/${id}` })
}

/* ------------------------------ 调班审批 ------------------------------ */

export function fetchChanges(): Promise<Api.Schedule.ChangeItem[]> {
  return request<Api.Schedule.ChangeItem[]>(
    () => api.get<Api.Schedule.ChangeItem[]>({ url: '/api/v1/schedule/changes' }),
    () => scheduleService.fetchChanges()
  )
}

export function createChange(
  payload: Api.Schedule.ChangeCreatePayload
): Promise<Api.Schedule.ChangeItem> {
  return request<Api.Schedule.ChangeItem>(
    () => api.post<Api.Schedule.ChangeItem>({ url: '/api/v1/schedule/changes', data: payload }),
    () => scheduleService.createChange(payload)
  )
}

export function reviewChange(id: string, status: 1 | 2): Promise<Api.Schedule.ChangeItem> {
  return request<Api.Schedule.ChangeItem>(
    () =>
      api.put<Api.Schedule.ChangeItem>({
        url: `/api/v1/schedule/changes/${id}/review`,
        data: { status }
      }),
    () => scheduleService.reviewChange(id, status)
  )
}

/** 撤销待审批的调班申请 */
export function cancelChange(id: string): Promise<void> {
  return api.del<void>({ url: `/api/v1/schedule/changes/${id}` })
}

/* ------------------------------ 我的排班 ------------------------------ */

export function fetchMySchedule(weekStart: string): Promise<Api.Schedule.ScheduleItem[]> {
  return request<Api.Schedule.ScheduleItem[]>(
    () =>
      api.get<Api.Schedule.ScheduleItem[]>({
        url: '/api/v1/schedule/mine',
        params: { weekStart }
      }),
    () => scheduleService.fetchMySchedule(weekStart)
  )
}
