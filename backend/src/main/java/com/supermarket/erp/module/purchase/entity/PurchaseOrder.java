package com.supermarket.erp.module.purchase.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 采购订单（业务意图：我要订什么）。
 *
 * <p>状态：
 * <ul>
 *   <li>0 草稿（明细可编辑）</li>
 *   <li>1 待审核</li>
 *   <li>2 已审核（可开始收货）</li>
 *   <li>3 部分收货</li>
 *   <li>4 已完成（全部收齐）</li>
 *   <li>5 已取消</li>
 *   <li>6 部分退货</li>
 *   <li>7 已退货（全部退回）</li>
 * </ul>
 *
 * <p>状态由明细汇总自动推导，收货/退货时重算，不手工维护。
 */
@Data
@TableName("pms_purchase_order")
public class PurchaseOrder {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    /** 采购单号 */
    private String orderNo;

    private Long supplierId;

    /** 收货门店 */
    private Long storeId;

    private BigDecimal totalAmount;

    /** 订购总数量 */
    private BigDecimal totalOrderedQty;

    /** 已收总数量 */
    private BigDecimal totalReceivedQty;

    /** 已退总数量 */
    private BigDecimal totalReturnedQty;

    private Integer status;

    private Long operatorId;

    private Long reviewerId;

    private LocalDateTime reviewTime;

    private String reviewRemark;

    /** 完成时间（全部收齐） */
    private LocalDateTime finishTime;

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
