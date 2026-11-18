package com.supermarket.erp.module.notify.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 消息中心 - 系统公告项（用户侧视图，含当前用户的已读/确认状态）
 */
@Data
public class AnnouncementVO {

    private Long id;

    private String title;

    private String content;

    /** 类型：1功能更新 2系统维护 3规则变更 */
    private Integer noticeType;

    /** 是否强制确认：0否 1是 */
    private Integer requireAck;

    /** 定向用户类型：NULL=全部用户；2=仅系统管理员 */
    private Integer targetUserType;

    private LocalDateTime effectiveAt;

    private String publisherName;

    /** 当前用户是否已读 */
    private Boolean read;

    private LocalDateTime readAt;

    private LocalDateTime ackAt;

    /** 是否需要当前用户确认（requireAck=1 且未确认） */
    private Boolean needAck;

    /** 未读回复数（平台对我方私密反馈的回复，未读红点用） */
    private Integer unreadComments = 0;
}
