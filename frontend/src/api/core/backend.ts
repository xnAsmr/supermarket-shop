/**
 * 后端 API 对接核心工具
 *
 * - 提供真实后端请求与本地 Mock 的降级切换（VITE_USE_MOCK）
 * - 后端网络不可达时自动降级为本地 Mock，保证前端可独立演示
 * - 提供后端分页结构（PageResult）到前端分页结构的转换
 */
import api from '@/utils/http'
import { isNetworkError } from '@/utils/http/error'
import type { BackendPageResult } from '@/types/common/response'

/** 是否强制使用本地 Mock */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

/** 是否已提示过“后端不可达，已降级 Mock”（只提示一次，避免重复弹窗） */
let fallbackNoticeShown = false

/**
 * 带降级的调用：默认请求真实后端；后端网络不可达时自动降级到 Mock
 * @param real 真实后端调用
 * @param mock 本地 Mock 调用
 */
export async function callWithFallback<T>(
  real: () => Promise<T>,
  mock: () => Promise<T>
): Promise<T> {
  if (USE_MOCK) return mock()
  try {
    return await real()
  } catch (error) {
    if (isNetworkError(error)) {
      console.warn('[API] 后端服务不可达，已降级为本地 Mock 数据')
      if (!fallbackNoticeShown) {
        fallbackNoticeShown = true
        ElMessage.warning('后端服务未连接，已切换为本地演示数据')
      }
      return mock()
    }
    throw error
  }
}

/**
 * 后端分页结果（{ list, total, page, pageSize }）转换为前端分页结构
 * @param page 后端分页数据
 * @param mapper 可选的条目映射函数
 */
export function toPaginated<TBackend, TFront = TBackend>(
  page: BackendPageResult<TBackend> | null | undefined,
  mapper?: (item: TBackend) => TFront
): Api.Common.PaginatedResponse<TFront> {
  const list = page?.list ?? []
  const records: TFront[] = mapper
    ? list.map((item) => mapper(item))
    : (list as unknown as TFront[])
  const size = page?.pageSize ?? (list.length > 0 ? list.length : 20)
  return {
    records,
    current: page?.page ?? 1,
    size,
    total: page?.total ?? 0
  }
}

/** 前端搜索分页参数（current/size）转换为后端分页参数（page/pageSize） */
export function toBackendPage(params: { current?: number; size?: number } | undefined) {
  return {
    page: params?.current ?? 1,
    pageSize: params?.size ?? 20
  }
}

export { api }
