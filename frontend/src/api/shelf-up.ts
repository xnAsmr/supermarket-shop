/**
 * 上架单 API（仓库 → 货架）
 *
 * 对应后端接口：
 * - GET    /api/v1/stock/shelf-ups          分页查询
 * - GET    /api/v1/stock/shelf-ups/{id}     详情
 * - POST   /api/v1/stock/shelf-ups          新建（草稿）
 * - PUT    /api/v1/stock/shelf-ups/{id}     编辑（仅草稿）
 * - DELETE /api/v1/stock/shelf-ups/{id}     删除（仅草稿）
 * - PUT    /api/v1/stock/shelf-ups/{id}/confirm   确认上架
 * - PUT    /api/v1/stock/shelf-ups/{id}/rollback  撤销上架
 *
 * 后端状态为数字枚举（0 草稿 / 1 已上架 / 2 已撤销），本层统一转换为可读字符串；
 * 后端分页为 PageResult（list/total/page/pageSize），本层转换为前端分页结构。
 */
import * as shelfUpService from '@/mock/service/shelf-up.service'
import type { BackendPageResult } from '@/types/common/response'
import { api, callWithFallback, toBackendPage, toPaginated } from './core/backend'

/* ------------------------------ 后端数据结构 ------------------------------ */

/** 后端上架单明细（ShelfUpItemVO） */
interface BackendShelfUpItemVO {
  id?: number
  productId?: number
  productName?: string
  barcode?: string
  spec?: string
  unit?: string
  quantity?: number
  /** 当前仓库库存 */
  warehouseQuantity?: number
  /** 当前货架库存 */
  shelfQuantity?: number
  remark?: string
}

/** 后端上架单（ShelfUpVO） */
interface BackendShelfUpVO {
  id?: number
  shelfUpNo?: string
  storeId?: number
  storeName?: string
  totalQuantity?: number
  status?: number
  operatorName?: string
  shelfUpUserName?: string
  shelfUpTime?: string
  remark?: string
  createTime?: string
  items?: BackendShelfUpItemVO[]
}

/* ------------------------------ 常量与工具 ------------------------------ */

/** 上架单状态：后端数字 → 前端字符串 */
const SHELF_UP_STATUS: Record<number, Api.Warehouse.ShelfUpStatus> = {
  0: 'draft',
  1: 'confirmed',
  2: 'rolled_back'
}

/** 前端状态 → 后端数字 */
const toBackendShelfUpStatus = (status?: Api.Warehouse.ShelfUpStatus): number | undefined => {
  if (!status) return undefined
  const entry = Object.entries(SHELF_UP_STATUS).find(([, value]) => value === status)
  return entry ? Number(entry[0]) : undefined
}

/** 数量保留两位小数 */
const qty = (n?: number): number => Math.round((Number(n ?? 0) || 0) * 100) / 100

/** 后端时间（ISO）→ YYYY-MM-DD HH:mm:ss */
const fmtTime = (time?: string): string => (time ? time.replace('T', ' ').slice(0, 19) : '')

/** 前端日期 → 后端日期时间 */
const toBackendDateTime = (value: string | undefined, endOfDay: boolean): string | undefined => {
  if (!value) return undefined
  if (value.length > 10) return value
  return `${value} ${endOfDay ? '23:59:59' : '00:00:00'}`
}

/* ------------------------------ 映射函数 ------------------------------ */

/** 后端上架明细 → 前端上架明细 */
const toShelfUpItem = (item: BackendShelfUpItemVO): Api.Warehouse.ShelfUpItem => ({
  id: String(item.id ?? ''),
  productId: String(item.productId ?? ''),
  productName: item.productName ?? '',
  barcode: item.barcode ?? '',
  spec: item.spec ?? '',
  unit: item.unit ?? '',
  quantity: qty(item.quantity),
  warehouseQuantity: qty(item.warehouseQuantity),
  shelfQuantity: qty(item.shelfQuantity),
  remark: item.remark ?? ''
})

/** 后端 ShelfUpVO → 前端上架单 */
const toShelfUp = (vo: BackendShelfUpVO): Api.Warehouse.ShelfUpOrder => ({
  id: String(vo.id ?? ''),
  shelfUpNo: vo.shelfUpNo ?? '',
  storeId: String(vo.storeId ?? ''),
  storeName: vo.storeName ?? '',
  totalQuantity: qty(vo.totalQuantity),
  status: SHELF_UP_STATUS[vo.status ?? 0] ?? 'draft',
  operatorName: vo.operatorName ?? '',
  shelfUpUserName: vo.shelfUpUserName ?? '',
  shelfUpTime: fmtTime(vo.shelfUpTime),
  remark: vo.remark ?? '',
  createTime: fmtTime(vo.createTime),
  items: (vo.items ?? []).map(toShelfUpItem)
})

/** 前端上架单 → 后端提交体 */
const buildShelfUpDto = (data: Partial<Api.Warehouse.ShelfUpOrder>) => ({
  storeId: Number(data.storeId),
  remark: data.remark ?? '',
  items: (data.items ?? [])
    .filter((item) => qty(item.quantity) > 0)
    .map((item) => ({
      productId: Number(item.productId),
      quantity: qty(item.quantity),
      remark: item.remark ?? ''
    }))
})

/* ------------------------------ 上架单 ------------------------------ */

/** 上架单分页列表 */
export function fetchGetShelfUpList(
  params: Api.Warehouse.ShelfUpSearchParams
): Promise<Api.Warehouse.ShelfUpOrderList> {
  return callWithFallback(
    () =>
      api
        .get<BackendPageResult<BackendShelfUpVO>>({
          url: '/api/v1/stock/shelf-ups',
          params: {
            ...toBackendPage(params),
            shelfUpNo: params.shelfUpNo?.trim() || undefined,
            storeId: params.storeId ? Number(params.storeId) : undefined,
            status: toBackendShelfUpStatus(params.status),
            startDate: toBackendDateTime(params.startTime, false),
            endDate: toBackendDateTime(params.endTime, true)
          }
        })
        .then((page) => toPaginated(page, toShelfUp)),
    () => shelfUpService.fetchShelfUpList(params)
  )
}

/** 上架单详情 */
export function fetchGetShelfUpDetail(id: string): Promise<Api.Warehouse.ShelfUpOrder> {
  return callWithFallback(
    () => api.get<BackendShelfUpVO>({ url: `/api/v1/stock/shelf-ups/${id}` }).then(toShelfUp),
    () => shelfUpService.fetchShelfUpDetail(id)
  )
}

/** 新建上架单（草稿） */
export function fetchCreateShelfUp(
  data: Partial<Api.Warehouse.ShelfUpOrder>
): Promise<Api.Warehouse.ShelfUpOrder> {
  return callWithFallback(
    () => {
      const dto = buildShelfUpDto(data)
      return api
        .post<number>({ url: '/api/v1/stock/shelf-ups', data: dto })
        .then((id) => api.get<BackendShelfUpVO>({ url: `/api/v1/stock/shelf-ups/${id}` }))
        .then(toShelfUp)
    },
    () => shelfUpService.fetchCreateShelfUp(data)
  )
}

/** 编辑上架单（仅草稿） */
export function fetchUpdateShelfUp(
  id: string,
  data: Partial<Api.Warehouse.ShelfUpOrder>
): Promise<Api.Warehouse.ShelfUpOrder> {
  return callWithFallback(
    () => {
      const dto = buildShelfUpDto(data)
      return api
        .put<void>({ url: `/api/v1/stock/shelf-ups/${id}`, data: dto })
        .then(() => api.get<BackendShelfUpVO>({ url: `/api/v1/stock/shelf-ups/${id}` }))
        .then(toShelfUp)
    },
    () => shelfUpService.fetchUpdateShelfUp(id, data)
  )
}

/** 删除上架单（仅草稿） */
export function fetchDeleteShelfUp(id: string): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/stock/shelf-ups/${id}` }),
    () => shelfUpService.fetchDeleteShelfUp(id)
  )
}

/** 确认上架（仓库减少、货架增加） */
export function fetchConfirmShelfUp(id: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/stock/shelf-ups/${id}/confirm` }),
    () => shelfUpService.fetchConfirmShelfUp(id)
  )
}

/** 撤销上架（货架减少、仓库增加） */
export function fetchRollbackShelfUp(id: string): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/stock/shelf-ups/${id}/rollback` }),
    () => shelfUpService.fetchRollbackShelfUp(id)
  )
}
