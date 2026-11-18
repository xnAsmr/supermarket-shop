package com.supermarket.erp.module.purchase.dto;

import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;

/**
 * 采购退货单查询参数。
 */
@Data
public class PurchaseReturnQueryDTO {

    private String keyword;

    private String returnNo;

    /** 来源采购订单ID */
    private Long orderId;

    /** 来源采购单号（模糊） */
    private String orderNo;

    /** 来源收货单ID */
    private Long receiptId;

    /** 来源收货单号（模糊） */
    private String receiptNo;

    private Long supplierId;

    private Long storeId;

    /** 状态（见 PurchaseDocStatus） */
    private Integer status;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime startDate;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime endDate;

    private Integer page = 1;

    private Integer pageSize = 20;
}
