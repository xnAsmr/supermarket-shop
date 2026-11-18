package com.supermarket.erp.module.notify.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.notify.entity.TenantNoticeRead;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;

@Mapper
public interface TenantNoticeReadMapper extends BaseMapper<TenantNoticeRead> {

    /** 标记已读（幂等：已存在则忽略） */
    @Insert("INSERT IGNORE INTO tenant_notice_read (notice_id, tenant_id, user_id, read_at) " +
            "VALUES (#{noticeId}, #{tenantId}, #{userId}, #{readAt})")
    int insertIgnoreRead(@Param("noticeId") Long noticeId,
                         @Param("tenantId") Long tenantId,
                         @Param("userId") Long userId,
                         @Param("readAt") LocalDateTime readAt);
}
