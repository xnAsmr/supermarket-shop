package com.supermarket.erp.module.system.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class RoleCreateDTO {

    @NotBlank(message = "角色名称不能为空")
    private String roleName;

    @NotBlank(message = "角色编码不能为空")
    private String roleCode;

    private String description;

    private Integer status;

    /** 角色范围：1=租户私有 2=平台共享（所有租户均可用） 3=平台内置（仅超管可用）；仅超级管理员可设置 2/3 */
    private Integer roleScope;

    private List<Long> menuIds;
}
