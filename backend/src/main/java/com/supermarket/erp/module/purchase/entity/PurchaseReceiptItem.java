package com.supermarket.erp.module.purchase.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 采购收货单明细（本次实收数量）。
 */
@Data
@TableName("wms_purchase_receipt_item")
public class PurchaseReceiptItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long receiptId;

    /** 来源采购订单ID */
    private Long orderId;

    /** 来源采购订单明细ID */
    private Long orderItemId;

    private Long productId;

    private String productName;

    private String barcode;

    private String spec;

    private String unit;

    /** 本次实收数量 */
    private BigDecimal quantity;

    private BigDecimal purchasePrice;

    private BigDecimal totalPrice;

    private String batchNo;

    private LocalDateTime expireTime;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
