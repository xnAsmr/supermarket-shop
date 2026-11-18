/**
 * 消息通知 API
 *
 * 三块能力（与后端模块 module/notify 一一对应）：
 * 1. 消息中心（用户侧）：/api/v1/notify/* —— 系统公告（平台层，只读+确认）/ 我的通知（租户层）/ 事件提醒
 * 2. 平台公告管理（超管）：/api/v1/platform/announcements/* —— 发布/撤回/定向租户/强制确认/已读统计
 * 3. 租户通知管理（管理员）：/api/v1/tenant/notices/* —— 按门店/角色/指定人发送 + 已读统计
 *
 * 网络不可达时由 callWithFallback 统一降级本地 Mock
 */
import * as notifyService from '@/mock/service/notify.service'
import { api, callWithFallback } from './core/backend'

/* ------------------------------ 消息中心（用户侧） ------------------------------ */

// 系统公告列表（当前用户可见，含已读/确认状态）
export function fetchAnnouncements(): Promise<Api.Notify.AnnouncementItem[]> {
  return callWithFallback(
    () => api.get({ url: '/api/v1/notify/announcements' }),
    () => notifyService.fetchAnnouncements()
  )
}

// 我的通知列表（当前用户可见，含已读状态）
export function fetchNotices(): Promise<Api.Notify.NoticeItem[]> {
  return callWithFallback(
    () => api.get({ url: '/api/v1/notify/notices' }),
    () => notifyService.fetchNotices()
  )
}

// 事件提醒列表（最近 50 条）
export function fetchEvents(): Promise<Api.Notify.EventItem[]> {
  return callWithFallback(
    () => api.get({ url: '/api/v1/notify/events' }),
    () => notifyService.fetchEvents()
  )
}

// 单条系统公告详情（详情页用；可见性口径与列表一致，越权返回 4004）
export function fetchAnnouncementDetail(id: string): Promise<Api.Notify.AnnouncementItem> {
  return callWithFallback(
    () => api.get({ url: `/api/v1/notify/announcements/${id}` }),
    async () => {
      // Mock 模式：列表里按 id 取，保证详情页可用
      const list = await notifyService.fetchAnnouncements()
      const hit = list.find((item) => String(item.id) === String(id))
      if (!hit) throw new Error('公告不存在或无权查看')
      return hit
    }
  )
}

// 单条我的通知详情（详情页用；可见性口径与列表一致）
export function fetchNoticeDetail(id: string): Promise<Api.Notify.NoticeItem> {
  return callWithFallback(
    () => api.get({ url: `/api/v1/notify/notices/${id}` }),
    async () => {
      const list = await notifyService.fetchNotices()
      const hit = list.find((item) => String(item.id) === String(id))
      if (!hit) throw new Error('通知不存在或无权查看')
      return hit
    }
  )
}

// 单条事件提醒详情（详情页用；仅本人可见）
export function fetchEventDetail(id: string): Promise<Api.Notify.EventItem> {
  return callWithFallback(
    () => api.get({ url: `/api/v1/notify/events/${id}` }),
    async () => {
      const list = await notifyService.fetchEvents()
      const hit = list.find((item) => String(item.id) === String(id))
      if (!hit) throw new Error('提醒不存在或无权查看')
      return hit
    }
  )
}

// 未读数汇总（顶栏铃铛角标）
export function fetchUnreadCount(): Promise<Api.Notify.UnreadCount> {
  return callWithFallback(
    () => api.get({ url: '/api/v1/notify/unread-count' }),
    () => notifyService.fetchUnreadCount()
  )
}

// 公告标记已读
export function readAnnouncement(id: string): Promise<void> {
  return callWithFallback(
    () => api.post({ url: `/api/v1/notify/announcements/${id}/read` }),
    () => notifyService.readAnnouncement(id)
  )
}

// 公告确认（我已知晓）
export function ackAnnouncement(id: string): Promise<void> {
  return callWithFallback(
    () => api.post({ url: `/api/v1/notify/announcements/${id}/ack` }),
    () => notifyService.ackAnnouncement(id)
  )
}

// 通知标记已读
export function readNotice(id: string): Promise<void> {
  return callWithFallback(
    () => api.post({ url: `/api/v1/notify/notices/${id}/read` }),
    () => notifyService.readNotice(id)
  )
}

// 事件标记已读
export function readEvent(id: string): Promise<void> {
  return callWithFallback(
    () => api.post({ url: `/api/v1/notify/events/${id}/read` }),
    () => notifyService.readEvent(id)
  )
}

// 全部事件标记已读
export function readAllEvents(): Promise<void> {
  return callWithFallback(
    () => api.post({ url: '/api/v1/notify/events/read-all' }),
    () => notifyService.readAllEvents()
  )
}

/* ------------------------------ 平台公告管理（超管） ------------------------------ */

// 公告分页
export function fetchAnnouncementPage(params: {
  page: number
  pageSize: number
  keyword?: string
  status?: number
}): Promise<Api.Common.PaginatedResponse<Api.Notify.AnnouncementAdmin>> {
  return callWithFallback(
    () =>
      api.get({
        url: '/api/v1/platform/announcements',
        params: {
          page: params.page,
          pageSize: params.pageSize,
          keyword: params.keyword,
          status: params.status
        }
      }),
    () =>
      notifyService.fetchAnnouncementPage({
        current: params.page,
        size: params.pageSize,
        keyword: params.keyword,
        status: params.status
      })
  )
}

// 单条公告详情（管理侧详情页；含已读/确认人数与反馈工单数）
export function fetchAnnouncementAdminDetail(id: string): Promise<Api.Notify.AnnouncementAdmin> {
  return callWithFallback(
    () => api.get({ url: `/api/v1/platform/announcements/${id}` }),
    async () => {
      const page = await notifyService.fetchAnnouncementPage({ current: 1, size: 100 })
      const hit = page.records.find((item) => String(item.id) === String(id))
      if (!hit) throw new Error('公告不存在')
      return hit
    }
  )
}

// 创建/更新公告（publishNow=true 直接发布，否则存草稿）
export function saveAnnouncement(params: Api.Notify.AnnouncementSaveParams): Promise<void> {
  return callWithFallback(
    () => api.post({ url: '/api/v1/platform/announcements', data: params }),
    () => notifyService.saveAnnouncement(params)
  )
}

// 发布公告
export function publishAnnouncement(id: string): Promise<void> {
  return callWithFallback(
    () => api.put({ url: `/api/v1/platform/announcements/${id}/publish` }),
    () => notifyService.publishAnnouncement(id)
  )
}

// 撤回公告
export function withdrawAnnouncement(id: string): Promise<void> {
  return callWithFallback(
    () => api.put({ url: `/api/v1/platform/announcements/${id}/withdraw` }),
    () => notifyService.withdrawAnnouncement(id)
  )
}

// 删除公告
export function deleteAnnouncement(id: string): Promise<void> {
  return callWithFallback(
    () => api.del({ url: `/api/v1/platform/announcements/${id}` }),
    () => notifyService.deleteAnnouncement(id)
  )
}

// 已读统计（按租户维度）
export function fetchAnnouncementStats(id: string): Promise<Api.Notify.AnnouncementStats> {
  return callWithFallback(
    () => api.get({ url: `/api/v1/platform/announcements/${id}/stats` }),
    () => notifyService.fetchAnnouncementStats(id)
  )
}

// 租户选项（定向指定租户用）
export function fetchTenantOptions(): Promise<Api.Notify.NotifyOption[]> {
  return callWithFallback(
    () => api.get({ url: '/api/v1/platform/announcements/options/tenants' }),
    () => notifyService.fetchTenantOptions()
  )
}

/* ------------------------------ 租户通知管理（管理员） ------------------------------ */

// 通知分页（当前租户）
export function fetchNoticePage(params: {
  page: number
  pageSize: number
  keyword?: string
}): Promise<Api.Common.PaginatedResponse<Api.Notify.NoticeAdmin>> {
  return callWithFallback(
    () =>
      api.get({
        url: '/api/v1/tenant/notices',
        params: { page: params.page, pageSize: params.pageSize, keyword: params.keyword }
      }),
    () =>
      notifyService.fetchNoticePage({
        current: params.page,
        size: params.pageSize,
        keyword: params.keyword
      })
  )
}

// 单条通知详情（管理侧详情页；含应读/已读与留言数，店长仅本门店）
export function fetchNoticeAdminDetail(id: string): Promise<Api.Notify.NoticeAdmin> {
  return callWithFallback(
    () => api.get({ url: `/api/v1/tenant/notices/${id}` }),
    async () => {
      const page = await notifyService.fetchNoticePage({ current: 1, size: 100 })
      const hit = page.records.find((item) => String(item.id) === String(id))
      if (!hit) throw new Error('通知不存在或无权查看')
      return hit
    }
  )
}

// 发送通知（sender 由后端会话取，不收前端传参）
export function sendNotice(params: Api.Notify.NoticeSendParams): Promise<void> {
  return callWithFallback(
    () => api.post({ url: '/api/v1/tenant/notices', data: params }),
    () => notifyService.sendNotice(params)
  )
}

// 编辑通知（标题/正文/定向范围；发送人与发送时间后端保持不变）
export function updateNotice(id: string, params: Api.Notify.NoticeSendParams): Promise<void> {
  return callWithFallback(
    () => api.put({ url: `/api/v1/tenant/notices/${id}`, data: params }),
    () => notifyService.updateNotice(id, params)
  )
}

// 撤回通知（接收人不可见、不计未读，可重新发布）
export function withdrawNotice(id: string): Promise<void> {
  return callWithFallback(
    () => api.put({ url: `/api/v1/tenant/notices/${id}/withdraw` }),
    () => notifyService.withdrawNotice(id)
  )
}

// 重新发布通知（刷新发送时间，立即可见并重新计入未读）
export function publishNotice(id: string): Promise<void> {
  return callWithFallback(
    () => api.put({ url: `/api/v1/tenant/notices/${id}/publish` }),
    () => notifyService.publishNotice(id)
  )
}

// 已读统计（谁没看、按门店已读率）
export function fetchNoticeStats(id: string): Promise<Api.Notify.NoticeStats> {
  return callWithFallback(
    () => api.get({ url: `/api/v1/tenant/notices/${id}/stats` }),
    () => notifyService.fetchNoticeStats(id)
  )
}

// 删除通知
export function deleteNotice(id: string): Promise<void> {
  return callWithFallback(
    () => api.del({ url: `/api/v1/tenant/notices/${id}` }),
    () => notifyService.deleteNotice(id)
  )
}

// 门店选项（店长仅本门店）
export function fetchStoreOptions(): Promise<Api.Notify.NotifyOption[]> {
  return callWithFallback(
    () => api.get({ url: '/api/v1/tenant/notices/options/stores' }),
    () => notifyService.fetchStoreOptions()
  )
}

// 角色选项（当前租户）
export function fetchRoleOptions(): Promise<Api.Notify.NotifyOption[]> {
  return callWithFallback(
    () => api.get({ url: '/api/v1/tenant/notices/options/roles' }),
    () => notifyService.fetchRoleOptions()
  )
}

// 人员选项（店长仅本门店）
export function fetchUserOptions(): Promise<Api.Notify.NotifyOption[]> {
  return callWithFallback(
    () => api.get({ url: '/api/v1/tenant/notices/options/users' }),
    () => notifyService.fetchUserOptions()
  )
}
