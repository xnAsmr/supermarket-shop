package com.supermarket.erp.module.schedule.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** 调班审批入参：1通过 2拒绝 */
@Data
public class ChangeReviewDTO {

    @NotNull(message = "审批结果不能为空")
    @Min(value = 1, message = "审批结果只能是 1通过 / 2拒绝")
    @Max(value = 2, message = "审批结果只能是 1通过 / 2拒绝")
    private Integer status;
}
