package com.supermarket.erp.module.schedule.enums;

/**
 * 排班模块枚举集中定义：数据库存 int，出参统一转换为前端契约的字符串或数字。
 */
public final class ScheduleEnums {

    private ScheduleEnums() {
    }

    /** 周班表状态 → 前端 WeekStatus */
    public enum WeekStatus {
        DRAFT(0, "draft"),
        PUBLISHED(1, "published"),
        ARCHIVED(2, "archived");

        private final int code;
        private final String value;

        WeekStatus(int code, String value) {
            this.code = code;
            this.value = value;
        }

        public int getCode() {
            return code;
        }

        public String getValue() {
            return value;
        }

        public static WeekStatus of(Integer code) {
            for (WeekStatus s : values()) {
                if (s.code == (code == null ? 0 : code)) {
                    return s;
                }
            }
            return DRAFT;
        }
    }

    /** 明细来源 → 前端 ScheduleItem.source */
    public enum ItemSource {
        MANUAL(0, "manual"),
        COPY(1, "copy"),
        CHANGE(2, "change");

        private final int code;
        private final String value;

        ItemSource(int code, String value) {
            this.code = code;
            this.value = value;
        }

        public int getCode() {
            return code;
        }

        public String getValue() {
            return value;
        }

        public static ItemSource of(Integer code) {
            for (ItemSource s : values()) {
                if (s.code == (code == null ? 0 : code)) {
                    return s;
                }
            }
            return MANUAL;
        }

        /** 前端字符串 → 数据库编码，未知值按手工处理 */
        public static int fromValue(String value) {
            if (value == null) {
                return MANUAL.code;
            }
            for (ItemSource s : values()) {
                if (s.value.equalsIgnoreCase(value.trim())) {
                    return s.code;
                }
            }
            return MANUAL.code;
        }
    }

    /** 调班类型：与前端 ChangeType 数字一致 */
    public enum ChangeType {
        SWAP(1), COVER(2), LEAVE(3);

        private final int code;

        ChangeType(int code) {
            this.code = code;
        }

        public int getCode() {
            return code;
        }

        public static boolean isValid(Integer code) {
            if (code == null) {
                return false;
            }
            for (ChangeType t : values()) {
                if (t.code == code) {
                    return true;
                }
            }
            return false;
        }
    }

    /** 审批状态：与前端 ChangeStatus 数字一致 */
    public enum ChangeStatus {
        PENDING(0), APPROVED(1), REJECTED(2);

        private final int code;

        ChangeStatus(int code) {
            this.code = code;
        }

        public int getCode() {
            return code;
        }
    }

    /** 明细状态 */
    public enum ItemStatus {
        NORMAL(0), CANCELLED(1), TRANSFERRED_OUT(2);

        private final int code;

        ItemStatus(int code) {
            this.code = code;
        }

        public int getCode() {
            return code;
        }
    }
}
