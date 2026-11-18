package com.supermarket.erp.module.notify.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 公告/通知留言（平台私密反馈 + 租户公告内留言）
 *
 * 两种语义共用一张表，用 scope 区分：
 * - PRIVATE  ：平台公告下的私密反馈，仅「留言人 + 平台」可见，工单式（PENDING/REPLIED/CLOSED）
 * - AUDIENCE ：租户通知下的公告内留言，可见范围继承通知定向范围（能收到通知才看得到）
 *
 * 注意：留言与已读、强制确认完全解耦，不参与已读率/确认率统计。
 */
@Data
@TableName("notify_message")
public class NotifyMessage {

    public static final String TARGET_ANNOUNCEMENT = "ANNOUNCEMENT";
    public static final String TARGET_NOTICE = "NOTICE";

    public static final String SCOPE_PRIVATE = "PRIVATE";
    public static final String SCOPE_AUDIENCE = "AUDIENCE";

    /** 作者类型：租户用户 */
    public static final int AUTHOR_TENANT_USER = 1;
    /** 作者类型：平台（超管） */
    public static final int AUTHOR_PLATFORM = 2;

    /** 工单状态：待处理 */
    public static final String THREAD_PENDING = "PENDING";
    /** 工单状态：已回复 */
    public static final String THREAD_REPLIED = "REPLIED";
    /** 工单状态：已关闭 */
    public static final String THREAD_CLOSED = "CLOSED";

    public static final int STATUS_NORMAL = 0;
    /** 本人撤回 */
    public static final int STATUS_WITHDRAWN = 1;
    /** 管理员屏蔽 */
    public static final int STATUS_HIDDEN = 2;

    /** 本人撤回时限（毫秒）：超时只能由管理员屏蔽，避免“已读后改口” */
    public static final long WITHDRAW_WINDOW_MILLIS = 5 * 60 * 1000L;

    /** 单条通知最多置顶留言数（超过后需先取消旧置顶） */
    public static final int MAX_PINNED_PER_TARGET = 3;

    @TableId(type = IdType.AUTO)
    private Long id;

    /** ANNOUNCEMENT=平台公告 NOTICE=租户通知 */
    private String targetType;

    private Long targetId;

    /** 留言人所属租户（平台回复沿用提问方租户） */
    private Long tenantId;

    private Long storeId;

    private Long userId;

    private String userName;

    /** 1=租户用户 2=平台 */
    private Integer authorType;

    /** PRIVATE / AUDIENCE */
    private String scope;

    /** 0=顶层；AUDIENCE 仅一层回复 */
    private Long parentId;

    /** 工单状态（仅 PRIVATE 顶层）：PENDING/REPLIED/CLOSED */
    private String threadStatus;

    private Long replyBy;

    private String replyByName;

    private LocalDateTime replyAt;

    private String content;

    /** 被 @ 提醒的用户ID，逗号分隔（仅租户通知留言使用） */
    private String mentionedUserIds;

    /** 被 @ 提醒的用户姓名快照，逗号分隔（仅展示用） */
    private String mentionedNames;

    /** 0正常 1本人撤回 2管理员屏蔽 */
    private Integer status;

    /** 是否置顶：0否 1是（仅租户通知顶层公开留言可置顶） */
    private Integer pinned;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
