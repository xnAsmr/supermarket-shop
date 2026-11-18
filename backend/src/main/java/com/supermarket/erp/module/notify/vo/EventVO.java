package com.supermarket.erp.module.notify.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 消息中心 - 事件提醒项（系统触发，如采购审批提醒）
 */
@Data
public class EventVO {

    private Long id;

    /** 事件类型：PURCHASE_SUBMIT / PURCHASE_APPROVED / PURCHASE_REVIEW_REVOKED 等 */
    private String eventType;

    private String title;

    private String content;

    /** 关联业务类型 */
    private String bizType;

    private Long bizId;

    /** 是否已读 */
    private Boolean read;

    private LocalDateTime createTime;
}
