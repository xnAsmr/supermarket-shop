package com.supermarket.erp.module.notify.service;

import com.supermarket.erp.module.notify.dto.MessageCreateDTO;
import com.supermarket.erp.module.notify.vo.FeedbackThreadVO;
import com.supermarket.erp.module.notify.vo.NotifyMessageVO;
import com.supermarket.erp.module.notify.vo.NotifyOptionVO;

import java.util.List;

/**
 * 公告/通知留言服务
 *
 * 两种语义：
 * - 平台公告（ANNOUNCEMENT）→ 私密反馈：仅留言人 + 平台可见，工单式流转
 * - 租户通知（NOTICE）→ 公告内留言：可见范围继承通知定向范围，支持一层回复
 *
 * 所有接口的可见性均以「能否看到公告/通知」为前提，tenant_id / user_id 一律取自会话。
 */
public interface INotifyMessageService {

    /** 用户侧：留言列表（平台公告返回本人私密工单，租户通知返回公告内公开留言） */
    List<NotifyMessageVO> list(String targetType, Long targetId);

    /** 用户侧：发表留言（平台公告起新工单；租户通知可 parentId 指定回复某条顶层留言） */
    void create(MessageCreateDTO dto);

    /** 用户侧：本人撤回（仅 5 分钟内、且未被屏蔽） */
    void withdraw(Long messageId);

    /** 用户侧：可 @ 的候选人员（该通知的应读用户，排除自己；平台私密反馈不适用） */
    List<NotifyOptionVO> mentionCandidates(Long noticeId);

    /** 用户侧：将某个留言对象标记为已读（推进已读水位，用于列表行未读红点） */
    void markRead(String targetType, Long targetId);

    /* ------------------------------ 平台侧 ------------------------------ */

    /** 平台侧：某公告的反馈工单列表（待处理优先） */
    List<FeedbackThreadVO> threads(Long announcementId);

    /** 平台侧：单个工单详情（含全部往来留言） */
    FeedbackThreadVO threadDetail(Long threadId);

    /** 平台侧：回复工单（并向提问人推送事件提醒） */
    void reply(Long threadId, String content);

    /** 平台侧：关闭工单 */
    void close(Long threadId);
}
