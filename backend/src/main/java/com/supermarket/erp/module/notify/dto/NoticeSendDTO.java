package com.supermarket.erp.module.notify.dto;

import lombok.Data;

/**
 * 租户通知发送 DTO（sender_id 从后端会话取，不接收前端传参）
 * 校验：店长（角色=STORE_MANAGER）只能发本门店；租户管理员/老板/总部可发全租户
 */
@Data
public class NoticeSendDTO {

    private String title;

    private String content;

    /** 通知类型：1=门店通知 2=制度规范 3=活动安排（为空按 1 处理） */
    private Integer noticeType;

    /** 定向范围：ALL全员/STORE指定门店/ROLE指定角色/USER指定人员 */
    private String targetScope;

    /** target_scope=STORE 时生效，逗号分隔门店ID */
    private String targetStoreIds;

    /** target_scope=ROLE 时生效，逗号分隔角色ID */
    private String targetRoleIds;

    /** target_scope=USER 时生效，逗号分隔用户ID */
    private String targetUserIds;
}
