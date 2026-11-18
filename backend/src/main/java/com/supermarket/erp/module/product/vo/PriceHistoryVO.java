package com.supermarket.erp.module.product.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 商品价格历史视图（价格走势图数据点）。 */
@Data
public class PriceHistoryVO {

    private Long id;

    private BigDecimal purchasePrice;

    private BigDecimal salePrice;

    private BigDecimal vipPrice;

    /** 来源：create=建档 edit=调价 */
    private String source;

    private LocalDateTime createTime;
}
