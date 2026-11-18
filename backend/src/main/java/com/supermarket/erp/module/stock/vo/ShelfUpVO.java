package com.supermarket.erp.module.stock.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class ShelfUpVO {

    private Long id;

    private String shelfUpNo;

    private Long storeId;

    private String storeName;

    private BigDecimal totalQuantity;

    /** 0草稿 1已上架 2已撤销 */
    private Integer status;

    private String operatorName;

    private String shelfUpUserName;

    private LocalDateTime shelfUpTime;

    private String remark;

    private LocalDateTime createTime;

    private List<ShelfUpItemVO> items;

    @Data
    public static class ShelfUpItemVO {

        private Long id;

        private Long productId;

        private String productName;

        private String barcode;

        private String spec;

        private String unit;

        /** 本次上架数量 */
        private BigDecimal quantity;

        /** 当前仓库库存（便于确认是否够搬） */
        private BigDecimal warehouseQuantity;

        /** 当前货架库存 */
        private BigDecimal shelfQuantity;

        private String remark;
    }
}
