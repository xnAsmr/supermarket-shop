package com.supermarket.erp.module.purchase.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class PurchaseReturnVO {

    private Long id;

    private String returnNo;

    private Long orderId;

    private String orderNo;

    private Long receiptId;

    private String receiptNo;

    private Long supplierId;

    private String supplierName;

    private Long storeId;

    private String storeName;

    private BigDecimal totalAmount;

    private BigDecimal totalQuantity;

    private Integer status;

    private String operatorName;

    private String reviewerName;

    private LocalDateTime reviewTime;

    private String reviewRemark;

    private LocalDateTime returnTime;

    private String reason;

    private String remark;

    private LocalDateTime createTime;

    private List<PurchaseReturnItemVO> items;

    @Data
    public static class PurchaseReturnItemVO {

        private Long id;

        private Long productId;

        private String productName;

        private String barcode;

        private String spec;

        private String unit;

        /** 本次退货数量 */
        private BigDecimal quantity;

        private BigDecimal purchasePrice;

        private BigDecimal totalPrice;
    }
}
