package com.supermarket.erp.module.order.dto;

import lombok.Data;

/**
 * 收支流水（逐笔支付明细）查询条件。
 */
@Data
public class PaymentRecordQueryDTO {

    /** 当前页，默认 1 */
    private Integer page = 1;

    /** 每页条数，默认 20 */
    private Integer pageSize = 20;

    /** 开始日期 yyyy-MM-dd（含当天 00:00:00） */
    private String startDate;

    /** 结束日期 yyyy-MM-dd（含当天 23:59:59） */
    private String endDate;

    /** 收支类型：income 收入 / expense 支出 */
    private String type;

    /** 关联订单号（模糊匹配） */
    private String orderNo;

    /** 支付方式编码 */
    private String paymentMethod;
}
