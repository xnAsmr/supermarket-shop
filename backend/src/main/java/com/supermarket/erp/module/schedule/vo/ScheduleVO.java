package com.supermarket.erp.module.schedule.vo;

import lombok.Data;

import java.util.List;

/**
 * 排班模块出参集合，字段与 frontend/src/types/api/api.d.ts 的 Api.Schedule 完全一致。
 *
 * <p>关键约定：
 * <ul>
 *   <li>所有 id（含 userId / shiftId / scheduleId / storeId）一律输出 String，避免前端 Long 精度丢失；</li>
 *   <li>周班表状态输出 'draft' / 'published' / 'archived'，明细来源输出 'manual' / 'copy' / 'change'；</li>
 *   <li>调班类型与审批状态沿用前端数字约定（1/2/3 与 0/1/2）；</li>
 *   <li>日期输出 yyyy-MM-dd，时间输出 yyyy-MM-dd HH:mm:ss 字符串。</li>
 * </ul>
 */
public final class ScheduleVO {

    private ScheduleVO() {
    }

    /** 门店下拉项 */
    @Data
    public static class StoreOptionVO {
        private String id;
        private String name;
        private String businessHours;
    }

    /** 可选员工 */
    @Data
    public static class EmployeeOptionVO {
        private String id;
        private String name;
        private String role;
        private String storeId;
    }

    /** 班次模板 */
    @Data
    public static class ShiftVO {
        private String id;
        private String storeId;
        private String name;
        private String code;
        private String start;
        private String end;
        private boolean crossDay;
        private String color;
        private int minStaff;
        private String role;
        private int rest;
        private int sort;
        private boolean enabled;
        private String remark;
    }

    /** 排班明细 */
    @Data
    public static class ScheduleItemVO {
        private String id;
        private String scheduleId;
        private String date;
        private String shiftId;
        private String userId;
        private String roleCode;
        private String source;
    }

    /** 周班表（含整周明细） */
    @Data
    public static class WeekScheduleVO {
        private String id;
        private String storeId;
        private String weekStart;
        private String status;
        private String publishTime;
        /** 发布人姓名（未发布时为空） */
        private String publisherName;
        private List<ScheduleItemVO> items;
    }

    /** 调班申请 */
    @Data
    public static class ChangeVO {
        private String id;
        private String storeId;
        private String applicantId;
        private String applicantName;
        private String targetUserId;
        private String targetUserName;
        private String date;
        private String shiftId;
        private Integer changeType;
        private String reason;
        private Integer status;
        private String reviewerName;
        private String reviewTime;
        private String createTime;
    }

    /** 班表发布前校验报告：冲突为阻断项，缺员为提示项 */
    @Data
    public static class ValidationVO {
        private boolean passable;
        private List<String> conflicts;
        private List<String> shortages;
    }
}
