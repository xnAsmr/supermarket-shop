package com.supermarket.erp.module.purchase.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 采购退货单明细（本次退货数量）。
 */
@Data
@TableName("pms_purchase_return_item")
public class PurchaseReturnItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long returnId;

    /** 来源采购订单ID */
    private Long orderId;

    /** 来源采购订单明细ID */
    private Long orderItemId;

    /** 来源收货单ID */
    private Long receiptId;

    /** 来源收货单明细ID */
    private Long receiptItemId;

    private Long productId;

    private String productName;

    private String barcode;

    private String spec;

    private String unit;

    /** 本次退货数量 */
    private BigDecimal quantity;

    private BigDecimal purchasePrice;

    private BigDecimal totalPrice;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
