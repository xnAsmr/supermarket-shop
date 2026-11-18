/**
 * Mock Service 统一结果处理
 */
import { HttpError } from '@/utils/http/error'
import { ElMessage } from 'element-plus'

/**
 * 抛出业务错误：先弹出错误提示，再抛出 HttpError（与 http 层行为保持一致）
 * 注意：必须使用 function 声明，才能让 TS 正确进行“不返回”类型收窄
 */
export function fail(message: string, code = 400): never {
  ElMessage.error(message)
  throw new HttpError(message, code)
}

/** 成功提示（可选） */
export function succeed<T>(data: T, message?: string): T {
  if (message) ElMessage.success(message)
  return data
}
