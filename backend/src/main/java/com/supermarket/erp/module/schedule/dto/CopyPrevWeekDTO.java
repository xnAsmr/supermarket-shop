package com.supermarket.erp.module.schedule.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 复制上周班表入参 */
@Data
public class CopyPrevWeekDTO {

    @NotBlank(message = "门店不能为空")
    private String storeId;

    @NotBlank(message = "周起始日期不能为空")
    private String weekStart;
}
