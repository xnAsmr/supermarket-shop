package com.supermarket.erp.module.notify.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 消息中心 - 我的通知项（租户通知，用户侧视图，含当前用户已读状态）
 */
@Data
public class NoticeVO {

    private Long id;

    private String title;

    private String content;

    /** 类型：1门店通知 2制度规范 3活动安排 */
    private Integer noticeType;

    private String senderName;

    private LocalDateTime sendTime;

    /** 当前用户是否已读 */
    private Boolean read;

    private LocalDateTime readAt;

    /** 未读留言数（别人在通知下发表的公开留言，未读红点用） */
    private Integer unreadComments = 0;
}
