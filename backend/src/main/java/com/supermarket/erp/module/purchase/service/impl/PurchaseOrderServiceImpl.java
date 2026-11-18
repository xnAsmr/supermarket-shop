package com.supermarket.erp.module.purchase.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.module.auth.entity.User;
import com.supermarket.erp.module.auth.mapper.UserMapper;
import com.supermarket.erp.module.product.entity.Product;
import com.supermarket.erp.module.product.mapper.ProductMapper;
import com.supermarket.erp.module.notify.entity.NotifyEventLog;
import com.supermarket.erp.module.notify.service.INotifyEventService;
import com.supermarket.erp.module.purchase.dto.PurchaseOrderCreateDTO;
import com.supermarket.erp.module.purchase.dto.PurchaseOrderQueryDTO;
import com.supermarket.erp.module.purchase.dto.PurchaseReceiveDTO;
import com.supermarket.erp.module.purchase.entity.PurchaseOrder;
import com.supermarket.erp.module.purchase.entity.PurchaseOrderItem;
import com.supermarket.erp.module.purchase.enums.PurchaseOrderStatus;
import com.supermarket.erp.module.purchase.mapper.PurchaseOrderItemMapper;
import com.supermarket.erp.module.purchase.mapper.PurchaseOrderMapper;
import com.supermarket.erp.module.purchase.service.IPurchaseOrderService;
import com.supermarket.erp.module.purchase.service.support.PurchaseOrderSupport;
import com.supermarket.erp.module.purchase.vo.PurchaseOrderVO;
import com.supermarket.erp.module.stock.entity.PurchaseIn;
import com.supermarket.erp.module.stock.entity.PurchaseInItem;
import com.supermarket.erp.module.stock.mapper.PurchaseInItemMapper;
import com.supermarket.erp.module.stock.mapper.PurchaseInMapper;
import com.supermarket.erp.module.stock.service.IPurchaseInService;
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
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PurchaseOrderServiceImpl implements IPurchaseOrderService {

    private static final DateTimeFormatter NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final AtomicLong SEQ = new AtomicLong(0);

    private final PurchaseOrderMapper purchaseOrderMapper;
    private final PurchaseOrderItemMapper purchaseOrderItemMapper;
    private final PurchaseOrderSupport support;
    private final UserMapper userMapper;
    private final SupplierMapper supplierMapper;
    private final StoreMapper storeMapper;
    private final ProductMapper productMapper;
    private final PurchaseInMapper purchaseInMapper;
    private final PurchaseInItemMapper purchaseInItemMapper;
    private final IPurchaseInService purchaseInService;
    private final INotifyEventService notifyEventService;

    @Override
    public PageResult<PurchaseOrderVO> pageList(PurchaseOrderQueryDTO query, Long tenantId) {
        LambdaQueryWrapper<PurchaseOrder> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PurchaseOrder::getTenantId, tenantId);
        wrapper.eq(PurchaseOrder::getDeleted, 0);

        String keyword = query.getKeyword() != null && !query.getKeyword().isEmpty()
                ? query.getKeyword().trim()
                : (query.getOrderNo() != null ? query.getOrderNo().trim() : null);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(PurchaseOrder::getOrderNo, keyword);
        }
        if (query.getSupplierId() != null) {
            wrapper.eq(PurchaseOrder::getSupplierId, query.getSupplierId());
        }
        if (query.getStoreId() != null) {
            wrapper.eq(PurchaseOrder::getStoreId, query.getStoreId());
        }
        if (query.getStatus() != null) {
            wrapper.eq(PurchaseOrder::getStatus, query.getStatus());
        }
        if (query.getStartDate() != null) {
            wrapper.ge(PurchaseOrder::getCreateTime, query.getStartDate());
        }
        if (query.getEndDate() != null) {
            wrapper.le(PurchaseOrder::getCreateTime, query.getEndDate());
        }
        wrapper.orderByDesc(PurchaseOrder::getCreateTime);

        Page<PurchaseOrder> result = purchaseOrderMapper.selectPage(
                new Page<>(query.getPage(), query.getPageSize()), wrapper);
        List<PurchaseOrderVO> list = result.getRecords().stream()
                .map(this::toVO)
                .collect(Collectors.toList());
        return PageResult.of(list, result.getTotal(), query.getPage(), query.getPageSize());
    }

    @Override
    public PurchaseOrderVO getById(Long id, Long tenantId) {
        return toVO(support.requireOrder(id, tenantId));
    }

    @Override
    @Transactional
    public Long create(PurchaseOrderCreateDTO dto, Long tenantId, Long userId) {
        PurchaseOrder order = new PurchaseOrder();
        order.setTenantId(tenantId);
        order.setOrderNo(generateNo());
        order.setSupplierId(dto.getSupplierId());
        order.setStoreId(dto.getStoreId());
        order.setStatus(PurchaseOrderStatus.DRAFT.getCode());
        order.setOperatorId(userId);
        order.setRemark(dto.getRemark());
        purchaseOrderMapper.insert(order);

        saveItems(order, dto.getItems(), tenantId);
        support.refreshOrderAggregate(order);
        return order.getId();
    }

    @Override
    @Transactional
    public void update(Long id, PurchaseOrderCreateDTO dto, Long tenantId, Long userId) {
        PurchaseOrder order = support.requireOrder(id, tenantId);
        if (!PurchaseOrderStatus.DRAFT.getCode().equals(order.getStatus())) {
            throw new BusinessException(3206, "只有草稿状态的采购订单可以编辑");
        }
        order.setSupplierId(dto.getSupplierId());
        order.setStoreId(dto.getStoreId());
        order.setRemark(dto.getRemark());
        order.setUpdateBy(userId);
        purchaseOrderMapper.updateById(order);

        // 草稿可自由改明细：整体重建（草稿无物理收发，删除明细无副作用）
        purchaseOrderItemMapper.hardDeleteByOrderId(id);
        saveItems(order, dto.getItems(), tenantId);
        support.refreshOrderAggregate(order);
    }

    @Override
    @Transactional
    public void delete(Long id, Long tenantId, Long userId) {
        PurchaseOrder order = support.requireOrder(id, tenantId);
        if (!PurchaseOrderStatus.DRAFT.getCode().equals(order.getStatus())) {
            throw new BusinessException(3206, "只有草稿状态的采购订单可以删除");
        }
        purchaseOrderItemMapper.hardDeleteByOrderId(id);
        purchaseOrderMapper.deleteById(id);
    }

    @Override
    public void submit(Long id, Long tenantId, Long userId) {
        PurchaseOrder order = support.requireOrder(id, tenantId);
        if (!PurchaseOrderStatus.DRAFT.getCode().equals(order.getStatus())) {
            throw new BusinessException(3206, "只有草稿状态的采购订单可以提交审核");
        }
        if (support.listItems(id).isEmpty()) {
            throw new BusinessException(3206, "采购订单没有明细，无法提交审核");
        }
        order.setStatus(PurchaseOrderStatus.PENDING_REVIEW.getCode());
        order.setUpdateBy(userId);
        purchaseOrderMapper.updateById(order);

        // 事件提醒：通知租户管理员有采购单待审核（排除提交人自己）
        notifyEventService.publishToTenantAdmins(tenantId, order.getStoreId(), userId,
                NotifyEventLog.EVENT_PURCHASE_SUBMIT, "采购单待审核",
                "「" + displayName(userMapper.selectById(userId)) + "」提交了采购单 " + order.getOrderNo() + "，请及时审核",
                "PURCHASE_ORDER", id);
    }

    @Override
    public void review(Long id, Long tenantId, Long userId, String remark) {
        PurchaseOrder order = support.requireOrder(id, tenantId);
        if (!PurchaseOrderStatus.PENDING_REVIEW.getCode().equals(order.getStatus())) {
            throw new BusinessException(3206, "只有待审核状态的采购订单可以审核");
        }
        order.setStatus(PurchaseOrderStatus.APPROVED.getCode());
        order.setReviewerId(userId);
        order.setReviewTime(LocalDateTime.now());
        order.setReviewRemark(remark);
        order.setUpdateBy(userId);
        purchaseOrderMapper.updateById(order);

        // 事件提醒：通知提交人审核结果
        if (order.getCreateBy() != null) {
            notifyEventService.publishToUsers(tenantId, order.getStoreId(), List.of(order.getCreateBy()),
                    NotifyEventLog.EVENT_PURCHASE_APPROVED, "采购单审核通过",
                    "您提交的采购单 " + order.getOrderNo() + " 已审核通过",
                    "PURCHASE_ORDER", id);
        }
    }

    @Override
    public void revokeReview(Long id, Long tenantId, Long userId) {
        PurchaseOrder order = support.requireOrder(id, tenantId);
        if (!PurchaseOrderStatus.PENDING_REVIEW.getCode().equals(order.getStatus())) {
            throw new BusinessException(3206, "只有待审核状态的采购订单可以撤销审核");
        }
        order.setStatus(PurchaseOrderStatus.DRAFT.getCode());
        order.setReviewerId(null);
        order.setReviewTime(null);
        order.setReviewRemark(null);
        order.setUpdateBy(userId);
        purchaseOrderMapper.updateById(order);

        // 事件提醒：通知提交人审核已撤销（订单回到草稿）
        if (order.getCreateBy() != null) {
            notifyEventService.publishToUsers(tenantId, order.getStoreId(), List.of(order.getCreateBy()),
                    NotifyEventLog.EVENT_PURCHASE_REVIEW_REVOKED, "采购单审核已撤销",
                    "您提交的采购单 " + order.getOrderNo() + " 的审核已被撤销，订单回到草稿状态",
                    "PURCHASE_ORDER", id);
        }
    }

    @Override
    public void cancel(Long id, Long tenantId, Long userId, String reason) {
        PurchaseOrder order = support.requireOrder(id, tenantId);
        if (!PurchaseOrderStatus.canCancel(order.getStatus())) {
            throw new BusinessException(3206, "已产生收货的采购订单不能取消，已收货物请通过采购退货处理");
        }
        order.setStatus(PurchaseOrderStatus.CANCELED.getCode());
        order.setRemark(reason != null && !reason.isEmpty() ? reason : order.getRemark());
        order.setUpdateBy(userId);
        purchaseOrderMapper.updateById(order);
    }

    @Override
    public List<PurchaseOrderVO.PurchaseOrderItemVO> receivableItems(Long id, Long tenantId) {
        PurchaseOrder order = support.requireOrder(id, tenantId);
        if (!PurchaseOrderStatus.canReceive(order.getStatus())) {
            throw new BusinessException(3206, "当前状态不能收货");
        }
        return support.listItems(id).stream()
                .filter(item -> PurchaseOrderSupport.nz(item.getOrderedQty())
                        .subtract(PurchaseOrderSupport.nz(item.getReceivedQty()))
                        .compareTo(BigDecimal.ZERO) > 0)
                .map(this::toItemVO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public Long receive(Long id, PurchaseReceiveDTO dto, Long tenantId, Long userId) {
        PurchaseOrder order = support.requireOrder(id, tenantId);
        if (!PurchaseOrderStatus.canReceive(order.getStatus())) {
            throw new BusinessException(3206, "当前状态不能收货");
        }

        // 1. 过滤并校验本次收货数量（不超出可收数量 = 订购 - 已收）
        List<PurchaseReceiveDTO.Item> receiveItems = dto.getItems().stream()
                .filter(it -> it.getQuantity() != null && it.getQuantity() > 0)
                .collect(Collectors.toList());
        if (receiveItems.isEmpty()) {
            throw new BusinessException(3206, "请至少填写一行收货数量");
        }
        List<PurchaseOrderItem> orderItems = new ArrayList<>();
        for (PurchaseReceiveDTO.Item receiveItem : receiveItems) {
            PurchaseOrderItem orderItem = support.requireItem(receiveItem.getOrderItemId(), order.getId());
            support.validateReceiveQuantity(orderItem, BigDecimal.valueOf(receiveItem.getQuantity()),
                    BigDecimal.ZERO);
            orderItems.add(orderItem);
        }

        // 2. 生成采购入库单（来源 = 采购订单）
        PurchaseIn purchaseIn = new PurchaseIn();
        purchaseIn.setTenantId(tenantId);
        purchaseIn.setInNo("PI" + System.currentTimeMillis());
        purchaseIn.setSupplierId(order.getSupplierId());
        purchaseIn.setStoreId(order.getStoreId());
        purchaseIn.setSourceOrderId(order.getId());
        purchaseIn.setSourceOrderNo(order.getOrderNo());
        purchaseIn.setStatus(0);
        purchaseIn.setOperatorId(userId);
        purchaseInMapper.insert(purchaseIn);

        int totalQuantity = 0;
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (int i = 0; i < receiveItems.size(); i++) {
            PurchaseReceiveDTO.Item receiveItem = receiveItems.get(i);
            PurchaseOrderItem orderItem = orderItems.get(i);

            PurchaseInItem inItem = new PurchaseInItem();
            inItem.setInId(purchaseIn.getId());
            inItem.setProductId(orderItem.getProductId());
            inItem.setQuantity(receiveItem.getQuantity());
            BigDecimal price = PurchaseOrderSupport.nz(orderItem.getPurchasePrice());
            inItem.setPurchasePrice(price);
            inItem.setTotalPrice(PurchaseOrderSupport.money(
                    price.multiply(BigDecimal.valueOf(receiveItem.getQuantity()))));
            inItem.setBatchNo(receiveItem.getBatchNo());
            purchaseInItemMapper.insert(inItem);

            totalQuantity += receiveItem.getQuantity();
            totalAmount = totalAmount.add(inItem.getTotalPrice());
        }
        purchaseIn.setTotalQuantity(totalQuantity);
        purchaseIn.setTotalAmount(totalAmount);
        purchaseInMapper.updateById(purchaseIn);

        // 3. 审核 + 入库（复用入库单状态机：加库存、更新移动加权成本、写库存日志）
        purchaseInService.review(purchaseIn.getId(), tenantId, userId);
        purchaseInService.stockIn(purchaseIn.getId(), tenantId, userId);

        // 4. 回写已收数量并重算采购订单状态（部分收货 / 已完成）
        for (int i = 0; i < receiveItems.size(); i++) {
            PurchaseOrderItem orderItem = orderItems.get(i);
            orderItem.setReceivedQty(PurchaseOrderSupport.nz(orderItem.getReceivedQty())
                    .add(BigDecimal.valueOf(receiveItems.get(i).getQuantity())));
            purchaseOrderItemMapper.updateById(orderItem);
        }
        support.refreshOrderAggregate(order);
        return purchaseIn.getId();
    }

    @Override
    public List<PurchaseOrderVO.PurchaseOrderItemVO> returnableItems(Long id, Long tenantId) {
        support.requireOrder(id, tenantId);
        return support.listItems(id).stream()
                .filter(item -> PurchaseOrderSupport.nz(item.getReceivedQty())
                        .subtract(PurchaseOrderSupport.nz(item.getReturnedQty()))
                        .compareTo(BigDecimal.ZERO) > 0)
                .map(this::toItemVO)
                .collect(Collectors.toList());
    }

    /* ============================ 内部 ============================ */

    /** 保存明细并计算小计 */
    private void saveItems(PurchaseOrder order, List<PurchaseOrderCreateDTO.Item> items, Long tenantId) {
        if (items == null || items.isEmpty()) {
            throw new BusinessException(3206, "请至少添加一条采购明细");
        }
        for (PurchaseOrderCreateDTO.Item dto : items) {
            if (dto.getOrderedQty() == null || dto.getOrderedQty().compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(3206, "订购数量必须大于 0");
            }
            Product product = productMapper.selectById(dto.getProductId());
            if (product == null) {
                throw new BusinessException(3206, "商品不存在（ID：" + dto.getProductId() + "）");
            }
            PurchaseOrderItem item = new PurchaseOrderItem();
            item.setTenantId(tenantId);
            item.setOrderId(order.getId());
            item.setProductId(dto.getProductId());
            item.setProductName(product.getName());
            item.setBarcode(product.getBarcode());
            item.setSpec(product.getSpec());
            item.setUnit(product.getUnit());
            item.setOrderedQty(dto.getOrderedQty());
            item.setReceivedQty(BigDecimal.ZERO);
            item.setReturnedQty(BigDecimal.ZERO);
            BigDecimal price = PurchaseOrderSupport.nz(dto.getPurchasePrice());
            item.setPurchasePrice(price);
            item.setTotalPrice(PurchaseOrderSupport.money(price.multiply(dto.getOrderedQty())));
            item.setRemark(dto.getRemark());
            purchaseOrderItemMapper.insert(item);
        }
    }

    private PurchaseOrderVO toVO(PurchaseOrder order) {
        PurchaseOrderVO vo = new PurchaseOrderVO();
        BeanUtils.copyProperties(order, vo);

        if (order.getSupplierId() != null) {
            Supplier supplier = supplierMapper.selectById(order.getSupplierId());
            if (supplier != null) vo.setSupplierName(supplier.getName());
        }
        if (order.getStoreId() != null) {
            Store store = storeMapper.selectById(order.getStoreId());
            if (store != null) vo.setStoreName(store.getStoreName());
        }
        if (order.getOperatorId() != null) {
            User operator = userMapper.selectById(order.getOperatorId());
            if (operator != null) {
                vo.setOperatorName(operator.getName() != null ? operator.getName() : operator.getUsername());
            }
        }
        if (order.getReviewerId() != null) {
            User reviewer = userMapper.selectById(order.getReviewerId());
            if (reviewer != null) {
                vo.setReviewerName(reviewer.getName() != null ? reviewer.getName() : reviewer.getUsername());
            }
        }

        List<PurchaseOrderVO.PurchaseOrderItemVO> items = new ArrayList<>();
        for (PurchaseOrderItem item : support.listItems(order.getId())) {
            items.add(toItemVO(item));
        }
        vo.setItems(items);
        return vo;
    }

    private PurchaseOrderVO.PurchaseOrderItemVO toItemVO(PurchaseOrderItem item) {
        PurchaseOrderVO.PurchaseOrderItemVO vo = new PurchaseOrderVO.PurchaseOrderItemVO();
        BeanUtils.copyProperties(item, vo);
        return vo;
    }

    /** 生成采购单号：PO + 时间戳 + 4 位序号 */
    private String generateNo() {
        return "PO" + LocalDateTime.now().format(NO_FORMAT)
                + String.format("%04d", SEQ.incrementAndGet() % 10000);
    }

    /** 用户显示名（name 优先，兜底 username，用户不存在返回空串） */
    private String displayName(User user) {
        if (user == null) {
            return "";
        }
        return user.getName() != null && !user.getName().isEmpty() ? user.getName() : user.getUsername();
    }
}
