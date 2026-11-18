package com.supermarket.erp.module.purchase.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 采购订单新建/编辑入参。
 */
@Data
public class PurchaseOrderCreateDTO {

    @NotNull(message = "供应商不能为空")
    private Long supplierId;

    @NotNull(message = "收货门店不能为空")
    private Long storeId;

    @Valid
    @NotEmpty(message = "请至少添加一条采购明细")
    private List<Item> items;

    private String remark;

    @Data
    public static class Item {

        @NotNull(message = "商品不能为空")
        private Long productId;

        @NotNull(message = "订购数量不能为空")
        private BigDecimal orderedQty;

        @NotNull(message = "采购价不能为空")
        private BigDecimal purchasePrice;

        private String remark;
    }
}
