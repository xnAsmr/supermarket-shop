package com.supermarket.erp.module.system.vo;

import lombok.Data;

import java.util.List;

@Data
public class RoleVO {

    private Long id;

    private Long tenantId;

    private String roleName;

    private String roleCode;

    private String description;

    private Integer status;

    /** 角色范围：1=租户私有 2=平台共享（所有租户均可用） 3=平台内置（仅超管可用） */
    private Integer roleScope;

    private List<Long> menuIds;
}
