package com.supermarket.erp.module.notify.vo;

import lombok.Data;

import java.util.List;

/**
 * 租户通知已读统计（谁没看、按门店已读率）
 */
@Data
public class NoticeStatsVO {

    private Long noticeId;

    private String title;

    /** 应读人数 */
    private Integer audienceCount;

    /** 已读人数 */
    private Integer readCount;

    /** 未读人数 */
    private Integer unreadCount;

    /** 未读名单 */
    private List<UnreadUser> unreadUsers;

    /** 按门店已读统计 */
    private List<StoreStat> stores;

    @Data
    public static class UnreadUser {
        private Long userId;
        private String userName;
        private String storeName;
    }

    @Data
    public static class StoreStat {
        private Long storeId;
        private String storeName;
        private Integer userCount;
        private Integer readCount;
    }
}
