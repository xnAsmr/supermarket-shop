package com.supermarket.erp.module.purchase.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 采购订单状态。
 */
@Getter
@AllArgsConstructor
public enum PurchaseOrderStatus {

    /** 草稿：明细可编辑 */
    DRAFT(0, "草稿"),
    /** 待审核 */
    PENDING_REVIEW(1, "待审核"),
    /** 已审核：可开始收货 */
    APPROVED(2, "已审核"),
    /** 部分收货 */
    PARTIALLY_RECEIVED(3, "部分收货"),
    /** 已完成：全部收齐 */
    COMPLETED(4, "已完成"),
    /** 已取消 */
    CANCELED(5, "已取消"),
    /** 部分退货 */
    PARTIALLY_RETURNED(6, "部分退货"),
    /** 已退货：全部退回 */
    RETURNED(7, "已退货");

    private final Integer code;
    private final String name;

    public static PurchaseOrderStatus getByCode(Integer code) {
        if (code == null) return null;
        for (PurchaseOrderStatus status : values()) {
            if (status.getCode().equals(code)) return status;
        }
        return null;
    }

    /** 是否处于可收货状态（已审核或部分收货） */
    public static boolean canReceive(Integer status) {
        return APPROVED.getCode().equals(status)
                || PARTIALLY_RECEIVED.getCode().equals(status)
                || PARTIALLY_RETURNED.getCode().equals(status);
    }

    /** 是否允许取消（未产生任何实物收发） */
    public static boolean canCancel(Integer status) {
        return DRAFT.getCode().equals(status)
                || PENDING_REVIEW.getCode().equals(status)
                || APPROVED.getCode().equals(status);
    }
}
