package com.supermarket.erp.module.notify.vo;

import lombok.Data;

import java.util.List;

/**
 * 平台公告已读统计（按租户维度）
 */
@Data
public class AnnouncementStatsVO {

    private Long announcementId;

    private String title;

    /** 是否强制确认 */
    private Integer requireAck;

    /** 定向用户类型：NULL=全部用户；2=仅系统管理员 */
    private Integer targetUserType;

    /** 应读用户总数（目标租户下的启用用户） */
    private Integer userCount;

    /** 已读用户数 */
    private Integer readCount;

    /** 已确认用户数 */
    private Integer ackCount;

    /** 按租户统计 */
    private List<TenantStat> tenants;

    @Data
    public static class TenantStat {
        private Long tenantId;
        private String tenantName;
        private Integer userCount;
        private Integer readCount;
        private Integer ackCount;
    }
}
