package com.supermarket.erp.module.notify.dto;

import lombok.Data;

import java.util.List;

/**
 * 留言创建参数（tenant_id / user_id 由后端会话取，不收前端传参）
 */
@Data
public class MessageCreateDTO {

    /** ANNOUNCEMENT=平台公告 NOTICE=租户通知 */
    private String targetType;

    private Long targetId;

    /** 回复的顶层留言ID（仅租户通知留言使用；为空或 0 表示发表新留言） */
    private Long parentId;

    /** 被 @ 提醒的用户ID（仅租户通知使用，后端按通知应读人员收敛） */
    private List<Long> mentionedUserIds;

    /** 留言内容（纯文本，上限 1000 字） */
    private String content;
}
