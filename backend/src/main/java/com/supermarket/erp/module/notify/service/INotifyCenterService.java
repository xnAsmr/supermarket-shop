package com.supermarket.erp.module.notify.service;

import com.supermarket.erp.module.notify.vo.AnnouncementVO;
import com.supermarket.erp.module.notify.vo.EventVO;
import com.supermarket.erp.module.notify.vo.NoticeVO;
import com.supermarket.erp.module.notify.vo.NotifyUnreadVO;

import java.util.List;

/**
 * 消息中心（用户侧统一入口）：系统公告（平台层，只读+确认）/ 我的通知（租户层）/ 事件提醒
 */
public interface INotifyCenterService {

    /** 当前用户可见的系统公告（含已读/确认状态） */
    List<AnnouncementVO> announcements();

    /** 单条系统公告详情（可见性口径与列表一致，越权/不存在抛 4004） */
    AnnouncementVO announcement(Long announcementId);

    /** 当前用户可见的租户通知（含已读状态） */
    List<NoticeVO> notices();

    /** 单条租户通知详情（可见性口径与列表一致，越权/不存在抛 4004） */
    NoticeVO notice(Long noticeId);

    /** 当前用户的事件提醒（最近 50 条） */
    List<EventVO> events();

    /** 单条事件提醒详情（仅本人可见） */
    EventVO event(Long eventId);

    /** 未读数汇总（顶栏铃铛角标） */
    NotifyUnreadVO unreadCount();

    /** 标记公告已读 */
    void readAnnouncement(Long announcementId);

    /** 公告确认（我已知晓） */
    void ackAnnouncement(Long announcementId);

    /** 标记通知已读 */
    void readNotice(Long noticeId);

    /** 标记单条事件已读 */
    void readEvent(Long eventId);

    /** 全部事件标记已读 */
    void readAllEvents();
}
