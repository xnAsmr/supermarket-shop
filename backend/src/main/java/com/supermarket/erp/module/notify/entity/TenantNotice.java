package com.supermarket.erp.module.notify.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 租户通知（租户层，管理员发送；tenant_id 强制隔离）
 * store_id 为空 = 租户总部发起（全租户可见）；非空 = 仅该门店员工可见
 */
@Data
@TableName("tenant_notice")
public class TenantNotice {

    public static final String SCOPE_ALL = "ALL";
    public static final String SCOPE_STORE = "STORE";
    public static final String SCOPE_ROLE = "ROLE";
    public static final String SCOPE_USER = "USER";

    /** 状态：已发送（对接收人可见） */
    public static final int STATUS_SENT = 0;
    /** 状态：已撤回（对接收人不可见、不计未读，可重新发布） */
    public static final int STATUS_WITHDRAWN = 1;

    /** 类型：门店通知（日常店务，默认） */
    public static final int TYPE_STORE = 1;
    /** 类型：制度规范（规章制度、流程标准） */
    public static final int TYPE_RULE = 2;
    /** 类型：活动安排（促销、盘点、培训等计划性事项） */
    public static final int TYPE_EVENT = 3;

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    /** 发起门店：NULL=租户总部发起 */
    private Long storeId;

    private String title;

    private String content;

    /** 通知类型：1=门店通知 2=制度规范 3=活动安排 */
    private Integer noticeType;

    /** 定向范围：ALL/STORE/ROLE/USER */
    private String targetScope;

    /** target_scope=STORE 时生效，逗号分隔门店ID */
    private String targetStoreIds;

    /** target_scope=ROLE 时生效，逗号分隔角色ID */
    private String targetRoleIds;

    /** target_scope=USER 时生效，逗号分隔用户ID */
    private String targetUserIds;

    /** 发送人ID（后端会话取，不收前端传参） */
    private Long senderId;

    private String senderName;

    private LocalDateTime sendTime;

    /** 状态：0=已发送 1=已撤回（撤回后接收人不可见、不计未读，可重新发布） */
    private Integer status;

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
