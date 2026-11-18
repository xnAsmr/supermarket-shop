package com.supermarket.erp.module.notify.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 租户通知管理项（租户管理员侧列表视图）
 */
@Data
public class TenantNoticeAdminVO {

    private Long id;

    private String title;

    private String content;

    /** 通知类型：1=门店通知 2=制度规范 3=活动安排 */
    private Integer noticeType;

    private String targetScope;

    private String targetStoreIds;

    private String targetRoleIds;

    private String targetUserIds;

    private Long storeId;

    private String senderName;

    private LocalDateTime sendTime;

    /** 通知状态：0=已发送 1=已撤回 */
    private Integer status;

    /** 应读人数（按定向范围匹配的用户数） */
    private Integer audienceCount;

    /** 已读人数 */
    private Integer readCount;

    /** 公告内留言数（顶层留言数，不含回复） */
    private Integer commentCount;

    private LocalDateTime createTime;
}
