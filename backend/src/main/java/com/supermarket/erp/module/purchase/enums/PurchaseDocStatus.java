package com.supermarket.erp.module.purchase.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 采购退货单状态（原与收货单共用；收货单模块已退役，本枚举现仅退货单使用）。
 *
 * <p>退货单：草稿 → 待审核 → 已审核待退货 → 已退货；未退货可作废
 */
@Getter
@AllArgsConstructor
public enum PurchaseDocStatus {

    /** 草稿：明细可编辑 */
    DRAFT(0, "草稿"),
    /** 待审核 */
    PENDING_REVIEW(1, "待审核"),
    /** 已审核（待入库 / 待退货） */
    REVIEWED(2, "已审核"),
    /** 已生效（收货单=已入库，退货单=已退货） */
    EFFECTIVE(3, "已生效"),
    /** 已作废 */
    VOIDED(4, "已作废");

    private final Integer code;
    private final String name;

    public static PurchaseDocStatus getByCode(Integer code) {
        if (code == null) return null;
        for (PurchaseDocStatus status : values()) {
            if (status.getCode().equals(code)) return status;
        }
        return null;
    }
}
