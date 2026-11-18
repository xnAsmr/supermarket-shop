package com.supermarket.erp.module.stock.vo;

import lombok.Data;

import java.math.BigDecimal;

/**
 * 库存视图。
 *
 * <p>三层库存：
 * <ul>
 *   <li>{@code pendingInQuantity} 在途：已下采购单未收货</li>
 *   <li>{@code warehouseQuantity} 仓库：收货后进仓，上架/调拨/报损减少</li>
 *   <li>{@code shelfQuantity} 货架：上架增加，POS 销售扣减 —— 收银台可售库存</li>
 * </ul>
 *
 * <p>库存预警按货架库存判定，阈值支持「商品级默认 + 门店级覆盖」。
 */
@Data
public class StockVO {

    private Long id;

    private Long tenantId;

    private Long storeId;

    private String storeName;

    private Long productId;

    private String productName;

    private String barcode;

    private String unit;

    /** 仓库库存 */
    private BigDecimal warehouseQuantity;

    /** 货架库存（可售） */
    private BigDecimal shelfQuantity;

    /** 在途库存（已下单未收货） */
    private BigDecimal pendingInQuantity;

    /** 待出库数量 */
    private BigDecimal pendingOutQuantity;

    /** 仓库 + 货架 */
    private BigDecimal totalQuantity;

    private BigDecimal avgCost;

    /** 商品当前进价（pms_product.purchase_price） */
    private BigDecimal purchasePrice;

    /** 生效预警线（门店覆盖优先） */
    private BigDecimal warnThreshold;

    /** 生效紧急线（门店覆盖优先） */
    private BigDecimal urgentThreshold;

    /** 预警线是否来自门店覆盖 */
    private Boolean thresholdOverridden;

    /**
     * 库存状态：
     * <ul>
     *   <li>{@code normal} 正常</li>
     *   <li>{@code warning} 预警（货架 ≤ 预警线）</li>
     *   <li>{@code urgent} 紧急（货架 ≤ 紧急线）</li>
     *   <li>{@code out_of_stock} 缺货（货架 = 0）</li>
     * </ul>
     */
    private String stockStatus;

    /**
     * 补货方式（仅预警状态有值）：
     * <ul>
     *   <li>{@code shelf_up} 仓库有货，可直接上架</li>
     *   <li>{@code in_transit} 仓库无货但在途有货，等收货</li>
     *   <li>{@code purchase} 仓库与在途都没有，需采购</li>
     * </ul>
     */
    private String replenishType;
}
