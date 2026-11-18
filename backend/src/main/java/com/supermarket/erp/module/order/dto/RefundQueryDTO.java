package com.supermarket.erp.module.order.dto;

import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;

/**
 * 退货单查询参数。
 */
@Data
public class RefundQueryDTO {

    /** 退货单号（模糊） */
    private String refundNo;

    /** 原订单号（模糊） */
    private String orderNo;

    /** 状态：0-待处理 1-已完成 2-已驳回 3-已作废 */
    private Integer status;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime startDate;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime endDate;

    private Integer page = 1;

    private Integer pageSize = 20;
}
