package com.supermarket.erp.module.product.vo;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 热销商品聚合结果（按商品汇总已完成销售订单的销量与销售额）。
 */
@Data
public class HotProductReportVO {

    private Long productId;
    private String productName;
    /** 销量（已完成销售订单的商品数量合计） */
    private Long saleCount;
    /** 销售额（已完成销售订单的商品 total_price 合计） */
    private BigDecimal salesAmount;
}
