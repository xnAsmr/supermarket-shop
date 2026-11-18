package com.supermarket.erp.module.stock.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * 批量设置商品级库存预警线 / 紧急线。
 *
 * <p>仅更新 pms_product 的 stock_warn_threshold / stock_urgent_threshold 两列，
 * 门店级覆盖（wms_stock）不受影响。
 */
@Data
public class StockWarningThresholdDTO {

    @Valid
    @NotEmpty(message = "请至少选择一个商品")
    @Size(max = 1000, message = "单次最多设置 1000 个商品")
    private List<Item> items;

    @Data
    public static class Item {

        @NotNull(message = "商品ID不能为空")
        private Long productId;

        @NotNull(message = "预警线不能为空")
        @Min(value = 0, message = "预警线不能小于 0")
        private BigDecimal warnThreshold;

        @NotNull(message = "紧急线不能为空")
        @Min(value = 0, message = "紧急线不能小于 0")
        private BigDecimal urgentThreshold;
    }
}
