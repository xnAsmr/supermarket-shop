package com.supermarket.erp.module.schedule.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/** 单条排班明细新增入参（补齐明细粒度的 CRUD） */
@Data
public class ScheduleItemDTO {

    @NotBlank(message = "门店不能为空")
    private String storeId;

    @NotBlank(message = "排班日期不能为空")
    private String date;

    @NotBlank(message = "班次不能为空")
    private String shiftId;

    @NotBlank(message = "员工不能为空")
    private String userId;

    @Size(max = 50, message = "岗位快照不能超过 50 个字符")
    private String roleCode;
}
