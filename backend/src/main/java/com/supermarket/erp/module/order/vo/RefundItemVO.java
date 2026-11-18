package com.supermarket.erp.module.order.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class RefundItemVO {

    private Long id;

    private Long productId;

    private String productName;

    private String barcode;

    private String spec;

    private String unit;

    /** 退货数量 */
    private BigDecimal quantity;

    private BigDecimal salePrice;

    private BigDecimal totalPrice;
}
