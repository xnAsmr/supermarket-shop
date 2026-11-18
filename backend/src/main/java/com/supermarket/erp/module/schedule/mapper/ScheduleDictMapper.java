package com.supermarket.erp.module.schedule.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/**
 * 排班模块的字典查询：员工与门店复用 sys_user / sys_store，这里只补充角色名。
 * 不新建员工表、门店表，也不改动 auth / system 模块。
 */
@Mapper
public interface ScheduleDictMapper {

    /** 取用户的首个角色名作为前端 EmployeeOption.role；无角色时由服务层按 userType 兜底 */
    @Select("SELECT r.role_name FROM sys_user_role ur " +
            "JOIN sys_role r ON r.id = ur.role_id AND r.deleted = 0 " +
            "WHERE ur.user_id = #{userId} " +
            "ORDER BY r.id LIMIT 1")
    String selectRoleName(@Param("userId") Long userId);
}
