package com.supermarket.erp.module.order.dto;

import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class OrderQueryDTO {

    private String keyword;

    private Integer orderStatus;

    /**
     * 订单状态多选（orderStatus 为空时生效）。
     * 前端需要同时查询「已取消」等状态时使用。
     */
    private List<Integer> orderStatuses;

    private Integer payStatus;

    private Long operatorId;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime startDate;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime endDate;

    private Integer page = 1;

    private Integer pageSize = 20;
}
