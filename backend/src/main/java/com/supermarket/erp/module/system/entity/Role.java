package com.supermarket.erp.module.system.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sys_role")
public class Role {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private String roleName;

    private String roleCode;

    private String description;

    private Integer status;

    /**
     * 角色范围：
     *  1 = 租户私有（默认）：仅本租户可见/可维护/可分配/可作为租户层通知对象
     *  2 = 平台共享：所有租户均可用（可见、可分配给本租户用户、可作为租户层通知对象）；
     *              仅超级管理员可创建/修改/删除（维护权归平台）
     *  3 = 平台内置：仅超级管理员可见与可用（如系统管理员 sysAdmin，
     *              携带平台级权限 platform:announcement:manage，防止租户管理员分配后提权）
     */
    public static final int SCOPE_TENANT = 1;
    public static final int SCOPE_PLATFORM = 2;
    public static final int SCOPE_BUILTIN = 3;

    private Integer roleScope;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
