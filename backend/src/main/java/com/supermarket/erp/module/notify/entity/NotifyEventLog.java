package com.supermarket.erp.module.notify.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 事件提醒日志（系统触发，按接收人逐条落库，发送与已读追踪）
 */
@Data
@TableName("notify_event_log")
public class NotifyEventLog {

    /* 事件类型常量 */
    public static final String EVENT_PURCHASE_SUBMIT = "PURCHASE_SUBMIT";
    public static final String EVENT_PURCHASE_APPROVED = "PURCHASE_APPROVED";
    public static final String EVENT_PURCHASE_REVIEW_REVOKED = "PURCHASE_REVIEW_REVOKED";

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long storeId;

    /** 接收人用户ID */
    private Long userId;

    /** 事件类型：PURCHASE_SUBMIT / PURCHASE_APPROVED / PURCHASE_REVIEW_REVOKED 等 */
    private String eventType;

    private String title;

    private String content;

    /** 关联业务类型：PURCHASE_ORDER 等 */
    private String bizType;

    private Long bizId;

    private Integer isRead;

    private LocalDateTime readAt;

    private LocalDateTime createTime;
}
