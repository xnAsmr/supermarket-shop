package com.supermarket.erp.module.notify.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.notify.entity.NotifyMessageRead;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;

@Mapper
public interface NotifyMessageReadMapper extends BaseMapper<NotifyMessageRead> {

    /**
     * 推进已读水位（幂等 + 只增不减）：
     * 用 GREATEST 兜住并发/重复上报，避免旧水位覆盖新水位导致红点“复活”
     */
    @Insert("INSERT INTO notify_message_read " +
            "(target_type, target_id, tenant_id, user_id, last_read_id, last_read_at) " +
            "VALUES (#{targetType}, #{targetId}, #{tenantId}, #{userId}, #{lastReadId}, #{lastReadAt}) " +
            "ON DUPLICATE KEY UPDATE " +
            "last_read_id = GREATEST(last_read_id, VALUES(last_read_id)), " +
            "last_read_at = VALUES(last_read_at), " +
            "tenant_id = VALUES(tenant_id)")
    int upsertRead(@Param("targetType") String targetType,
                   @Param("targetId") Long targetId,
                   @Param("tenantId") Long tenantId,
                   @Param("userId") Long userId,
                   @Param("lastReadId") Long lastReadId,
                   @Param("lastReadAt") LocalDateTime lastReadAt);
}
