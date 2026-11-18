package com.supermarket.erp.module.purchase.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.module.auth.entity.User;
import com.supermarket.erp.module.auth.mapper.UserMapper;
import com.supermarket.erp.module.product.entity.Product;
import com.supermarket.erp.module.product.mapper.ProductMapper;
import com.supermarket.erp.module.purchase.dto.PurchaseReturnCreateDTO;
import com.supermarket.erp.module.purchase.dto.PurchaseReturnQueryDTO;
import com.supermarket.erp.module.purchase.entity.PurchaseOrder;
import com.supermarket.erp.module.purchase.entity.PurchaseOrderItem;
import com.supermarket.erp.module.purchase.entity.PurchaseReceipt;
import com.supermarket.erp.module.purchase.entity.PurchaseReceiptItem;
import com.supermarket.erp.module.purchase.entity.PurchaseReturn;
import com.supermarket.erp.module.purchase.entity.PurchaseReturnItem;
import com.supermarket.erp.module.purchase.enums.PurchaseDocStatus;
import com.supermarket.erp.module.purchase.mapper.PurchaseOrderItemMapper;
import com.supermarket.erp.module.purchase.mapper.PurchaseReceiptItemMapper;
import com.supermarket.erp.module.purchase.mapper.PurchaseReceiptMapper;
import com.supermarket.erp.module.purchase.mapper.PurchaseReturnItemMapper;
import com.supermarket.erp.module.purchase.mapper.PurchaseReturnMapper;
import com.supermarket.erp.module.purchase.service.IPurchaseReturnService;
import com.supermarket.erp.module.purchase.service.support.PurchaseOrderSupport;
import com.supermarket.erp.module.purchase.vo.PurchaseReturnVO;
import com.supermarket.erp.module.supplier.entity.Supplier;
import com.supermarket.erp.module.supplier.mapper.SupplierMapper;
import com.supermarket.erp.module.tenant.entity.Store;
import com.supermarket.erp.module.tenant.mapper.StoreMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PurchaseReturnServiceImpl implements IPurchaseReturnService {

    private static final DateTimeFormatter NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final AtomicLong SEQ = new AtomicLong(0);

    private final PurchaseReturnMapper returnMapper;
    private final PurchaseReturnItemMapper returnItemMapper;
    private final PurchaseReceiptMapper receiptMapper;
    private final PurchaseReceiptItemMapper receiptItemMapper;
    private final PurchaseOrderItemMapper orderItemMapper;
    private final PurchaseOrderSupport support;
    private final UserMapper userMapper;
    private final SupplierMapper supplierMapper;
    private final StoreMapper storeMapper;
    private final ProductMapper productMapper;

    @Override
    public PageResult<PurchaseReturnVO> pageList(PurchaseReturnQueryDTO query, Long tenantId) {
        LambdaQueryWrapper<PurchaseReturn> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PurchaseReturn::getTenantId, tenantId);
        wrapper.eq(PurchaseReturn::getDeleted, 0);

        String keyword = query.getKeyword() != null && !query.getKeyword().isEmpty()
                ? query.getKeyword().trim()
                : (query.getReturnNo() != null ? query.getReturnNo().trim() : null);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(PurchaseReturn::getReturnNo, keyword);
        }
        if (query.getOrderId() != null) {
            wrapper.eq(PurchaseReturn::getOrderId, query.getOrderId());
        }
        if (query.getOrderNo() != null && !query.getOrderNo().isEmpty()) {
            wrapper.like(PurchaseReturn::getOrderNo, query.getOrderNo().trim());
        }
        if (query.getReceiptId() != null) {
            wrapper.eq(PurchaseReturn::getReceiptId, query.getReceiptId());
        }
        if (query.getReceiptNo() != null && !query.getReceiptNo().isEmpty()) {
            wrapper.like(PurchaseReturn::getReceiptNo, query.getReceiptNo().trim());
        }
        if (query.getSupplierId() != null) {
            wrapper.eq(PurchaseReturn::getSupplierId, query.getSupplierId());
        }
        if (query.getStoreId() != null) {
            wrapper.eq(PurchaseReturn::getStoreId, query.getStoreId());
        }
        if (query.getStatus() != null) {
            wrapper.eq(PurchaseReturn::getStatus, query.getStatus());
        }
        if (query.getStartDate() != null) {
            wrapper.ge(PurchaseReturn::getCreateTime, query.getStartDate());
        }
        if (query.getEndDate() != null) {
            wrapper.le(PurchaseReturn::getCreateTime, query.getEndDate());
        }
        wrapper.orderByDesc(PurchaseReturn::getCreateTime);

        Page<PurchaseReturn> result = returnMapper.selectPage(
                new Page<>(query.getPage(), query.getPageSize()), wrapper);
        List<PurchaseReturnVO> list = result.getRecords().stream()
                .map(this::toVO)
                .collect(Collectors.toList());
        return PageResult.of(list, result.getTotal(), query.getPage(), query.getPageSize());
    }

    @Override
    public PurchaseReturnVO getById(Long id, Long tenantId) {
        return toVO(requireReturn(id, tenantId));
    }

    @Override
    @Transactional
    public Long create(PurchaseReturnCreateDTO dto, Long tenantId, Long userId) {
        PurchaseReturn purchaseReturn = new PurchaseReturn();
        purchaseReturn.setTenantId(tenantId);
        purchaseReturn.setReturnNo(generateNo());
        purchaseReturn.setStoreId(dto.getStoreId());
        purchaseReturn.setStatus(PurchaseDocStatus.DRAFT.getCode());
        purchaseReturn.setOperatorId(userId);
        purchaseReturn.setReason(dto.getReason());
        purchaseReturn.setRemark(dto.getRemark());

        // 来源采购订单 / 收货单
        PurchaseOrder order = null;
        PurchaseReceipt receipt = null;
        if (dto.getOrderId() != null) {
            order = support.requireOrder(dto.getOrderId(), tenantId);
            purchaseReturn.setOrderId(order.getId());
            purchaseReturn.setOrderNo(order.getOrderNo());
            purchaseReturn.setSupplierId(order.getSupplierId());
        }
        if (dto.getReceiptId() != null) {
            receipt = receiptMapper.selectOne(
                    new LambdaQueryWrapper<PurchaseReceipt>()
                            .eq(PurchaseReceipt::getId, dto.getReceiptId())
                            .eq(PurchaseReceipt::getTenantId, tenantId)
                            .eq(PurchaseReceipt::getDeleted, 0)
            );
            if (receipt == null) {
                throw new BusinessException(3201, "来源收货单不存在");
            }
            purchaseReturn.setReceiptId(receipt.getId());
            purchaseReturn.setReceiptNo(receipt.getReceiptNo());
            if (order == null && receipt.getOrderId() != null) {
                order = support.requireOrder(receipt.getOrderId(), tenantId);
                purchaseReturn.setOrderId(order.getId());
                purchaseReturn.setOrderNo(order.getOrderNo());
                purchaseReturn.setSupplierId(receipt.getSupplierId());
            }
        }
        returnMapper.insert(purchaseReturn);

        saveItems(purchaseReturn, dto.getItems(), order, receipt, tenantId);
        refreshReturnTotals(purchaseReturn);
        return purchaseReturn.getId();
    }

    @Override
    @Transactional
    public void update(Long id, PurchaseReturnCreateDTO dto, Long tenantId, Long userId) {
        PurchaseReturn purchaseReturn = requireReturn(id, tenantId);
        if (!PurchaseDocStatus.DRAFT.getCode().equals(purchaseReturn.getStatus())) {
            throw new BusinessException(3206, "只有草稿状态的退货单可以编辑");
        }
        PurchaseOrder order = purchaseReturn.getOrderId() != null
                ? support.requireOrder(purchaseReturn.getOrderId(), tenantId) : null;
        PurchaseReceipt receipt = purchaseReturn.getReceiptId() != null
                ? receiptMapper.selectById(purchaseReturn.getReceiptId()) : null;

        purchaseReturn.setStoreId(dto.getStoreId());
        purchaseReturn.setReason(dto.getReason());
        purchaseReturn.setRemark(dto.getRemark());
        purchaseReturn.setUpdateBy(userId);
        returnMapper.updateById(purchaseReturn);

        returnItemMapper.hardDeleteByReturnId(id);
        saveItems(purchaseReturn, dto.getItems(), order, receipt, tenantId);
        refreshReturnTotals(purchaseReturn);
    }

    @Override
    @Transactional
    public void delete(Long id, Long tenantId, Long userId) {
        PurchaseReturn purchaseReturn = requireReturn(id, tenantId);
        if (!PurchaseDocStatus.DRAFT.getCode().equals(purchaseReturn.getStatus())) {
            throw new BusinessException(3206, "只有草稿状态的退货单可以删除");
        }
        returnItemMapper.hardDeleteByReturnId(id);
        returnMapper.deleteById(id);
    }

    @Override
    public void submit(Long id, Long tenantId, Long userId) {
        PurchaseReturn purchaseReturn = requireReturn(id, tenantId);
        if (!PurchaseDocStatus.DRAFT.getCode().equals(purchaseReturn.getStatus())) {
            throw new BusinessException(3206, "只有草稿状态的退货单可以提交审核");
        }
        if (returnItemMapper.selectByReturnId(id).isEmpty()) {
            throw new BusinessException(3206, "退货单没有明细，无法提交审核");
        }
        purchaseReturn.setStatus(PurchaseDocStatus.PENDING_REVIEW.getCode());
        purchaseReturn.setUpdateBy(userId);
        returnMapper.updateById(purchaseReturn);
    }

    @Override
    public void review(Long id, Long tenantId, Long userId, String remark) {
        PurchaseReturn purchaseReturn = requireReturn(id, tenantId);
        if (!PurchaseDocStatus.PENDING_REVIEW.getCode().equals(purchaseReturn.getStatus())) {
            throw new BusinessException(3206, "只有待审核状态的退货单可以审核");
        }
        // 审核通过 → 已审核待退货（退货动作由 confirm 执行）
        purchaseReturn.setStatus(PurchaseDocStatus.REVIEWED.getCode());
        purchaseReturn.setReviewerId(userId);
        purchaseReturn.setReviewTime(LocalDateTime.now());
        purchaseReturn.setReviewRemark(remark);
        purchaseReturn.setUpdateBy(userId);
        returnMapper.updateById(purchaseReturn);
    }

    @Override
    @Transactional
    public void confirm(Long id, Long tenantId, Long userId) {
        PurchaseReturn purchaseReturn = requireReturn(id, tenantId);
        if (PurchaseDocStatus.EFFECTIVE.getCode().equals(purchaseReturn.getStatus())) {
            throw new BusinessException(3206, "该退货单已生效，请勿重复操作");
        }
        if (!PurchaseDocStatus.REVIEWED.getCode().equals(purchaseReturn.getStatus())) {
            throw new BusinessException(3206, "只有已审核的退货单可以确认退货");
        }
        PurchaseOrder order = purchaseReturn.getOrderId() != null
                ? support.requireOrder(purchaseReturn.getOrderId(), tenantId) : null;

        List<PurchaseReturnItem> items = returnItemMapper.selectByReturnId(id);
        if (items.isEmpty()) {
            throw new BusinessException(3206, "退货单没有明细，无法确认退货");
        }

        // 1. 减库存 + 回写采购明细已退数量
        for (PurchaseReturnItem item : items) {
            BigDecimal qty = PurchaseOrderSupport.nz(item.getQuantity());
            support.decreaseStock(tenantId, purchaseReturn.getStoreId(), item.getProductId(), qty,
                    PurchaseOrderSupport.STOCK_LOG_PURCHASE_ROLLBACK, purchaseReturn.getReturnNo(),
                    purchaseReturn.getId(), userId, "采购退货 " + purchaseReturn.getReturnNo());

            if (item.getOrderItemId() != null) {
                PurchaseOrderItem orderItem = orderItemMapper.selectOne(
                        new LambdaQueryWrapper<PurchaseOrderItem>()
                                .eq(PurchaseOrderItem::getId, item.getOrderItemId())
                                .eq(PurchaseOrderItem::getDeleted, 0)
                );
                if (orderItem != null) {
                    orderItem.setReturnedQty(
                            PurchaseOrderSupport.nz(orderItem.getReturnedQty()).add(qty));
                    orderItemMapper.updateById(orderItem);
                }
            }
        }

        // 2. 退货单生效
        purchaseReturn.setStatus(PurchaseDocStatus.EFFECTIVE.getCode());
        purchaseReturn.setReturnTime(LocalDateTime.now());
        purchaseReturn.setUpdateBy(userId);
        returnMapper.updateById(purchaseReturn);

        // 3. 重算采购订单状态
        support.refreshOrderAggregate(order);
    }

    @Override
    @Transactional
    public void cancel(Long id, Long tenantId, Long userId, String reason) {
        PurchaseReturn purchaseReturn = requireReturn(id, tenantId);
        if (PurchaseDocStatus.VOIDED.getCode().equals(purchaseReturn.getStatus())) {
            throw new BusinessException(3206, "该退货单已作废，请勿重复操作");
        }
        PurchaseOrder order = purchaseReturn.getOrderId() != null
                ? support.requireOrder(purchaseReturn.getOrderId(), tenantId) : null;

        // 已生效的作废需要恢复库存与已退数量
        boolean wasEffective = PurchaseDocStatus.EFFECTIVE.getCode().equals(purchaseReturn.getStatus());
        if (wasEffective) {
            for (PurchaseReturnItem item : returnItemMapper.selectByReturnId(id)) {
                BigDecimal qty = PurchaseOrderSupport.nz(item.getQuantity());
                support.increaseStock(tenantId, purchaseReturn.getStoreId(), item.getProductId(), qty,
                        PurchaseOrderSupport.STOCK_LOG_PURCHASE_IN, purchaseReturn.getReturnNo(),
                        purchaseReturn.getId(), userId, "作废退货单恢复库存 " + purchaseReturn.getReturnNo());

                if (item.getOrderItemId() != null) {
                    PurchaseOrderItem orderItem = orderItemMapper.selectOne(
                            new LambdaQueryWrapper<PurchaseOrderItem>()
                                    .eq(PurchaseOrderItem::getId, item.getOrderItemId())
                                    .eq(PurchaseOrderItem::getDeleted, 0)
                    );
                    if (orderItem != null) {
                        BigDecimal next = PurchaseOrderSupport.nz(orderItem.getReturnedQty()).subtract(qty);
                        orderItem.setReturnedQty(next.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : next);
                        orderItemMapper.updateById(orderItem);
                    }
                }
            }
        }

        purchaseReturn.setStatus(PurchaseDocStatus.VOIDED.getCode());
        purchaseReturn.setRemark(reason != null && !reason.isEmpty() ? reason : purchaseReturn.getRemark());
        purchaseReturn.setUpdateBy(userId);
        returnMapper.updateById(purchaseReturn);

        support.refreshOrderAggregate(order);
    }

    /* ============================ 内部 ============================ */

    private PurchaseReturn requireReturn(Long id, Long tenantId) {
        PurchaseReturn purchaseReturn = returnMapper.selectOne(
                new LambdaQueryWrapper<PurchaseReturn>()
                        .eq(PurchaseReturn::getId, id)
                        .eq(PurchaseReturn::getTenantId, tenantId)
                        .eq(PurchaseReturn::getDeleted, 0)
        );
        if (purchaseReturn == null) {
            throw new BusinessException(3201, "退货单不存在或已删除");
        }
        return purchaseReturn;
    }

    /** 保存退货明细并校验可退数量 */
    private void saveItems(PurchaseReturn purchaseReturn, List<PurchaseReturnCreateDTO.Item> items,
                            PurchaseOrder order, PurchaseReceipt receipt, Long tenantId) {
        if (items == null || items.isEmpty()) {
            throw new BusinessException(3206, "请至少添加一条退货明细");
        }
        for (PurchaseReturnCreateDTO.Item dto : items) {
            if (dto.getQuantity() == null || dto.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(3206, "退货数量必须大于 0");
            }

            String productName = "";
            String barcode = "";
            String spec = "";
            String unit = "";
            BigDecimal price = PurchaseOrderSupport.nz(dto.getPurchasePrice());
            Long orderItemId = dto.getOrderItemId();

            if (orderItemId != null && order != null) {
                PurchaseOrderItem orderItem = support.requireItem(orderItemId, order.getId());
                // 校验不超出可退数量（已收未退）
                support.validateReturnQuantity(orderItem, dto.getQuantity());
                productName = orderItem.getProductName();
                barcode = orderItem.getBarcode();
                spec = orderItem.getSpec();
                unit = orderItem.getUnit();
                if (dto.getPurchasePrice() == null) {
                    price = PurchaseOrderSupport.nz(orderItem.getPurchasePrice());
                }
            } else if (dto.getReceiptItemId() != null && receipt != null) {
                PurchaseReceiptItem receiptItem = receiptItemMapper.selectOne(
                        new LambdaQueryWrapper<PurchaseReceiptItem>()
                                .eq(PurchaseReceiptItem::getId, dto.getReceiptItemId())
                                .eq(PurchaseReceiptItem::getDeleted, 0)
                );
                if (receiptItem == null) {
                    throw new BusinessException(3202, "收货单明细不存在");
                }
                orderItemId = receiptItem.getOrderItemId();
                if (orderItemId != null && order != null) {
                    PurchaseOrderItem orderItem = support.requireItem(orderItemId, order.getId());
                    support.validateReturnQuantity(orderItem, dto.getQuantity());
                    productName = orderItem.getProductName();
                    barcode = orderItem.getBarcode();
                    spec = orderItem.getSpec();
                    unit = orderItem.getUnit();
                    if (dto.getPurchasePrice() == null) {
                        price = PurchaseOrderSupport.nz(orderItem.getPurchasePrice());
                    }
                } else {
                    productName = receiptItem.getProductName();
                    barcode = receiptItem.getBarcode();
                    spec = receiptItem.getSpec();
                    unit = receiptItem.getUnit();
                    if (dto.getPurchasePrice() == null) {
                        price = PurchaseOrderSupport.nz(receiptItem.getPurchasePrice());
                    }
                }
            } else {
                Product product = productMapper.selectById(dto.getProductId());
                if (product == null) {
                    throw new BusinessException(3206, "商品不存在（ID：" + dto.getProductId() + "）");
                }
                productName = product.getName();
                barcode = product.getBarcode();
                spec = product.getSpec();
                unit = product.getUnit();
            }

            PurchaseReturnItem item = new PurchaseReturnItem();
            item.setTenantId(tenantId);
            item.setReturnId(purchaseReturn.getId());
            item.setOrderId(order != null ? order.getId() : null);
            item.setOrderItemId(orderItemId);
            item.setReceiptId(receipt != null ? receipt.getId() : null);
            item.setReceiptItemId(dto.getReceiptItemId());
            item.setProductId(dto.getProductId());
            item.setProductName(productName);
            item.setBarcode(barcode);
            item.setSpec(spec);
            item.setUnit(unit);
            item.setQuantity(dto.getQuantity());
            item.setPurchasePrice(price);
            item.setTotalPrice(PurchaseOrderSupport.money(price.multiply(dto.getQuantity())));
            returnItemMapper.insert(item);
        }
    }

    /**
     * 按明细汇总重算退货单头的「退货数量 / 退货金额」并落库。
     */
    private void refreshReturnTotals(PurchaseReturn purchaseReturn) {
        List<PurchaseReturnItem> items = returnItemMapper.selectByReturnId(purchaseReturn.getId());
        BigDecimal totalQty = BigDecimal.ZERO;
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (PurchaseReturnItem item : items) {
            totalQty = totalQty.add(PurchaseOrderSupport.nz(item.getQuantity()));
            totalAmount = totalAmount.add(PurchaseOrderSupport.nz(item.getTotalPrice()));
        }
        purchaseReturn.setTotalQuantity(totalQty);
        purchaseReturn.setTotalAmount(PurchaseOrderSupport.money(totalAmount));
        returnMapper.updateById(purchaseReturn);
    }

    private PurchaseReturnVO toVO(PurchaseReturn purchaseReturn) {
        PurchaseReturnVO vo = new PurchaseReturnVO();
        BeanUtils.copyProperties(purchaseReturn, vo);

        if (purchaseReturn.getSupplierId() != null) {
            Supplier supplier = supplierMapper.selectById(purchaseReturn.getSupplierId());
            if (supplier != null) vo.setSupplierName(supplier.getName());
        }
        if (purchaseReturn.getStoreId() != null) {
            Store store = storeMapper.selectById(purchaseReturn.getStoreId());
            if (store != null) vo.setStoreName(store.getStoreName());
        }
        if (purchaseReturn.getOperatorId() != null) {
            User operator = userMapper.selectById(purchaseReturn.getOperatorId());
            if (operator != null) {
                vo.setOperatorName(operator.getName() != null ? operator.getName() : operator.getUsername());
            }
        }
        if (purchaseReturn.getReviewerId() != null) {
            User reviewer = userMapper.selectById(purchaseReturn.getReviewerId());
            if (reviewer != null) {
                vo.setReviewerName(reviewer.getName() != null ? reviewer.getName() : reviewer.getUsername());
            }
        }

        List<PurchaseReturnVO.PurchaseReturnItemVO> items = new ArrayList<>();
        for (PurchaseReturnItem item : returnItemMapper.selectByReturnId(purchaseReturn.getId())) {
            PurchaseReturnVO.PurchaseReturnItemVO itemVO = new PurchaseReturnVO.PurchaseReturnItemVO();
            BeanUtils.copyProperties(item, itemVO);
            items.add(itemVO);
        }
        vo.setItems(items);
        return vo;
    }

    /** 生成退货单号：TH + 时间戳 + 4 位序号 */
    private String generateNo() {
        return "TH" + LocalDateTime.now().format(NO_FORMAT)
                + String.format("%04d", SEQ.incrementAndGet() % 10000);
    }
}
