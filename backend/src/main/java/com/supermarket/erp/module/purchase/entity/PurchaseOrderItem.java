package com.supermarket.erp.module.purchase.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 采购订单明细。
 *
 * <p>三个数量共同表达「订多少 / 收多少 / 退多少」：
 * <ul>
 *   <li>{@code orderedQty} 订购数量</li>
 *   <li>{@code receivedQty} 已收数量（每次收货累加）</li>
 *   <li>{@code returnedQty} 已退数量（每次退货累加）</li>
 * </ul>
 */
@Data
@TableName("pms_purchase_order_item")
public class PurchaseOrderItem {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long orderId;

    private Long productId;

    private String productName;

    private String barcode;

    private String spec;

    private String unit;

    /** 订购数量 */
    private BigDecimal orderedQty;

    /** 已收数量 */
    private BigDecimal receivedQty;

    /** 已退数量 */
    private BigDecimal returnedQty;

    private BigDecimal purchasePrice;

    private BigDecimal totalPrice;

    private String remark;

    @TableLogic
    private Integer deleted;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
