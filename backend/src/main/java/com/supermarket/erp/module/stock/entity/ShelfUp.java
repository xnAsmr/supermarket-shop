package com.supermarket.erp.module.stock.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 上架单（仓库 → 货架，同一门店内的库存移动）。
 *
 * <p>与出库单的区别：出库单是货物离开门店（调拨/报损/其他），
 * 上架单只是把仓库的货搬到货架，不涉及金额与外部方，因此不设审核。
 *
 * <p>状态：0 草稿 / 1 已上架 / 2 已撤销
 */
@Data
@TableName("wms_shelf_up")
public class ShelfUp {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    /** 上架单号 */
    private String shelfUpNo;

    private Long storeId;

    /** 上架总数量 */
    private BigDecimal totalQuantity;

    /** 0草稿 1已上架 2已撤销 */
    private Integer status;

    private Long operatorId;

    private Long shelfUpUserId;

    private LocalDateTime shelfUpTime;

    private String remark;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    private Long createBy;

    private Long updateBy;

    @TableLogic
    private Integer deleted;
}
