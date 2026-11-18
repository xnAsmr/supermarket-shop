package com.supermarket.erp.module.notify.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 平台公告阅读/确认记录（按用户；announcement_id + user_id 唯一）
 */
@Data
@TableName("platform_announcement_read")
public class PlatformAnnouncementRead {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long announcementId;

    private Long tenantId;

    private Long userId;

    private LocalDateTime readAt;

    /** 确认（我已知晓）时间 */
    private LocalDateTime ackAt;
}
