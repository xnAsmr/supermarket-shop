package com.supermarket.erp.module.purchase.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 采购收货单（物理事实：实际到了什么）。
 *
 * <p>已退役：收货流程改为「采购订单收货入库」直接生成 wms_purchase_in。
 * 本实体与数据表仅用于历史收货单数据只读保留（及其关联的退货记录），不再提供接口。
 *
 * <p>一张采购订单可对应多张收货单（分批到货）。
 *
 * <p>状态：0 草稿 / 1 待审核 / 2 已入库 / 3 已作废
 */
@Data
@TableName("wms_purchase_receipt")
public class PurchaseReceipt {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    /** 收货单号 */
    private String receiptNo;

    /** 来源采购订单ID（手工收货为空） */
    private Long orderId;

    /** 来源采购单号（快照） */
    private String orderNo;

    private Long supplierId;

    /** 收货门店 */
    private Long storeId;

    /** 本次收货金额 */
    private BigDecimal totalAmount;

    /** 本次收货总数量 */
    private BigDecimal totalQuantity;

    private Integer status;

    private Long operatorId;

    private Long reviewerId;

    private LocalDateTime reviewTime;

    private String reviewRemark;

    private Long stockInUserId;

    private LocalDateTime stockInTime;

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
