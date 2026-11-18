package com.supermarket.erp.module.notify.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 平台公告管理项（超管侧列表视图）
 */
@Data
public class AnnouncementAdminVO {

    private Long id;

    private String title;

    private String content;

    private Integer noticeType;

    private String targetScope;

    private Integer targetPlanType;

    private String targetTenantIds;

    private LocalDateTime effectiveAt;

    private LocalDateTime expireAt;

    private Integer requireAck;

    /** 定向用户类型：NULL=目标租户全部用户；2=仅租户内系统管理员 */
    private Integer targetUserType;

    /** 状态：0草稿 1已发布 2已撤回 */
    private Integer status;

    private String publisherName;

    /** 已读人数 */
    private Integer readCount;

    /** 已确认人数 */
    private Integer ackCount;

    /** 私密反馈工单数（顶层留言数） */
    private Integer feedbackCount;

    /** 待处理反馈工单数（PENDING） */
    private Integer pendingFeedbackCount;

    private LocalDateTime createTime;
}
