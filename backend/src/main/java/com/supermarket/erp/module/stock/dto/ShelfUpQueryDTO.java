package com.supermarket.erp.module.stock.dto;

import lombok.Data;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDateTime;

/**
 * 上架单查询参数。
 */
@Data
public class ShelfUpQueryDTO {

    private String keyword;

    private String shelfUpNo;

    private Long storeId;

    /** 0草稿 1已上架 2已撤销 */
    private Integer status;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime startDate;

    @DateTimeFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime endDate;

    private Integer page = 1;

    private Integer pageSize = 20;
}
