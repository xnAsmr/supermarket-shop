package com.supermarket.erp.module.order.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class RefundVO {

    private Long id;

    private String refundNo;

    private Long orderId;

    private String orderNo;

    private BigDecimal refundAmount;

    /** 退款方式：1-现金 2-原路退回 */
    private Integer refundMethod;

    /** 退款方式名称（现金 / 原路退回） */
    private String refundMethodName;

    private String refundReason;

    /** 状态：0-待处理 1-已完成 2-已驳回 3-已作废 */
    private Integer status;

    private String operatorName;

    private LocalDateTime refundTime;

    private LocalDateTime createTime;

    private String remark;

    private List<RefundItemVO> items;
}
