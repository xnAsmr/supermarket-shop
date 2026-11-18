package com.supermarket.erp.module.purchase.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * 采购订单收货入库入参（收货即入库：确认本次收货数量后直接加库存并生成入库单）。
 *
 * <p>支持部分收货：每次收货按剩余可收数量填写，重复收货直至全部收齐。
 */
@Data
public class PurchaseReceiveDTO {

    @Valid
    @NotEmpty(message = "请至少填写一行收货数量")
    private List<Item> items;

    @Data
    public static class Item {

        @NotNull(message = "采购订单明细不能为空")
        private Long orderItemId;

        @NotNull(message = "收货数量不能为空")
        @Min(value = 1, message = "收货数量必须大于 0")
        private Integer quantity;

        /** 批次号（选填） */
        private String batchNo;
    }
}
