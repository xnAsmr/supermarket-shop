package com.supermarket.erp.module.order.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 退款（退货）单主表。
 *
 * <p>状态取值：
 * <ul>
 *   <li>0 - 待处理</li>
 *   <li>1 - 已完成（已退款，库存已回补）</li>
 *   <li>2 - 已驳回</li>
 *   <li>3 - 已作废（相当于“取消退货单”，可恢复原订单）</li>
 * </ul>
 */
@Data
@TableName("oms_refund")
public class Refund {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long storeId;

    private String refundNo;

    private Long orderId;

    private String orderNo;

    /** 退款金额 */
    private BigDecimal refundAmount;

    /** 退款方式：1-现金 2-原路退回 */
    private Integer refundMethod;

    private String refundReason;

    /** 状态：0-待处理 1-已完成 2-已驳回 3-已作废 */
    private Integer status;

    private Long operatorId;

    private LocalDateTime refundTime;

    private String remark;

    /** 作废时间 */
    private LocalDateTime cancelTime;

    /** 作废操作人 */
    private Long cancelledBy;

    /** 退款时实际冲减的会员累计消费（作废时按此精确回加） */
    private BigDecimal revertConsume;

    /** 退款时实际冲减的会员积分（作废时按此精确回加） */
    private Integer revertPoints;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /** 逻辑删除标志：0-未删除 1-已删除 */
    @TableLogic
    private Integer deleted;
}
