package com.supermarket.erp.module.notify.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 留言项（用户侧 / 平台侧共用）
 */
@Data
public class NotifyMessageVO {

    private Long id;

    private String targetType;

    private Long targetId;

    private Long tenantId;

    private Long userId;

    private String userName;

    /** 1=租户用户 2=平台 */
    private Integer authorType;

    private String scope;

    private Long parentId;

    /** 工单状态（仅 PRIVATE 顶层）：PENDING/REPLIED/CLOSED */
    private String threadStatus;

    private String replyByName;

    private LocalDateTime replyAt;

    private String content;

    /** 被 @ 提醒的用户姓名（仅展示） */
    private List<String> mentionedNames;

    /** 是否置顶（仅租户通知顶层公开留言） */
    private Boolean pinned = Boolean.FALSE;

    private Integer status;

    private LocalDateTime createTime;

    /** 是否本人留言 */
    private Boolean mine;

    /** 是否可撤回（本人 + 正常 + 5 分钟内） */
    private Boolean canWithdraw;
}
