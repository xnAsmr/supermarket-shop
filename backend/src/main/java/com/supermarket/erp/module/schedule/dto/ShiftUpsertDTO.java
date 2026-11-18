package com.supermarket.erp.module.schedule.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 班次新增/编辑入参。对应前端 Api.Schedule.ShiftUpsertPayload。
 * 允许部分字段为空（支持局部更新），必填与时间合法性在服务层做语义校验并给出明确错误。
 */
@Data
public class ShiftUpsertDTO {

    /** 有值为编辑，无值为新增 */
    private String id;

    /** 为空表示租户通用班次 */
    private String storeId;

    @Size(max = 50, message = "班次名称不能超过 50 个字符")
    private String name;

    @Size(max = 50, message = "班次编码不能超过 50 个字符")
    private String code;

    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "开始时间格式应为 HH:mm（00:00~23:59）")
    private String start;

    @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$", message = "结束时间格式应为 HH:mm（00:00~23:59）")
    private String end;

    private String color;

    @Min(value = 0, message = "最低在岗人数不能小于 0")
    private Integer minStaff;

    private String role;

    @Min(value = 0, message = "休息分钟数不能小于 0")
    private Integer rest;

    private Integer sort;

    private Boolean enabled;

    @Size(max = 500, message = "备注不能超过 500 个字符")
    private String remark;
}
