package com.supermarket.erp.module.stock.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 上架单新建/编辑入参。
 */
@Data
public class ShelfUpCreateDTO {

    @NotNull(message = "门店不能为空")
    private Long storeId;

    @Valid
    @NotEmpty(message = "请至少添加一条上架明细")
    private List<Item> items;

    private String remark;

    @Data
    public static class Item {

        @NotNull(message = "商品不能为空")
        private Long productId;

        @NotNull(message = "上架数量不能为空")
        private BigDecimal quantity;

        private String remark;
    }
}
