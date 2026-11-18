package com.supermarket.erp.module.notify.dto;

import lombok.Data;

/**
 * 平台公告创建/编辑 DTO（发布人为当前登录超管，后端会话取）
 */
@Data
public class AnnouncementSaveDTO {

    private Long id;

    private String title;

    private String content;

    /** 类型：1功能更新 2系统维护 3规则变更 */
    private Integer noticeType;

    /** 定向范围：ALL/PLAN/ASSIGN */
    private String targetScope;

    /** target_scope=PLAN 时生效 */
    private Integer targetPlanType;

    /** target_scope=ASSIGN 时生效，逗号分隔租户ID */
    private String targetTenantIds;

    /** 生效时间（yyyy-MM-dd HH:mm:ss，可预约） */
    private String effectiveAt;

    /** 失效时间（yyyy-MM-dd HH:mm:ss，可空=长期有效） */
    private String expireAt;

    /** 是否强制已读确认 */
    private Boolean requireAck;

    /** 定向用户类型：NULL=目标租户全部用户；2=仅租户内系统管理员(user_type=2) */
    private Integer targetUserType;

    /** 是否立即发布（false=存草稿） */
    private Boolean publishNow;
}
