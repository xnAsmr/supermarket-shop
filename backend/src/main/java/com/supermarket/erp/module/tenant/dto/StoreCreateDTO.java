package com.supermarket.erp.module.tenant.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class StoreCreateDTO {

    @NotBlank(message = "门店名称不能为空")
    private String storeName;

    private String address;

    private String contactPhone;

    private Long managerId;

    private Integer storeType;

    private String businessHours;

    private String logo;

    private Integer sort;

    private String remark;

    /** 归属租户（新增时系统管理员可指定；普通用户忽略，取当前租户） */
    private Long tenantId;
}
