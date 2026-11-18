package com.supermarket.erp.module.schedule.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 排班-排班明细（sch_schedule_item）：某人在某营业日的某个班次。
 *
 * <p>shift_start_at / shift_end_at 是把「营业日 + 班次起止时间 + 跨夜标记」归一化后的真实时刻区间，
 * 跨夜班的结束时刻已 +1 天，用于跨日/跨周的班次冲突与时间段检索。
 */
@Data
@TableName("sch_schedule_item")
public class ScheduleItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long scheduleId;

    private Long storeId;

    private Long shiftId;

    /** 营业日（跨夜班记为开始日） */
    private LocalDate workDate;

    private Long userId;

    /** 员工姓名快照，避免人员变动后历史班表失真 */
    private String userName;

    /** 岗位快照 */
    private String roleCode;

    private LocalDateTime shiftStartAt;

    private LocalDateTime shiftEndAt;

    /** 0正常 1已取消 2已调出 */
    private Integer status;

    /** 0手工 1复制上周 2调班生成 */
    private Integer source;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    private Long createBy;

    private Long updateBy;

    @TableLogic
    private Integer deleted;
}
