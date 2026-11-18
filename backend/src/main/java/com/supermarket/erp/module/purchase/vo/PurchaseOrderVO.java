package com.supermarket.erp.module.purchase.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class PurchaseOrderVO {

    private Long id;

    private String orderNo;

    private Long supplierId;

    private String supplierName;

    private Long storeId;

    private String storeName;

    private BigDecimal totalAmount;

    private BigDecimal totalOrderedQty;

    private BigDecimal totalReceivedQty;

    private BigDecimal totalReturnedQty;

    private Integer status;

    private String operatorName;

    private String reviewerName;

    private LocalDateTime reviewTime;

    private String reviewRemark;

    private LocalDateTime finishTime;

    private String remark;

    private LocalDateTime createTime;

    private List<PurchaseOrderItemVO> items;

    @Data
    public static class PurchaseOrderItemVO {

        private Long id;

        private Long productId;

        private String productName;

        private String barcode;

        private String spec;

        private String unit;

        /** 订购数量 */
        private BigDecimal orderedQty;

        /** 已收数量 */
        private BigDecimal receivedQty;

        /** 已退数量 */
        private BigDecimal returnedQty;

        private BigDecimal purchasePrice;

        private BigDecimal totalPrice;

        private String remark;
    }
}
