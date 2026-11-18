package com.supermarket.erp.module.schedule.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 班表状态操作（发布 / 撤回）入参 */
@Data
public class WeekActionDTO {

    @NotBlank(message = "班表ID不能为空")
    private String id;
}
