package com.supermarket.erp.module.notify.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * Mapper 行：通知应读用户及其阅读状态（用于已读统计聚合）
 */
@Data
public class NoticeAudienceRow {

    private Long userId;

    private String userName;

    private Long storeId;

    private String storeName;

    private LocalDateTime readAt;
}
