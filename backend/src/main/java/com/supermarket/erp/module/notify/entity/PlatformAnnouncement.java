package com.supermarket.erp.module.notify.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 平台公告（平台层 → 租户，超管维护）
 * 可见性由查询时判断：status=已发布 AND effective_at <= now AND（未过期）AND 命中定向范围
 */
@Data
@TableName("platform_announcement")
public class PlatformAnnouncement {

    public static final String SCOPE_ALL = "ALL";
    public static final String SCOPE_PLAN = "PLAN";
    public static final String SCOPE_ASSIGN = "ASSIGN";

    public static final int TYPE_UPDATE = 1;
    public static final int TYPE_MAINTENANCE = 2;
    public static final int TYPE_RULE = 3;

    public static final int STATUS_DRAFT = 0;
    public static final int STATUS_PUBLISHED = 1;
    public static final int STATUS_WITHDRAWN = 2;

    /** 定向用户类型：NULL=目标租户全部用户；2=仅租户内系统管理员(user_type=2) */
    public static final int TARGET_USER_SYS_ADMIN = 2;

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String content;

    /** 类型：1功能更新 2系统维护 3规则变更 */
    private Integer noticeType;

    /** 定向范围：ALL/PLAN/ASSIGN */
    private String targetScope;

    /** target_scope=PLAN 时生效（对应 sys_tenant.plan_type） */
    private Integer targetPlanType;

    /** target_scope=ASSIGN 时生效，逗号分隔租户ID */
    private String targetTenantIds;

    /** 生效时间（可预约，到点自动可见） */
    private LocalDateTime effectiveAt;

    /** 失效时间（NULL=长期有效） */
    private LocalDateTime expireAt;

    /** 是否强制已读确认：0否 1是 */
    private Integer requireAck;

    /** 定向用户类型：NULL=目标租户全部用户；2=仅租户内系统管理员(user_type=2) */
    private Integer targetUserType;

    /** 状态：0草稿 1已发布 2已撤回 */
    private Integer status;

    private Long publisherId;

    private String publisherName;

    @TableField(fill = FieldFill.INSERT)
    private Long createBy;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private Long updateBy;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
