package com.supermarket.erp.module.notify.dto;

import lombok.Data;

/**
 * 留言置顶参数（PUT body）
 *
 * pinned 为空按「置顶」处理，避免前端漏传时把置顶意外取消。
 */
@Data
public class CommentPinDTO {

    /** true=置顶 false=取消置顶 */
    private Boolean pinned;
}
