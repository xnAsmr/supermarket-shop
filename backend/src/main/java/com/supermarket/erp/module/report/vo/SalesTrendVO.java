package com.supermarket.erp.module.report.vo;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 销售总览趋势点（经营驾驶舱「销售总览」柱线组合图）
 *
 * statKey 分组键由后端按 range 生成：
 * 日 = yyyy-MM-dd，月 = yyyy-MM，年 = yyyy；周由前端按日数据聚合
 */
@Data
public class SalesTrendVO {

    /** 分组键（日期/月份/年份） */
    private String statKey;

    /** 销售总额（实付金额） */
    private BigDecimal payAmount;

    /** 订单总量 */
    private Integer orderCount;

    /** 营收（毛利） */
    private BigDecimal profitAmount;
}
