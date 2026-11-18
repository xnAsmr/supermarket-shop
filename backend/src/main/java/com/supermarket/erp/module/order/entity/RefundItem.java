package com.supermarket.erp.module.order.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 退货单商品明细（支持按商品部分退货）。
 */
@Data
@TableName("oms_refund_item")
public class RefundItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long storeId;

    private Long refundId;

    private Long orderId;

    private Long productId;

    private String productName;

    private String barcode;

    private String spec;

    private String unit;

    /** 退货数量 */
    private BigDecimal quantity;

    /** 退货单价（取原订单成交价） */
    private BigDecimal salePrice;

    /** 小计金额 */
    private BigDecimal totalPrice;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
