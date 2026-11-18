package com.supermarket.erp.module.stock.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 上架单明细（本次从仓库搬到货架的数量）。
 */
@Data
@TableName("wms_shelf_up_item")
public class ShelfUpItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long shelfUpId;

    private Long productId;

    private String productName;

    private String barcode;

    private String spec;

    private String unit;

    /** 本次上架数量 */
    private BigDecimal quantity;

    private String remark;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
