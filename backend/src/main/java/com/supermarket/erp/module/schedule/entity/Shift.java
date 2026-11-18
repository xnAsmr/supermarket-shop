package com.supermarket.erp.module.schedule.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 排班-班次模板（sch_shift）。
 *
 * <p>store_id 为 NULL 表示租户通用班次，否则为门店专属班次。
 * start_time / end_time 使用 varchar(5) 的 HH:mm 字符串，与前端 ShiftItem.start/end 契约一致，
 * 同时规避项目 JacksonConfig 未注册 LocalTime 序列化器的问题。
 */
@Data
@TableName("sch_shift")
public class Shift {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long storeId;

    private String shiftName;

    private String shiftCode;

    private String startTime;

    private String endTime;

    /** 是否跨夜 0否 1是 */
    private Integer crossDay;

    private String color;

    /** 最低在岗人数 */
    private Integer minStaff;

    /** 岗位要求（前端 ShiftItem.role） */
    private String roleName;

    /** 休息分钟数（工时统计扣除） */
    private Integer restMinutes;

    private Integer sort;

    /** 0停用 1启用 */
    private Integer enabled;

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
