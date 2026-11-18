import { api, callWithFallback, toBackendPage, toPaginated } from './core/backend'
import type { BackendPageResult } from '@/types/common/response'
import * as logService from '@/mock/service/log.service'

/** 后端操作日志行（OperationLogController 返回 Map） */
interface BackendOperationLogVO {
  id?: number | string
  tenantId?: number | string
  tenantName?: string
  module?: string
  operation?: string
  method?: string
  url?: string
  status?: number
  errorMsg?: string
  params?: string
  result?: string
  ip?: string
  userId?: number | string
  username?: string
  duration?: number
  createTime?: string
}

/** 后端登录日志行（LoginLogController 返回 Map） */
interface BackendLoginLogVO {
  id?: number | string
  tenantId?: number | string
  tenantName?: string
  userId?: number | string
  username?: string
  loginType?: number
  loginIp?: string
  browser?: string
  os?: string
  status?: number
  msg?: string
  loginTime?: string
}

/** 后端时间（ISO T 格式）→ 展示格式 */
const normalizeTime = (time?: string): string => (time ? time.replace('T', ' ').slice(0, 19) : '')

/** 后端操作日志 → 前端 */
const toOperationLog = (vo: BackendOperationLogVO): Api.Log.OperationLogItem => ({
  id: String(vo.id ?? ''),
  tenantId: vo.tenantId != null ? String(vo.tenantId) : undefined,
  tenantName: vo.tenantName ?? undefined,
  module: vo.module ?? '',
  operation: vo.operation ?? '',
  method: vo.method ?? '',
  url: vo.url ?? '',
  status: Number(vo.status ?? 1),
  errorMsg: vo.errorMsg ?? undefined,
  params: vo.params ?? undefined,
  result: vo.result ?? undefined,
  ip: vo.ip ?? '',
  userId: vo.userId != null ? String(vo.userId) : undefined,
  username: vo.username ?? '',
  duration: Number(vo.duration ?? 0),
  createTime: normalizeTime(vo.createTime)
})

/** 后端登录日志 → 前端 */
const toLoginLog = (vo: BackendLoginLogVO): Api.Log.LoginLogItem => ({
  id: String(vo.id ?? ''),
  tenantId: vo.tenantId != null ? String(vo.tenantId) : undefined,
  tenantName: vo.tenantName ?? undefined,
  userId: vo.userId != null ? String(vo.userId) : undefined,
  username: vo.username ?? '',
  loginType: Number(vo.loginType ?? 1),
  loginIp: vo.loginIp ?? '',
  browser: vo.browser ?? '',
  os: vo.os ?? '',
  status: Number(vo.status ?? 1),
  msg: vo.msg ?? '',
  loginTime: normalizeTime(vo.loginTime)
})

// 操作日志分页列表（GET /api/v1/operation-logs）
export function fetchGetOperationLogList(
  params: Api.Log.OperationSearchParams
): Promise<Api.Log.OperationLogList> {
  return callWithFallback(
    () =>
      api
        .get<BackendPageResult<BackendOperationLogVO>>({
          url: '/api/v1/operation-logs',
          params: {
            ...toBackendPage(params),
            module: params.module?.trim() || undefined,
            username: params.username?.trim() || undefined,
            status: params.status ?? undefined,
            startDate: params.startDate || undefined,
            endDate: params.endDate || undefined
          }
        })
        .then((res) => toPaginated(res, toOperationLog)),
    () => logService.fetchOperationLogList(params)
  )
}

// 清理操作日志（DELETE /api/v1/operation-logs）：beforeDate 为空即清空全部，仅平台超管可用
export function clearOperationLogs(params: Api.Log.ClearLogParams = {}): Promise<number> {
  return callWithFallback(
    () =>
      api.del<number>({
        url: '/api/v1/operation-logs',
        params: { beforeDate: params.beforeDate || undefined }
      }),
    () => logService.clearOperationLogList(params)
  )
}

// 清理登录日志（DELETE /api/v1/login-logs）：beforeDate 为空即清空全部，仅平台超管可用
export function clearLoginLogs(params: Api.Log.ClearLogParams = {}): Promise<number> {
  return callWithFallback(
    () =>
      api.del<number>({
        url: '/api/v1/login-logs',
        params: { beforeDate: params.beforeDate || undefined }
      }),
    () => logService.clearLoginLogList(params)
  )
}

// 登录日志分页列表（GET /api/v1/login-logs）
export function fetchGetLoginLogList(
  params: Api.Log.LoginSearchParams
): Promise<Api.Log.LoginLogList> {
  return callWithFallback(
    () =>
      api
        .get<BackendPageResult<BackendLoginLogVO>>({
          url: '/api/v1/login-logs',
          params: {
            ...toBackendPage(params),
            username: params.username?.trim() || undefined,
            status: params.status ?? undefined,
            loginType: params.loginType ?? undefined,
            startDate: params.startDate || undefined,
            endDate: params.endDate || undefined
          }
        })
        .then((res) => toPaginated(res, toLoginLog)),
    () => logService.fetchLoginLogList(params)
  )
}
