import * as memberService from '@/mock/service/member.service'
import { api, callWithFallback, toBackendPage, toPaginated } from './core/backend'
import { isHttpError } from '@/utils/http/error'

/** 会员等级（与 ums_member_level 种子一致，discount 为整单折扣系数），POS 收银台预览会员优惠用 */
export { MEMBER_LEVELS } from '@/mock/service/core/seed'

/** 后端会员（MemberVO） */
interface BackendMemberVO {
  id: number
  memberNo: string
  name: string
  phone: string
  /** 0 未知 / 1 男 / 2 女 */
  gender?: number
  /** 后端格式 yyyy-MM-dd HH:mm:ss */
  birthday?: string
  levelId?: number
  levelName?: string
  points?: number
  balance?: number
  totalConsume?: number
  totalPoints?: number
  email?: string
  address?: string
  /** 1 正常 / 0 停用 */
  status?: number
  registerTime?: string
  createTime?: string
}

/** 后端充值记录（MemberRechargeLog） */
interface BackendRechargeLog {
  id: number
  memberId: number
  memberName?: string
  type?: number
  amount?: number
  giftAmount?: number
  beforeBalance?: number
  afterBalance?: number
  payMethod?: string
  operatorName?: string
  remark?: string
  createTime?: string
}

/** 后端消费记录（MemberConsumeLogVO） */
interface BackendConsumeLog {
  id: number
  orderNo: string
  amount?: number
  payAmount?: number
  payMethod?: string
  payMethodName?: string
  orderStatus?: number
  orderStatusName?: string
  orderTime?: string
  storeName?: string
}

/** 后端分页返回（兼容 PageResult{list,...} 与 MyBatis Page{records,...} 两种结构） */
interface BackendMemberPage<T> {
  list?: T[]
  total?: number
  page?: number
  pageSize?: number
  records?: T[]
  current?: number
  size?: number
}

/** 后端 LocalDateTime（ISO/格式化）→ YYYY-MM-DD HH:mm:ss */
const fmtTime = (time?: string): string => (time ? time.replace('T', ' ').slice(0, 19) : '')

/** 金额保留两位小数 */
const money = (n: number): number => Math.round((Number(n) || 0) * 100) / 100

/** 前端状态（1正常/2停用）→ 后端状态（1正常/0停用） */
const toBackendStatus = (status?: Api.Common.EnableStatus): number | undefined =>
  status === '1' ? 1 : status === '2' ? 0 : undefined

/** 后端 MemberVO → 前端 MemberItem */
const toMember = (vo: BackendMemberVO): Api.Member.MemberItem => ({
  id: String(vo.id),
  tenantId: '',
  memberNo: vo.memberNo ?? '',
  name: vo.name ?? '',
  phone: vo.phone ?? '',
  gender: (vo.gender ?? 0) as Api.Member.MemberGender,
  birthday: vo.birthday ? vo.birthday.slice(0, 10) : undefined,
  levelId: vo.levelId != null ? String(vo.levelId) : undefined,
  levelName: vo.levelName || undefined,
  points: Number(vo.points ?? 0),
  balance: money(vo.balance ?? 0),
  totalConsume: money(vo.totalConsume ?? 0),
  totalPoints: Number(vo.totalPoints ?? 0),
  email: vo.email || undefined,
  address: vo.address || undefined,
  status: vo.status === 0 ? '2' : '1',
  registerTime: fmtTime(vo.registerTime),
  createTime: fmtTime(vo.createTime)
})

/** 前端入参 → 后端 MemberCreateDTO（birthday 补全为 yyyy-MM-dd HH:mm:ss） */
const toUpsertDto = (data: Api.Member.MemberUpsertPayload) => ({
  name: (data.name ?? '').trim(),
  phone: (data.phone ?? '').trim(),
  gender: data.gender ?? 0,
  birthday:
    data.birthday && data.birthday.length === 10 ? `${data.birthday} 00:00:00` : data.birthday,
  levelId: data.levelId ? Number(data.levelId) : null,
  email: data.email ?? '',
  address: data.address ?? ''
})

/** 统一两种后端分页结构为 PageResult 形状 */
const normalizePage = <T>(page: BackendMemberPage<T> | null | undefined) => ({
  list: page?.list ?? page?.records ?? [],
  total: page?.total ?? 0,
  page: page?.page ?? page?.current ?? 1,
  pageSize: page?.pageSize ?? page?.size ?? 20
})

// 会员列表
export function fetchGetMemberList(
  params: Api.Member.MemberSearchParams
): Promise<Api.Member.MemberList> {
  return callWithFallback(
    () =>
      api
        .get<BackendMemberPage<BackendMemberVO>>({
          url: '/api/v1/members',
          params: {
            keyword: params.keyword || undefined,
            levelId: params.levelId ? Number(params.levelId) : undefined,
            status: toBackendStatus(params.status),
            ...toBackendPage(params)
          }
        })
        .then((page) => toPaginated(normalizePage(page), toMember)),
    () => memberService.fetchMemberList(params)
  )
}

// 按手机号查会员（POS 收银台关联会员，查不到返回 null）
export function fetchGetMemberByPhone(phone: string): Promise<Api.Member.MemberItem | null> {
  return callWithFallback(
    async () => {
      try {
        const vo = await api.get<BackendMemberVO>({
          url: `/api/v1/members/by-phone/${encodeURIComponent(phone)}`,
          showErrorMessage: false
        })
        return vo?.id != null ? toMember(vo) : null
      } catch (error) {
        // 后端会员不存在时返回业务码 5001，按「未找到」处理
        if (isHttpError(error) && error.code === 5001) return null
        throw error
      }
    },
    () => memberService.fetchMemberByPhone(phone)
  )
}

// 新增会员
export function fetchCreateMember(
  data: Api.Member.MemberUpsertPayload
): Promise<Api.Member.MemberItem> {
  return callWithFallback(
    () =>
      api.post<BackendMemberVO>({ url: '/api/v1/members', data: toUpsertDto(data) }).then(toMember),
    () => memberService.fetchCreateMember(data)
  )
}

// 编辑会员
export function fetchUpdateMember(
  id: string,
  data: Api.Member.MemberUpsertPayload
): Promise<Api.Member.MemberItem> {
  return callWithFallback(
    () =>
      api
        .put<BackendMemberVO>({ url: `/api/v1/members/${id}`, data: toUpsertDto(data) })
        .then(toMember),
    () => memberService.fetchUpdateMember(id, data)
  )
}

// 删除会员
export function fetchDeleteMember(id: string): Promise<void> {
  return callWithFallback(
    () => api.del<void>({ url: `/api/v1/members/${id}` }),
    () => memberService.fetchDeleteMember(id)
  )
}

// 会员充值
export function fetchRechargeMember(id: string, data: Api.Member.RechargePayload): Promise<void> {
  return callWithFallback(
    () => api.put<void>({ url: `/api/v1/members/${id}/recharge`, data }),
    () => memberService.fetchRechargeMember(id, data)
  )
}

// 充值记录
export function fetchGetMemberRechargeLog(
  id: string,
  params: Api.Member.LogSearchParams
): Promise<Api.Member.RechargeLogList> {
  return callWithFallback(
    () =>
      api
        .get<BackendMemberPage<BackendRechargeLog>>({
          url: `/api/v1/members/${id}/recharge-log`,
          params: toBackendPage(params)
        })
        .then((page) =>
          toPaginated(
            normalizePage(page),
            (log): Api.Member.RechargeLogItem => ({
              id: String(log.id),
              memberId: String(log.memberId),
              memberName: log.memberName,
              type: log.type,
              amount: money(log.amount ?? 0),
              giftAmount: money(log.giftAmount ?? 0),
              beforeBalance: money(log.beforeBalance ?? 0),
              afterBalance: money(log.afterBalance ?? 0),
              payMethod: log.payMethod || undefined,
              operatorName: log.operatorName || undefined,
              remark: log.remark || undefined,
              createTime: fmtTime(log.createTime)
            })
          )
        ),
    () => memberService.fetchMemberRechargeLog(id, params)
  )
}

// 消费记录
export function fetchGetMemberConsumeLog(
  id: string,
  params: Api.Member.LogSearchParams
): Promise<Api.Member.ConsumeLogList> {
  return callWithFallback(
    () =>
      api
        .get<BackendMemberPage<BackendConsumeLog>>({
          url: `/api/v1/members/${id}/consume-log`,
          params: toBackendPage(params)
        })
        .then((page) =>
          toPaginated(
            normalizePage(page),
            (log): Api.Member.ConsumeLogItem => ({
              id: String(log.id),
              orderNo: log.orderNo,
              amount: money(log.amount ?? 0),
              payAmount: money(log.payAmount ?? 0),
              payMethod: log.payMethod || undefined,
              payMethodName: log.payMethodName || undefined,
              orderStatus: Number(log.orderStatus ?? 0),
              orderStatusName: log.orderStatusName || undefined,
              orderTime: fmtTime(log.orderTime),
              storeName: log.storeName || undefined
            })
          )
        ),
    () => memberService.fetchMemberConsumeLog(id, params)
  )
}
