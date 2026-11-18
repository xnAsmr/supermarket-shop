package com.supermarket.erp.module.purchase.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 采购退货单新建/编辑入参。
 *
 * <p>可带 {@code orderId} / {@code receiptId} 带出可退明细；退回数量不能超过已收未退数量。
 */
@Data
public class PurchaseReturnCreateDTO {

    /** 来源采购订单ID */
    private Long orderId;

    /** 来源收货单ID（按收货单退货时记录） */
    private Long receiptId;

    @NotNull(message = "门店不能为空")
    private Long storeId;

    @Valid
    @NotEmpty(message = "请至少添加一条退货明细")
    private List<Item> items;

    @NotNull(message = "退货原因不能为空")
    private String reason;

    private String remark;

    @Data
    public static class Item {

        @NotNull(message = "商品不能为空")
        private Long productId;

        /** 来源采购订单明细ID */
        private Long orderItemId;

        /** 来源收货单明细ID */
        private Long receiptItemId;

        @NotNull(message = "退货数量不能为空")
        private BigDecimal quantity;

        /** 采购单价（可省略，由来源明细带出） */
        private BigDecimal purchasePrice;
    }
}
