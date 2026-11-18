package com.supermarket.erp.module.order.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 收支流水（逐笔支付明细）视图对象。
 *
 * <p>与 {@code oms_order_payment} 一一对应，并补齐业务展示所需的
 * 关联订单号（order_no）与操作人姓名（operator_name）。
 */
@Data
public class PaymentRecordVO {

    /** 支付明细主键 */
    private Long id;

    /** 收款流水号（payment_no） */
    private String paymentNo;

    /** 关联订单ID */
    private Long orderId;

    /** 关联订单号（oms_order.order_no），用于「关联单号」列展示 */
    private String orderNo;

    /**
     * 记录类型：1-原始收款 2-退款冲减 3-取消冲减 4-恢复冲增。
     * 仅 record_type=1 为订单原始收款。
     */
    private Integer recordType;

    /** 收支类型：income 收入 / expense 支出（由 amount 正负推导） */
    private String type;

    /** 业务分类：销售收款 / 销售退款 / 取消冲减 / 恢复冲增 / 其它 */
    private String category;

    /** 金额（正为收，负为退/冲减） */
    private BigDecimal amount;

    /** 实收金额（现金支付） */
    private BigDecimal receivedAmount;

    /** 找零金额（现金支付） */
    private BigDecimal changeAmount;

    /** 支付方式编码 */
    private String paymentMethod;

    /** 支付方式名称 */
    private String paymentMethodName;

    /** 操作人ID */
    private Long operatorId;

    /** 操作人姓名（sys_user.name），用于「操作人」列展示 */
    private String operatorName;

    /** 支付时间 */
    private LocalDateTime payTime;

    /** 备注 */
    private String remark;
}
