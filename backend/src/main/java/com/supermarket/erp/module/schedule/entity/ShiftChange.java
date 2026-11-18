package com.supermarket.erp.module.schedule.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 排班-调班申请（sch_shift_change）。
 *
 * <p>审批通过后由服务层改写对应周班表明细（source=CHANGE），班表无需人工二次修改。
 */
@Data
@TableName("sch_shift_change")
public class ShiftChange {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long storeId;

    private Long applicantId;

    private String applicantName;

    private Long targetUserId;

    private String targetUserName;

    private LocalDate workDate;

    private Long shiftId;

    /** 1换班 2替班 3请假 */
    private Integer changeType;

    private String reason;

    /** 0待审批 1已通过 2已拒绝 */
    private Integer status;

    private Long reviewerId;

    private String reviewerName;

    private LocalDateTime reviewTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    private Long createBy;

    private Long updateBy;

    @TableLogic
    private Integer deleted;
}
