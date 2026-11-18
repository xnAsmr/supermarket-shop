package com.supermarket.erp.module.notify.vo;

import lombok.Data;

/**
 * 平台超管（user_type=3）及其所属租户（事件提醒需要 tenant_id 分区）
 */
@Data
public class PlatformAdminRow {

    private Long userId;

    private Long tenantId;
}
