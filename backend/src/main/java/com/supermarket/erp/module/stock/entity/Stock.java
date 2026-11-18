package com.supermarket.erp.module.stock.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("wms_stock")
public class Stock {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long storeId;

    private Long productId;

    private BigDecimal warehouseQuantity;

    private BigDecimal shelfQuantity;

    private BigDecimal avgCost;

    /** 门店级预警线覆盖（NULL 表示沿用商品默认） */
    private BigDecimal warnThreshold;

    /** 门店级紧急线覆盖（NULL 表示沿用商品默认） */
    private BigDecimal urgentThreshold;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
