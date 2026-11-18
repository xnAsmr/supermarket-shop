package com.supermarket.erp.module.purchase.dto;

import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;

/**
 * 采购订单查询参数。
 */
@Data
public class PurchaseOrderQueryDTO {

    /** 关键词（订单号模糊） */
    private String keyword;

    private String orderNo;

    private Long supplierId;

    private Long storeId;

    /** 状态（见 PurchaseOrder.status） */
    private Integer status;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime startDate;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime endDate;

    private Integer page = 1;

    private Integer pageSize = 20;
}
