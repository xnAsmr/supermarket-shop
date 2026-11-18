package com.supermarket.erp.module.notify.vo;

import lombok.Data;

/**
 * 通用下拉选项（门店/角色/人员/租户选择器）
 */
@Data
public class NotifyOptionVO {

    private Long id;

    private String name;

    /** 租户套餐类型（仅租户选项使用） */
    private Integer planType;

    public NotifyOptionVO() {
    }

    public NotifyOptionVO(Long id, String name) {
        this.id = id;
        this.name = name;
    }

    public NotifyOptionVO(Long id, String name, Integer planType) {
        this.id = id;
        this.name = name;
        this.planType = planType;
    }
}
