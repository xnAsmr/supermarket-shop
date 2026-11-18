package com.supermarket.erp.module.auth.mapper;

import com.supermarket.erp.module.auth.vo.DevLoginAccountVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/** 开发环境调试账号查询：直接 JOIN 租户/门店取显示名，不查密码列。 */
@Mapper
public interface DevLoginAccountMapper {

    @Select("SELECT u.username, u.name AS real_name, " +
            "u.tenant_id, t.tenant_name, " +
            "u.store_id, s.store_name, " +
            "u.user_type " +
            "FROM sys_user u " +
            "LEFT JOIN sys_tenant t ON t.id = u.tenant_id AND t.deleted = 0 " +
            "LEFT JOIN sys_store s ON s.id = u.store_id AND s.deleted = 0 " +
            "WHERE u.deleted = 0 AND u.status = 1 " +
            "ORDER BY u.tenant_id, u.user_type DESC, u.id")
    List<DevLoginAccountVO> selectAccounts();
}
