package com.supermarket.erp.module.notify.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.notify.entity.NotifyEventLog;
import com.supermarket.erp.module.notify.vo.PlatformAdminRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface NotifyEventLogMapper extends BaseMapper<NotifyEventLog> {

    /** 租户管理员用户ID（user_type=2），排除指定用户（如提交人自己） */
    @Select("SELECT id FROM sys_user WHERE tenant_id = #{tenantId} AND deleted = 0 AND status = 1 " +
            "AND user_type = '2' AND id != #{excludeUserId}")
    List<Long> selectTenantAdminUserIds(@Param("tenantId") Long tenantId, @Param("excludeUserId") Long excludeUserId);

    /**
     * 平台超管（user_type=3）及其所属租户
     * 事件提醒按 (tenant_id, user_id) 分区，故必须带出各自的 tenant_id
     */
    @Select("SELECT id AS userId, tenant_id AS tenantId FROM sys_user " +
            "WHERE user_type = '3' AND deleted = 0 AND status = 1")
    List<PlatformAdminRow> selectPlatformAdmins();
}
