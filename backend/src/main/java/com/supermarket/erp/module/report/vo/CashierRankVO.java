package com.supermarket.erp.module.report.vo;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 收银员业绩排行项（按销售订单数量排序）
 */
@Data
public class CashierRankVO {

    /** 收银员用户 ID（对应 oms_order.operator_id / sys_user.id） */
    private Long operatorId;

    /** 收银员姓名（sys_user.name，无关联用户时兜底为「未知收银员」） */
    private String operatorName;

    /** 销售订单数量（统计周期内的订单笔数） */
    private Long orderCount;

    /** 销售订单金额合计（pay_amount 之和，用于辅助展示） */
    private BigDecimal salesAmount;
}
