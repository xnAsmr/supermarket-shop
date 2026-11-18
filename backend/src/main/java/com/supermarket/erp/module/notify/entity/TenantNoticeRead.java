package com.supermarket.erp.module.notify.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 租户通知阅读记录（按用户；notice_id + user_id 唯一）
 */
@Data
@TableName("tenant_notice_read")
public class TenantNoticeRead {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long noticeId;

    private Long tenantId;

    private Long userId;

    private LocalDateTime readAt;
}
