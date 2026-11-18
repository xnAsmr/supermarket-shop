package com.supermarket.erp.module.notify.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.notify.entity.PlatformAnnouncementRead;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;

@Mapper
public interface PlatformAnnouncementReadMapper extends BaseMapper<PlatformAnnouncementRead> {

    /** 标记已读（幂等：已存在则忽略） */
    @Insert("INSERT IGNORE INTO platform_announcement_read (announcement_id, tenant_id, user_id, read_at) " +
            "VALUES (#{announcementId}, #{tenantId}, #{userId}, #{readAt})")
    int insertIgnoreRead(@Param("announcementId") Long announcementId,
                         @Param("tenantId") Long tenantId,
                         @Param("userId") Long userId,
                         @Param("readAt") LocalDateTime readAt);

    /** 标记确认（我已知晓；未读过则同时视为已读） */
    @Insert("INSERT IGNORE INTO platform_announcement_read (announcement_id, tenant_id, user_id, read_at, ack_at) " +
            "VALUES (#{announcementId}, #{tenantId}, #{userId}, #{now}, #{now})")
    int insertIgnoreAck(@Param("announcementId") Long announcementId,
                        @Param("tenantId") Long tenantId,
                        @Param("userId") Long userId,
                        @Param("now") LocalDateTime now);
}
