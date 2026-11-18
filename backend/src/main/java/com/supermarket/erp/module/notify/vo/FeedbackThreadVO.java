package com.supermarket.erp.module.notify.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 平台公告私密反馈 - 工单视图（一条顶层留言 = 一个工单）
 */
@Data
public class FeedbackThreadVO {

    /** 顶层留言ID（工单ID） */
    private Long id;

    private Long tenantId;

    private String tenantName;

    private Long storeId;

    private Long userId;

    private String userName;

    /** 提问内容（顶层留言） */
    private String content;

    /** PENDING待处理 REPLIED已回复 CLOSED已关闭 */
    private String threadStatus;

    private LocalDateTime createTime;

    private String replyByName;

    private LocalDateTime replyAt;

    /** 工单内留言条数（含回复） */
    private Integer messageCount;

    /** 工单详情（仅详情接口填充） */
    private List<NotifyMessageVO> messages;
}
