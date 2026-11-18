package com.supermarket.erp.module.purchase.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 采购退货单（红字：退给供应商）。
 *
 * <p>状态：0 草稿 / 1 待审核 / 2 已退货 / 3 已作废
 */
@Data
@TableName("pms_purchase_return")
public class PurchaseReturn {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    /** 退货单号 */
    private String returnNo;

    /** 来源采购订单ID */
    private Long orderId;

    /** 来源采购单号 */
    private String orderNo;

    /** 来源收货单ID（按收货单退货时记录） */
    private Long receiptId;

    /** 来源收货单号 */
    private String receiptNo;

    private Long supplierId;

    private Long storeId;

    private BigDecimal totalAmount;

    private BigDecimal totalQuantity;

    private Integer status;

    private Long operatorId;

    private Long reviewerId;

    private LocalDateTime reviewTime;

    private String reviewRemark;

    /** 退货生效时间 */
    private LocalDateTime returnTime;

    /** 退货原因 */
    private String reason;

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
