package com.supermarket.erp.module.notify.vo;

import lombok.Data;

/**
 * 留言按留言对象聚合的计数行（列表页批量统计，避免 N+1）
 */
@Data
public class TargetCountRow {

    private Long targetId;

    /** 顶层留言数 */
    private Integer total;

    /** 待处理工单数（仅平台公告私密反馈有值） */
    private Integer pending;
}
