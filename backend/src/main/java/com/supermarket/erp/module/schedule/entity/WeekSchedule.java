package com.supermarket.erp.module.schedule.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 排班-周班表（sch_schedule）：一个门店一周一张班表，以周一日期为锚。
 *
 * <p>状态：0草稿（可编辑）/ 1已发布（只读，局部变更走调班审批）/ 2已归档。
 * 班表不提供删除，只做状态流转，因此唯一键不含 deleted。
 */
@Data
@TableName("sch_schedule")
public class WeekSchedule {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long storeId;

    private LocalDate weekStartDate;

    private Integer status;

    private LocalDateTime publishTime;

    private Long publisherId;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    private Long createBy;

    private Long updateBy;

    @TableLogic
    private Integer deleted;
}
