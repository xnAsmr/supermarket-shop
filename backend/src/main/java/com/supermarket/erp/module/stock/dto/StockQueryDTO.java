package com.supermarket.erp.module.stock.dto;

import lombok.Data;

@Data
public class StockQueryDTO {

    private Long storeId;

    private Long productId;

    private Long categoryId;

    /** 0=全部 1=有库存 2=无库存 */
    private Integer stockStatus;

    /**
     * 预警筛选：
     * null=全部；warning=所有预警（含紧急/缺货）；urgent=紧急；out_of_stock=缺货
     */
    private String warnLevel;

    private String keyword;

    private Integer page = 1;

    private Integer pageSize = 20;
}
