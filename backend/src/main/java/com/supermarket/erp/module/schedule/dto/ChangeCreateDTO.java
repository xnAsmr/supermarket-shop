package com.supermarket.erp.module.schedule.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** 发起调班申请入参。申请人始终取当前登录用户，不接受前端伪造。 */
@Data
public class ChangeCreateDTO {

    @NotBlank(message = "门店不能为空")
    private String storeId;

    @NotBlank(message = "调班日期不能为空")
    private String date;

    @NotBlank(message = "班次不能为空")
    private String shiftId;

    @NotBlank(message = "请选择接班同事")
    private String targetUserId;

    @NotNull(message = "调班类型不能为空")
    @Min(value = 1, message = "调班类型只能是 1换班 / 2替班 / 3请假")
    @Max(value = 3, message = "调班类型只能是 1换班 / 2替班 / 3请假")
    private Integer changeType;

    @NotBlank(message = "请填写调班原因")
    @Size(max = 500, message = "调班原因不能超过 500 个字符")
    private String reason;
}
