package com.supermarket.erp.module.purchase.service.support;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.module.purchase.entity.PurchaseOrder;
import com.supermarket.erp.module.purchase.entity.PurchaseOrderItem;
import com.supermarket.erp.module.purchase.enums.PurchaseOrderStatus;
import com.supermarket.erp.module.purchase.mapper.PurchaseOrderItemMapper;
import com.supermarket.erp.module.purchase.mapper.PurchaseOrderMapper;
import com.supermarket.erp.module.stock.entity.Stock;
import com.supermarket.erp.module.stock.entity.StockLog;
import com.supermarket.erp.module.stock.mapper.StockLogMapper;
import com.supermarket.erp.module.stock.mapper.StockMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * 采购业务公共支撑：状态重算、库存增减、数量不变量校验。
 *
 * <p>被采购订单 / 采购退货单两个服务共用，保证语义一致（收货单模块已退役）。
 */
@Component
@RequiredArgsConstructor
public class PurchaseOrderSupport {

    /** 库存日志类型：1-采购入库 */
    public static final int STOCK_LOG_PURCHASE_IN = 1;
    /** 库存日志类型：6-入库回退 */
    public static final int STOCK_LOG_PURCHASE_ROLLBACK = 6;

    private final PurchaseOrderMapper purchaseOrderMapper;
    private final PurchaseOrderItemMapper purchaseOrderItemMapper;
    private final StockMapper stockMapper;
    private final StockLogMapper stockLogMapper;

    /* ============================ 查询 ============================ */

    /** 按 ID 查采购订单（校验租户与未删除） */
    public PurchaseOrder requireOrder(Long id, Long tenantId) {
        PurchaseOrder order = purchaseOrderMapper.selectOne(
                new LambdaQueryWrapper<PurchaseOrder>()
                        .eq(PurchaseOrder::getId, id)
                        .eq(PurchaseOrder::getTenantId, tenantId)
                        .eq(PurchaseOrder::getDeleted, 0)
        );
        if (order == null) {
            throw new BusinessException(3201, "采购订单不存在或已删除");
        }
        return order;
    }

    /** 查采购订单明细 */
    public List<PurchaseOrderItem> listItems(Long orderId) {
        return purchaseOrderItemMapper.selectByOrderId(orderId);
    }

    /** 查单条采购订单明细 */
    public PurchaseOrderItem requireItem(Long orderItemId, Long orderId) {
        PurchaseOrderItem item = purchaseOrderItemMapper.selectOne(
                new LambdaQueryWrapper<PurchaseOrderItem>()
                        .eq(PurchaseOrderItem::getId, orderItemId)
                        .eq(PurchaseOrderItem::getOrderId, orderId)
                        .eq(PurchaseOrderItem::getDeleted, 0)
        );
        if (item == null) {
            throw new BusinessException(3202, "采购订单明细不存在");
        }
        return item;
    }

    /* ============================ 状态重算 ============================ */

    /**
     * 按明细汇总重算采购订单状态与三个总量，并落库。
     *
     * <p>规则：
     * <ul>
     *   <li>已取消 / 已完成（收齐后）/ 已退货（退完）保持不变</li>
     *   <li>已收 &gt; 0 且全部收齐 → 已完成</li>
     *   <li>已收 &gt; 0 部分 → 部分收货</li>
     *   <li>已退 &gt; 0 且全部退完 → 已退货</li>
     *   <li>已退 &gt; 0 部分 → 部分退货</li>
     *   <li>否则回到已审核</li>
     * </ul>
     */
    public void refreshOrderAggregate(PurchaseOrder order) {
        List<PurchaseOrderItem> items = listItems(order.getId());

        BigDecimal orderedQty = BigDecimal.ZERO;
        BigDecimal receivedQty = BigDecimal.ZERO;
        BigDecimal returnedQty = BigDecimal.ZERO;
        BigDecimal amount = BigDecimal.ZERO;
        for (PurchaseOrderItem item : items) {
            orderedQty = orderedQty.add(nz(item.getOrderedQty()));
            receivedQty = receivedQty.add(nz(item.getReceivedQty()));
            returnedQty = returnedQty.add(nz(item.getReturnedQty()));
            amount = amount.add(nz(item.getTotalPrice()));
        }

        order.setTotalOrderedQty(orderedQty);
        order.setTotalReceivedQty(receivedQty);
        order.setTotalReturnedQty(returnedQty);
        order.setTotalAmount(amount);

        Integer current = order.getStatus();
        // 已取消是终态，不参与重算
        if (PurchaseOrderStatus.CANCELED.getCode().equals(current)) {
            purchaseOrderMapper.updateById(order);
            return;
        }

        boolean allReceived = orderedQty.compareTo(BigDecimal.ZERO) > 0
                && receivedQty.compareTo(orderedQty) >= 0;
        boolean allReturned = receivedQty.compareTo(BigDecimal.ZERO) > 0
                && returnedQty.compareTo(receivedQty) >= 0;

        if (allReturned) {
            order.setStatus(PurchaseOrderStatus.RETURNED.getCode());
            order.setFinishTime(order.getFinishTime() != null ? order.getFinishTime() : now());
        } else if (returnedQty.compareTo(BigDecimal.ZERO) > 0) {
            order.setStatus(PurchaseOrderStatus.PARTIALLY_RETURNED.getCode());
        } else if (allReceived) {
            order.setStatus(PurchaseOrderStatus.COMPLETED.getCode());
            if (order.getFinishTime() == null) {
                order.setFinishTime(now());
            }
        } else if (receivedQty.compareTo(BigDecimal.ZERO) > 0) {
            order.setStatus(PurchaseOrderStatus.PARTIALLY_RECEIVED.getCode());
            order.setFinishTime(null);
        } else {
            // 尚无收货：保持在「已审核」，若原本是草稿/待审核则不动
            if (current == null
                    || PurchaseOrderStatus.APPROVED.getCode().equals(current)
                    || PurchaseOrderStatus.PARTIALLY_RECEIVED.getCode().equals(current)
                    || PurchaseOrderStatus.PARTIALLY_RETURNED.getCode().equals(current)) {
                order.setStatus(PurchaseOrderStatus.APPROVED.getCode());
            }
        }

        purchaseOrderMapper.updateById(order);
    }

    /* ============================ 数量校验 ============================ */

    /**
     * 校验本次收货量不超出可收数量。
     *
     * @param item       采购订单明细
     * @param thisQty    本次收货数量
     * @param receivedDelta 在途占用数量（收货单模块已退役，恒传 0）
     */
    public void validateReceiveQuantity(PurchaseOrderItem item, BigDecimal thisQty, BigDecimal receivedDelta) {
        BigDecimal ordered = nz(item.getOrderedQty());
        BigDecimal received = nz(item.getReceivedQty());
        BigDecimal remaining = ordered.subtract(received).subtract(nz(receivedDelta));
        if (remaining.compareTo(BigDecimal.ZERO) < 0) {
            remaining = BigDecimal.ZERO;
        }
        if (thisQty.compareTo(remaining) > 0) {
            throw new BusinessException(3203,
                    "商品「" + item.getProductName() + "」最多可收 " + remaining.stripTrailingZeros().toPlainString()
                            + item.getUnit());
        }
    }

    /**
     * 校验本次退货量不超出可退数量（已收未退）。
     */
    public void validateReturnQuantity(PurchaseOrderItem item, BigDecimal thisQty) {
        BigDecimal received = nz(item.getReceivedQty());
        BigDecimal returned = nz(item.getReturnedQty());
        BigDecimal remaining = received.subtract(returned);
        if (remaining.compareTo(BigDecimal.ZERO) < 0) {
            remaining = BigDecimal.ZERO;
        }
        if (thisQty.compareTo(remaining) > 0) {
            throw new BusinessException(3204,
                    "商品「" + item.getProductName() + "」最多可退 " + remaining.stripTrailingZeros().toPlainString()
                            + item.getUnit());
        }
    }

    /* ============================ 库存 ============================ */

    /**
     * 增加仓库库存（采购入库）。
     */
    public void increaseStock(Long tenantId, Long storeId, Long productId, BigDecimal quantity,
                              int logType, String relatedNo, Long relatedId, Long userId, String remark) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) return;
        Stock stock = stockMapper.selectByProduct(tenantId, storeId, productId);
        BigDecimal before;
        if (stock != null) {
            before = nz(stock.getWarehouseQuantity());
            BigDecimal after = before.add(quantity);
            stock.setWarehouseQuantity(after);
            // 移动加权平均成本
            if (stock.getAvgCost() != null && after.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal totalCost = stock.getAvgCost().multiply(before);
                // 新增成本由调用方通过 remark 传入无法表达，这里按原成本保持不变
                stock.setAvgCost(totalCost.divide(after, 2, RoundingMode.HALF_UP));
            }
            stockMapper.updateById(stock);
        } else {
            before = BigDecimal.ZERO;
            Stock newStock = new Stock();
            newStock.setTenantId(tenantId);
            newStock.setStoreId(storeId);
            newStock.setProductId(productId);
            newStock.setWarehouseQuantity(quantity);
            newStock.setShelfQuantity(BigDecimal.ZERO);
            newStock.setAvgCost(BigDecimal.ZERO);
            stockMapper.insert(newStock);
        }
        writeStockLog(tenantId, storeId, productId, logType, quantity, before, before.add(quantity),
                relatedNo, relatedId, userId, remark);
    }

    /**
     * 减少仓库库存（采购退货 / 入库回退）。
     */
    public void decreaseStock(Long tenantId, Long storeId, Long productId, BigDecimal quantity,
                              int logType, String relatedNo, Long relatedId, Long userId, String remark) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) return;
        Stock stock = stockMapper.selectByProduct(tenantId, storeId, productId);
        if (stock == null) {
            throw new BusinessException(3205, "库存记录不存在，无法回退（商品ID：" + productId + "）");
        }
        BigDecimal before = nz(stock.getWarehouseQuantity());
        if (before.compareTo(quantity) < 0) {
            throw new BusinessException(3205,
                    "仓库库存不足，无法回退（剩余 " + before.stripTrailingZeros().toPlainString() + "）");
        }
        BigDecimal after = before.subtract(quantity);
        stock.setWarehouseQuantity(after);
        stockMapper.updateById(stock);
        writeStockLog(tenantId, storeId, productId, logType, quantity, before, after,
                relatedNo, relatedId, userId, remark);
    }

    private void writeStockLog(Long tenantId, Long storeId, Long productId, int logType,
                               BigDecimal quantity, BigDecimal before, BigDecimal after,
                               String relatedNo, Long relatedId, Long userId, String remark) {
        StockLog stockLog = new StockLog();
        stockLog.setTenantId(tenantId);
        stockLog.setStoreId(storeId);
        stockLog.setProductId(productId);
        stockLog.setLogType(logType);
        stockLog.setQuantity(quantity);
        stockLog.setBeforeStock(before);
        stockLog.setAfterStock(after);
        stockLog.setRelatedNo(relatedNo);
        stockLog.setRelatedId(relatedId);
        stockLog.setOperatorId(userId);
        stockLog.setRemark(remark);
        stockLogMapper.insert(stockLog);
    }

    /* ============================ 工具 ============================ */

    public static BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    public static BigDecimal money(BigDecimal value) {
        return nz(value).setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal money(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
    }

    private static java.time.LocalDateTime now() {
        return java.time.LocalDateTime.now();
    }
}
