package com.supermarket.erp.module.notify.dto;

import lombok.Data;

/**
 * 平台回复私密反馈参数
 */
@Data
public class FeedbackReplyDTO {

    /** 回复内容（纯文本，上限 1000 字） */
    private String content;
}
