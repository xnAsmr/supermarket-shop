package com.supermarket.erp.module.order.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("oms_order_payment")
public class OrderPayment {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long storeId;

    private String paymentNo;

    private Long orderId;

    private String paymentMethod;

    private BigDecimal amount;

    /**
     * 记录类型：1-原始收款 2-退款冲减 3-取消冲减 4-恢复冲增。
     * 只有原始收款（1）参与取消/恢复时的回滚计算，避免调整记录被重复冲减。
     */
    private Integer recordType;

    private BigDecimal receivedAmount;

    private BigDecimal changeAmount;

    private Long operatorId;

    private String remark;

    private LocalDateTime payTime;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
