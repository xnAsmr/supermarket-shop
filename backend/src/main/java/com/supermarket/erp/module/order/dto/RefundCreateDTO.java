package com.supermarket.erp.module.order.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 发起退货（按商品部分退货）入参。
 */
@Data
public class RefundCreateDTO {

    /** 原订单ID */
    @NotNull(message = "原订单ID不能为空")
    private Long orderId;

    /** 退货明细 */
    @NotEmpty(message = "请选择需要退货的商品")
    private List<Item> items;

    /** 退款方式：1-现金 2-原路退回 */
    @NotNull(message = "退款方式不能为空")
    private Integer refundMethod;

    /** 退货原因 */
    private String refundReason;

    @Data
    public static class Item {

        @NotNull(message = "商品ID不能为空")
        private Long productId;

        @NotNull(message = "退货数量不能为空")
        private BigDecimal quantity;
    }
}
