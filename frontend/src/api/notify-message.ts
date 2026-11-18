/**
 * 公告/通知留言 API
 *
 * 两种语义（后端同表，用 scope 区分）：
 * 1. 平台公告（ANNOUNCEMENT）→ 私密反馈：仅「留言人 + 平台」可见，工单式流转
 * 2. 租户通知（NOTICE）→ 公告内留言：可见范围继承通知定向范围，支持一层回复
 *
 * 用户侧接口不设按钮权限：能看见公告/通知即可参与，越权由后端可见性校验兜底。
 * 平台回复与租户屏蔽分别需要 platform:announcement:feedback:manage / notify:notice:comment:manage。
 */
import { api } from './core/backend'

/** 留言列表（平台公告返回本人私密反馈；租户通知返回公告内公开留言） */
export function fetchMessages(
  targetType: 'ANNOUNCEMENT' | 'NOTICE',
  targetId: string
): Promise<Api.Notify.MessageItem[]> {
  return api.get({ url: '/api/v1/notify/messages', params: { targetType, targetId } })
}

/** 发表留言（parentId 为空=新留言；非空=回复租户通知下的顶层留言） */
export function createMessage(params: Api.Notify.MessageCreateParams): Promise<void> {
  return api.post({ url: '/api/v1/notify/messages', data: params })
}

/** 撤回本人留言（仅 5 分钟内） */
export function withdrawMessage(id: string): Promise<void> {
  return api.del({ url: `/api/v1/notify/messages/${id}` })
}

/**
 * 可 @ 的候选人员：该通知的应读用户（排除自己）
 * 平台公告私密反馈是「我 ↔ 平台」一对一，不提供 @
 */
export function fetchMentionCandidates(noticeId: string): Promise<Api.Notify.NotifyOption[]> {
  return api.get({ url: '/api/v1/notify/messages/mentions', params: { noticeId } })
}

/** 标记留言已读（推进已读水位，清除消息中心列表行红点） */
export function markMessagesRead(
  targetType: 'ANNOUNCEMENT' | 'NOTICE',
  targetId: string
): Promise<void> {
  return api.post({
    url: '/api/v1/notify/messages/read',
    data: { targetType, targetId }
  })
}

/* ------------------------------ 平台侧：私密反馈 ------------------------------ */

/** 反馈工单列表（待处理优先） */
export function fetchFeedbackThreads(announcementId: string): Promise<Api.Notify.FeedbackThread[]> {
  return api.get({ url: `/api/v1/platform/announcements/${announcementId}/feedbacks` })
}

/** 反馈工单详情（含全部往来留言） */
export function fetchFeedbackDetail(
  announcementId: string,
  threadId: string
): Promise<Api.Notify.FeedbackThread> {
  return api.get({
    url: `/api/v1/platform/announcements/${announcementId}/feedbacks/${threadId}`
  })
}

/** 回复反馈工单（后端同时向提问人推送事件提醒） */
export function replyFeedback(
  announcementId: string,
  threadId: string,
  content: string
): Promise<void> {
  return api.post({
    url: `/api/v1/platform/announcements/${announcementId}/feedbacks/${threadId}/reply`,
    data: { content }
  })
}

/** 关闭反馈工单 */
export function closeFeedback(announcementId: string, threadId: string): Promise<void> {
  return api.put({
    url: `/api/v1/platform/announcements/${announcementId}/feedbacks/${threadId}/close`
  })
}

/* ------------------------------ 租户侧：留言管理 ------------------------------ */

/** 屏蔽通知下的公开留言（租户管理员管全租户，店长仅本门店通知） */
export function hideNoticeComment(id: string): Promise<void> {
  return api.del({ url: `/api/v1/tenant/notices/comments/${id}` })
}

/** 置顶/取消置顶通知下的公开留言（单条通知最多置顶 3 条） */
export function pinNoticeComment(id: string, pinned: boolean): Promise<void> {
  return api.put({ url: `/api/v1/tenant/notices/comments/${id}/pin`, data: { pinned } })
}
