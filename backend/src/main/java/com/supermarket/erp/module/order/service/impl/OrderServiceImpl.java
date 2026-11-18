package com.supermarket.erp.module.order.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.module.auth.entity.User;
import com.supermarket.erp.module.auth.mapper.UserMapper;
import com.supermarket.erp.module.member.entity.Member;
import com.supermarket.erp.module.member.mapper.MemberMapper;
import com.supermarket.erp.module.order.dto.OrderQueryDTO;
import com.supermarket.erp.module.order.dto.RefundCreateDTO;
import com.supermarket.erp.module.order.dto.RefundQueryDTO;
import com.supermarket.erp.module.order.entity.Order;
import com.supermarket.erp.module.order.entity.OrderItem;
import com.supermarket.erp.module.order.entity.OrderPayment;
import com.supermarket.erp.module.order.entity.Refund;
import com.supermarket.erp.module.order.entity.RefundItem;
import com.supermarket.erp.module.order.mapper.OrderItemMapper;
import com.supermarket.erp.module.order.mapper.OrderMapper;
import com.supermarket.erp.module.order.mapper.OrderPaymentMapper;
import com.supermarket.erp.module.order.mapper.RefundItemMapper;
import com.supermarket.erp.module.order.mapper.RefundMapper;
import com.supermarket.erp.module.order.service.IOrderService;
import com.supermarket.erp.module.order.vo.OrderItemVO;
import com.supermarket.erp.module.order.vo.OrderVO;
import com.supermarket.erp.module.order.vo.RefundItemVO;
import com.supermarket.erp.module.order.vo.RefundVO;
import com.supermarket.erp.module.stock.entity.Stock;
import com.supermarket.erp.module.stock.entity.StockLog;
import com.supermarket.erp.module.stock.mapper.StockLogMapper;
import com.supermarket.erp.module.stock.mapper.StockMapper;
import com.supermarket.erp.module.system.entity.PaymentMethod;
import com.supermarket.erp.module.system.mapper.PaymentMethodMapper;
import com.supermarket.erp.module.tenant.entity.Store;
import com.supermarket.erp.module.tenant.mapper.StoreMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderServiceImpl implements IOrderService {

    /** 订单状态：0-待支付 1-已支付 2-已完成 3-已取消 4-已退款 */
    private static final int STATUS_PENDING = 0;
    private static final int STATUS_PAID = 1;
    private static final int STATUS_COMPLETED = 2;
    private static final int STATUS_CANCELLED = 3;
    private static final int STATUS_REFUNDED = 4;

    /** 支付状态：0-未支付 1-已支付 2-部分退款 3-全额退款 */
    private static final int PAY_STATUS_UNPAID = 0;
    private static final int PAY_STATUS_PAID = 1;
    private static final int PAY_STATUS_PARTIAL_REFUND = 2;
    private static final int PAY_STATUS_FULL_REFUND = 3;

    /** 退货单状态：0-待处理 1-已完成 2-已驳回 3-已作废 */
    private static final int REFUND_STATUS_COMPLETED = 1;
    private static final int REFUND_STATUS_CANCELLED = 3;

    /** 退款方式：1-现金 2-原路退回 */
    private static final int REFUND_METHOD_CASH = 1;
    private static final int REFUND_METHOD_ORIGINAL = 2;

    /** 会员储值卡支付账户编码 */
    private static final String PAY_METHOD_STORED = "stored";

    /** 现金支付账户编码 */
    private static final String PAY_METHOD_CASH = "cash";

    /** 库存日志类型：4-销售出库 6-退货入库回退 7-取消回退 8-恢复扣减 */
    private static final int STOCK_LOG_SALE = 4;
    private static final int STOCK_LOG_REFUND_BACK = 6;
    private static final int STOCK_LOG_CANCEL_BACK = 7;
    private static final int STOCK_LOG_RESTORE_DEDUCT = 8;

    /**
     * 支付记录类型：1-原始收款 2-退款冲减 3-取消冲减 4-恢复冲增。
     * 取消/恢复只按「原始收款」回滚，调整记录不参与，避免重复冲减。
     */
    private static final int PAYMENT_RECORD_ORIGINAL = 1;
    private static final int PAYMENT_RECORD_REFUND = 2;
    private static final int PAYMENT_RECORD_CANCEL = 3;
    private static final int PAYMENT_RECORD_RESTORE = 4;

    private final OrderMapper orderMapper;
    private final OrderItemMapper orderItemMapper;
    private final OrderPaymentMapper orderPaymentMapper;
    private final RefundMapper refundMapper;
    private final RefundItemMapper refundItemMapper;
    private final UserMapper userMapper;
    private final MemberMapper memberMapper;
    private final PaymentMethodMapper paymentMethodMapper;
    private final StoreMapper storeMapper;
    private final StockMapper stockMapper;
    private final StockLogMapper stockLogMapper;

    /* ============================ 查询 ============================ */

    @Override
    public OrderVO getById(Long id, Long tenantId) {
        Order order = orderMapper.selectOne(
                new LambdaQueryWrapper<Order>()
                        .eq(Order::getId, id)
                        .eq(Order::getTenantId, tenantId)
                        .eq(Order::getDeleted, 0)
        );
        if (order == null) {
            throw new BusinessException(4001, "订单不存在或已删除");
        }

        OrderVO vo = new OrderVO();
        BeanUtils.copyProperties(order, vo);
        vo.setStoreName(resolveStoreName(order.getStoreId(), tenantId));

        if (order.getPayMethod() != null) {
            PaymentMethod pm = paymentMethodMapper.selectOne(
                    new LambdaQueryWrapper<PaymentMethod>()
                            .eq(PaymentMethod::getCode, order.getPayMethod())
                            .eq(PaymentMethod::getTenantId, tenantId)
                            .eq(PaymentMethod::getDeleted, 0)
            );
            if (pm != null) {
                vo.setPayMethodName(pm.getName());
            }
        }

        if (order.getOperatorId() != null) {
            User user = userMapper.selectOne(
                    new LambdaQueryWrapper<User>()
                            .eq(User::getId, order.getOperatorId())
                            .eq(User::getDeleted, 0)
            );
            if (user != null) {
                vo.setCashierName(user.getName() != null ? user.getName() : user.getUsername());
            }
        }

        List<OrderItem> items = orderItemMapper.selectByOrderId(id);
        List<OrderItemVO> itemVOs = items.stream().map(this::toItemVO).collect(Collectors.toList());
        vo.setItems(itemVOs);

        return vo;
    }

    private OrderItemVO toItemVO(OrderItem item) {
        OrderItemVO itemVO = new OrderItemVO();
        BeanUtils.copyProperties(item, itemVO);
        BigDecimal salePrice = (item.getDiscountPrice() != null && item.getDiscountPrice().compareTo(BigDecimal.ZERO) > 0)
                ? item.getDiscountPrice() : item.getSalePrice();
        BigDecimal costPrice = item.getCostAmount() != null ? item.getCostAmount() : BigDecimal.ZERO;
        itemVO.setProfitAmount(salePrice.subtract(costPrice).multiply(new BigDecimal(item.getQuantity())));
        return itemVO;
    }

    @Override
    public PageResult<OrderVO> pageList(OrderQueryDTO query, Long tenantId) {
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Order::getTenantId, tenantId);
        wrapper.eq(Order::getDeleted, 0);

        if (query.getKeyword() != null && !query.getKeyword().isEmpty()) {
            wrapper.like(Order::getOrderNo, query.getKeyword());
        }
        if (query.getOrderStatus() != null) {
            wrapper.eq(Order::getOrderStatus, query.getOrderStatus());
        } else if (query.getOrderStatuses() != null && !query.getOrderStatuses().isEmpty()) {
            wrapper.in(Order::getOrderStatus, query.getOrderStatuses());
        }
        if (query.getPayStatus() != null) {
            wrapper.eq(Order::getPayStatus, query.getPayStatus());
        }
        if (query.getOperatorId() != null) {
            wrapper.eq(Order::getOperatorId, query.getOperatorId());
        }
        if (query.getStartDate() != null) {
            wrapper.ge(Order::getCreateTime, query.getStartDate());
        }
        if (query.getEndDate() != null) {
            wrapper.le(Order::getCreateTime, query.getEndDate());
        }

        wrapper.orderByDesc(Order::getCreateTime);

        Page<Order> page = new Page<>(query.getPage(), query.getPageSize());
        Page<Order> result = orderMapper.selectPage(page, wrapper);

        List<OrderVO> voList = result.getRecords().stream().map(order -> {
            OrderVO vo = new OrderVO();
            BeanUtils.copyProperties(order, vo);
            vo.setStoreName(resolveStoreName(order.getStoreId(), tenantId));

            if (order.getOperatorId() != null) {
                User cashier = userMapper.selectById(order.getOperatorId());
                if (cashier != null) {
                    vo.setCashierName(cashier.getName() != null ? cashier.getName() : cashier.getUsername());
                }
            }

            if (order.getPayMethod() != null && !order.getPayMethod().isEmpty()) {
                PaymentMethod pm = paymentMethodMapper.selectOne(
                        new LambdaQueryWrapper<PaymentMethod>()
                                .eq(PaymentMethod::getTenantId, tenantId)
                                .eq(PaymentMethod::getCode, order.getPayMethod())
                );
                if (pm != null) {
                    vo.setPayMethodName(pm.getName());
                }
                if ("combined".equals(order.getPayMethod())) {
                    vo.setPayMethodName("组合支付");
                }
            }

            if (order.getMemberId() != null) {
                Member member = memberMapper.selectById(order.getMemberId());
                if (member != null) {
                    vo.setMemberName(member.getName());
                }
            }

            List<OrderItem> items = orderItemMapper.selectByOrderId(order.getId());
            List<OrderItemVO> itemVOs = items.stream().map(this::toItemVO).collect(Collectors.toList());
            vo.setItems(itemVOs);
            return vo;
        }).collect(Collectors.toList());

        return PageResult.of(voList, result.getTotal(), query.getPage(), query.getPageSize());
    }

    /* ============================ 取消 / 恢复 ============================ */

    @Override
    @Transactional
    public void cancel(Long id, Long tenantId, Long userId, String reason) {
        Order order = getOrder(id, tenantId);
        int status = order.getOrderStatus() != null ? order.getOrderStatus() : STATUS_PENDING;

        if (status == STATUS_CANCELLED) {
            throw new BusinessException(4002, "该订单已取消，请勿重复操作");
        }
        if (status == STATUS_REFUNDED) {
            throw new BusinessException(4002, "该订单已退款，无法取消");
        }

        List<OrderItem> items = orderItemMapper.selectByOrderId(id);
        List<OrderPayment> payments = listPayments(id);

        // 已退款订单的数据已在退款时回滚，取消只改状态，避免二次回滚
        if (status != STATUS_REFUNDED) {
            // 1. 回补货架库存
            for (OrderItem item : items) {
                restoreStock(order, item.getProductId(), toQuantity(item.getQuantity()), STOCK_LOG_CANCEL_BACK,
                        "取消订单回补库存", userId, id);
            }
            // 2. 回退支付账户与会员储值余额
            revertPayments(order, payments, -1, userId, "取消订单冲减");
            // 3. 回退会员累计消费与积分
            revertMemberConsume(order, -1);
        }

        order.setOrderStatus(STATUS_CANCELLED);
        order.setCancelReason(reason);
        order.setCancelTime(LocalDateTime.now());
        order.setRestoreTime(null);
        order.setUpdateBy(userId);
        orderMapper.updateById(order);
    }

    @Override
    @Transactional
    public void restore(Long id, Long tenantId, Long userId) {
        Order order = getOrder(id, tenantId);
        if (order.getOrderStatus() == null || order.getOrderStatus() != STATUS_CANCELLED) {
            throw new BusinessException(4002, "只有已取消的订单才能恢复");
        }
        // 已退款后被取消的订单：数据未回滚过，恢复时同样不重复扣减
        if (order.getPayStatus() != null && order.getPayStatus() == PAY_STATUS_FULL_REFUND) {
            order.setOrderStatus(STATUS_REFUNDED);
            order.setRestoreTime(LocalDateTime.now());
            order.setUpdateBy(userId);
            orderMapper.updateById(order);
            return;
        }

        List<OrderItem> items = orderItemMapper.selectByOrderId(id);
        List<OrderPayment> payments = listPayments(id);

        // 1. 重新扣减货架库存
        for (OrderItem item : items) {
            deductStock(order, item.getProductId(), toQuantity(item.getQuantity()), STOCK_LOG_RESTORE_DEDUCT,
                    "恢复订单扣减库存", userId, id);
        }
        // 2. 恢复支付账户与会员储值余额
        revertPayments(order, payments, 1, userId, "恢复订单冲增");
        // 3. 恢复会员累计消费与积分
        revertMemberConsume(order, 1);

        // 恢复原状态：已完成的订单回到已完成，其余回到已支付
        order.setOrderStatus(order.getCompleteTime() != null ? STATUS_COMPLETED : STATUS_PAID);
        order.setPayStatus(PAY_STATUS_PAID);
        order.setCancelReason(null);
        order.setCancelTime(null);
        order.setRestoreTime(LocalDateTime.now());
        order.setUpdateBy(userId);
        orderMapper.updateById(order);
    }

    @Override
    @Transactional
    public void complete(Long id, Long tenantId, Long userId) {
        Order order = getOrder(id, tenantId);
        if (order.getOrderStatus() == null || order.getOrderStatus() != STATUS_PAID) {
            throw new BusinessException(4002, "只有已支付订单才能完成");
        }

        order.setOrderStatus(STATUS_COMPLETED);
        order.setCompleteTime(LocalDateTime.now());
        order.setUpdateBy(userId);
        orderMapper.updateById(order);
    }

    /* ============================ 删除 ============================ */

    @Override
    @Transactional
    public void delete(Long id, Long tenantId, Long userId) {
        Order order = getOrder(id, tenantId);
        int status = order.getOrderStatus() != null ? order.getOrderStatus() : STATUS_PENDING;

        if (status != STATUS_CANCELLED) {
            throw new BusinessException(4002, "只有已取消的订单才能删除，请先取消订单");
        }

        // 关联数据一并清理，避免残留孤儿记录
        refundItemMapper.hardDeleteByOrderId(id);
        refundMapper.hardDeleteByOrderId(id);
        orderItemMapper.hardDeleteByOrderId(id);
        orderPaymentMapper.hardDeleteByOrderId(id);
        // 彻底删除：物理删除记录本身（区别于 cancel 的逻辑取消，可恢复）
        orderMapper.hardDelete(order.getId(), tenantId);
    }

    @Override
    public void updateRemark(Long id, Long tenantId, String remark, Long userId) {
        Order order = getOrder(id, tenantId);
        order.setRemark(remark);
        order.setUpdateBy(userId);
        orderMapper.updateById(order);
    }

    @Override
    public List<OrderItem> getOrderItems(Long orderId) {
        return orderItemMapper.selectByOrderId(orderId);
    }

    /* ============================ 整单退款（兼容） ============================ */

    @Override
    @Transactional
    public void refund(Long id, Long tenantId, Long userId) {
        Order order = getOrder(id, tenantId);
        int status = order.getOrderStatus() != null ? order.getOrderStatus() : STATUS_PENDING;
        if (status != STATUS_PAID && status != STATUS_COMPLETED) {
            throw new BusinessException(4002, "只有已支付或已完成订单才能退款");
        }

        List<OrderItem> items = orderItemMapper.selectByOrderId(id);
        List<OrderPayment> payments = listPayments(id);

        for (OrderItem item : items) {
            restoreStock(order, item.getProductId(), toQuantity(item.getQuantity()), STOCK_LOG_REFUND_BACK,
                    "订单退款回补库存", userId, id);
        }
        revertPayments(order, payments, -1, userId, "订单退款冲减");
        revertMemberConsume(order, -1);

        order.setOrderStatus(STATUS_REFUNDED);
        order.setPayStatus(PAY_STATUS_FULL_REFUND);
        order.setUpdateBy(userId);
        orderMapper.updateById(order);
    }

    /* ============================ 退货退款 ============================ */

    @Override
    @Transactional
    public RefundVO createRefund(RefundCreateDTO dto, Long tenantId, Long userId) {
        Order order = getOrder(dto.getOrderId(), tenantId);
        int status = order.getOrderStatus() != null ? order.getOrderStatus() : STATUS_PENDING;
        if (status == STATUS_CANCELLED) {
            throw new BusinessException(4002, "该订单已取消，无法退货");
        }
        if (status == STATUS_REFUNDED) {
            throw new BusinessException(4002, "该订单已全额退款，无法继续退货");
        }

        List<OrderItem> orderItems = orderItemMapper.selectByOrderId(order.getId());
        Map<Long, OrderItem> itemMap = orderItems.stream()
                .collect(Collectors.toMap(OrderItem::getProductId, i -> i, (a, b) -> a));

        // 1. 校验退货明细并计算可退数量
        List<RefundItem> refundItems = new ArrayList<>();
        BigDecimal refundAmount = BigDecimal.ZERO;
        for (RefundCreateDTO.Item sel : dto.getItems()) {
            if (sel.getQuantity() == null || sel.getQuantity().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            OrderItem origin = itemMap.get(sel.getProductId());
            if (origin == null) {
                throw new BusinessException(4003, "退货商品不在该订单中");
            }
            BigDecimal quantity = origin.getQuantity() != null ? new BigDecimal(origin.getQuantity()) : BigDecimal.ZERO;
            BigDecimal refunded = origin.getRefundedQty() != null ? origin.getRefundedQty() : BigDecimal.ZERO;
            BigDecimal refundable = quantity.subtract(refunded);
            if (sel.getQuantity().compareTo(refundable) > 0) {
                throw new BusinessException(4003,
                        "商品「" + origin.getProductName() + "」最多可退 " + refundable.stripTrailingZeros().toPlainString() + origin.getUnit());
            }
            // 成交价优先用折后价，与订单金额口径一致
            BigDecimal price = (origin.getDiscountPrice() != null && origin.getDiscountPrice().compareTo(BigDecimal.ZERO) > 0)
                    ? origin.getDiscountPrice() : origin.getSalePrice();
            BigDecimal amount = price.multiply(sel.getQuantity()).setScale(2, RoundingMode.HALF_UP);

            RefundItem ri = new RefundItem();
            ri.setTenantId(tenantId);
            ri.setStoreId(order.getStoreId());
            ri.setOrderId(order.getId());
            ri.setProductId(origin.getProductId());
            ri.setProductName(origin.getProductName());
            ri.setBarcode(origin.getBarcode());
            ri.setSpec(origin.getSpec());
            ri.setUnit(origin.getUnit());
            ri.setQuantity(sel.getQuantity());
            ri.setSalePrice(price);
            ri.setTotalPrice(amount);
            refundItems.add(ri);
            refundAmount = refundAmount.add(amount);
        }

        if (refundItems.isEmpty()) {
            throw new BusinessException(4003, "请选择要退货的商品及数量");
        }
        if (refundAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(4003, "退款金额必须大于 0");
        }

        // 退款金额按「实收」口径计算：整单有优惠时，退货只退实际支付过的部分，
        // 否则退款金额会大于该订单实收金额，导致支付账户被多扣。
        BigDecimal orderTotal = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal orderPaid = order.getPayAmount() != null ? order.getPayAmount() : BigDecimal.ZERO;
        BigDecimal paidRefundAmount = refundAmount;
        if (orderTotal.compareTo(BigDecimal.ZERO) > 0
                && orderPaid.compareTo(refundAmount) < 0) {
            paidRefundAmount = refundAmount.multiply(orderPaid)
                    .divide(orderTotal, 2, RoundingMode.HALF_UP);
        }
        if (paidRefundAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(4003, "退款金额必须大于 0");
        }
        // 累计退款不得超过该订单实收金额
        BigDecimal alreadyRefunded = refundMapper.selectList(
                new LambdaQueryWrapper<Refund>()
                        .eq(Refund::getOrderId, order.getId())
                        .eq(Refund::getDeleted, 0)
                        .eq(Refund::getStatus, REFUND_STATUS_COMPLETED)
        ).stream().map(Refund::getRefundAmount).filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal refundableLeft = orderPaid.subtract(alreadyRefunded);
        if (paidRefundAmount.compareTo(refundableLeft) > 0) {
            paidRefundAmount = refundableLeft.max(BigDecimal.ZERO);
        }
        if (paidRefundAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(4003, "该订单可退金额已用完，无法继续退货");
        }

        // 2. 生成退货单
        Refund refund = new Refund();
        refund.setTenantId(tenantId);
        refund.setStoreId(order.getStoreId());
        refund.setRefundNo(generateRefundNo());
        refund.setOrderId(order.getId());
        refund.setOrderNo(order.getOrderNo());
        refund.setRefundAmount(paidRefundAmount);
        refund.setRefundMethod(dto.getRefundMethod() != null ? dto.getRefundMethod() : REFUND_METHOD_CASH);
        refund.setRefundReason(dto.getRefundReason());
        refund.setStatus(REFUND_STATUS_COMPLETED);
        refund.setOperatorId(userId);
        refund.setRefundTime(LocalDateTime.now());
        refund.setRemark("订单 " + order.getOrderNo() + " 退货");
        refundMapper.insert(refund);

        for (RefundItem ri : refundItems) {
            ri.setRefundId(refund.getId());
            refundItemMapper.insert(ri);
        }

        // 3. 回补库存
        for (RefundItem ri : refundItems) {
            restoreStock(order, ri.getProductId(), ri.getQuantity(), STOCK_LOG_REFUND_BACK,
                    "退货入库 " + refund.getRefundNo(), userId, order.getId());
        }

        // 4. 冲减支付账户与会员数据
        List<OrderPayment> payments = listPayments(order.getId());
        applyRefundPayments(order, payments, paidRefundAmount,
                refund.getRefundMethod() == null ? REFUND_METHOD_CASH : refund.getRefundMethod(),
                userId, refund.getRefundNo());

        // 5. 更新订单明细已退数量与订单状态
        boolean allRefunded = true;
        for (OrderItem orderItem : orderItems) {
            BigDecimal refunded = orderItem.getRefundedQty() != null ? orderItem.getRefundedQty() : BigDecimal.ZERO;
            for (RefundItem ri : refundItems) {
                if (ri.getProductId().equals(orderItem.getProductId())) {
                    refunded = refunded.add(ri.getQuantity());
                }
            }
            orderItem.setRefundedQty(refunded);
            orderItemMapper.updateById(orderItem);
            BigDecimal quantity = orderItem.getQuantity() != null ? new BigDecimal(orderItem.getQuantity()) : BigDecimal.ZERO;
            if (refunded.compareTo(quantity) < 0) {
                allRefunded = false;
            }
        }

        if (allRefunded) {
            order.setOrderStatus(STATUS_REFUNDED);
            order.setPayStatus(PAY_STATUS_FULL_REFUND);
        } else {
            order.setPayStatus(PAY_STATUS_PARTIAL_REFUND);
        }
        order.setUpdateBy(userId);
        orderMapper.updateById(order);

        // 6. 会员累计消费与积分按实收退款金额冲减（受下限保护，记录实际冲减量供作废时回加）
        if (order.getMemberId() != null) {
            Member member = memberMapper.selectById(order.getMemberId());
            if (member != null) {
                BigDecimal totalConsume = member.getTotalConsume() != null ? member.getTotalConsume() : BigDecimal.ZERO;
                int totalPoints = member.getTotalPoints() != null ? member.getTotalPoints() : 0;
                BigDecimal nextConsume = totalConsume.subtract(paidRefundAmount).max(BigDecimal.ZERO);
                int nextPoints = Math.max(0, totalPoints - paidRefundAmount.intValue());
                refund.setRevertConsume(totalConsume.subtract(nextConsume));
                refund.setRevertPoints(totalPoints - nextPoints);
                memberMapper.update(null, new LambdaUpdateWrapper<Member>()
                        .eq(Member::getId, member.getId())
                        .set(Member::getTotalConsume, nextConsume)
                        .set(Member::getTotalPoints, nextPoints)
                );
                refundMapper.updateById(refund);
            }
        }

        return toRefundVO(refund);
    }

    @Override
    public PageResult<RefundVO> pageRefunds(RefundQueryDTO query, Long tenantId) {
        LambdaQueryWrapper<Refund> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Refund::getTenantId, tenantId);
        if (query.getRefundNo() != null && !query.getRefundNo().isEmpty()) {
            wrapper.like(Refund::getRefundNo, query.getRefundNo());
        }
        if (query.getOrderNo() != null && !query.getOrderNo().isEmpty()) {
            wrapper.like(Refund::getOrderNo, query.getOrderNo());
        }
        if (query.getStatus() != null) {
            wrapper.eq(Refund::getStatus, query.getStatus());
        }
        if (query.getStartDate() != null) {
            wrapper.ge(Refund::getCreateTime, query.getStartDate());
        }
        if (query.getEndDate() != null) {
            wrapper.le(Refund::getCreateTime, query.getEndDate());
        }
        wrapper.orderByDesc(Refund::getCreateTime);

        Page<Refund> page = new Page<>(query.getPage(), query.getPageSize());
        Page<Refund> result = refundMapper.selectPage(page, wrapper);
        List<RefundVO> list = result.getRecords().stream().map(this::toRefundVO).collect(Collectors.toList());
        return PageResult.of(list, result.getTotal(), query.getPage(), query.getPageSize());
    }

    @Override
    public RefundVO getRefund(Long id, Long tenantId) {
        Refund refund = refundMapper.selectOne(
                new LambdaQueryWrapper<Refund>()
                        .eq(Refund::getId, id)
                        .eq(Refund::getTenantId, tenantId)
                        .eq(Refund::getDeleted, 0)
        );
        if (refund == null) {
            throw new BusinessException(4001, "退货单不存在或已删除");
        }
        return toRefundVO(refund);
    }

    @Override
    @Transactional
    public void cancelRefund(Long id, Long tenantId, Long userId) {
        Refund refund = refundMapper.selectOne(
                new LambdaQueryWrapper<Refund>()
                        .eq(Refund::getId, id)
                        .eq(Refund::getTenantId, tenantId)
                        .eq(Refund::getDeleted, 0)
        );
        if (refund == null) {
            throw new BusinessException(4001, "退货单不存在或已删除");
        }
        if (refund.getStatus() == null || refund.getStatus() != REFUND_STATUS_COMPLETED) {
            throw new BusinessException(4002, "只有已完成的退货单才能作废");
        }

        Order order = getOrder(refund.getOrderId(), tenantId);
        List<RefundItem> refundItems = refundItemMapper.selectByRefundId(refund.getId());
        List<OrderItem> orderItems = orderItemMapper.selectByOrderId(order.getId());

        // 1. 回退库存（把退货补回的数量再扣掉）
        for (RefundItem ri : refundItems) {
            deductStock(order, ri.getProductId(), ri.getQuantity(), STOCK_LOG_RESTORE_DEDUCT,
                    "作废退货单扣回库存 " + refund.getRefundNo(), userId, order.getId());
        }

        // 2. 回退支付账户与会员储值余额
        List<OrderPayment> payments = listPayments(order.getId());
        applyRefundReversal(order, payments, refund.getRefundAmount(),
                refund.getRefundMethod() == null ? REFUND_METHOD_CASH : refund.getRefundMethod(),
                userId, refund.getRefundNo());

        // 3. 恢复订单明细已退数量与订单状态
        for (OrderItem orderItem : orderItems) {
            BigDecimal refunded = orderItem.getRefundedQty() != null ? orderItem.getRefundedQty() : BigDecimal.ZERO;
            for (RefundItem ri : refundItems) {
                if (ri.getProductId().equals(orderItem.getProductId())) {
                    refunded = refunded.subtract(ri.getQuantity()).max(BigDecimal.ZERO);
                }
            }
            orderItem.setRefundedQty(refunded);
            orderItemMapper.updateById(orderItem);
        }

        boolean anyRefunded = orderItems.stream().anyMatch(it -> {
            BigDecimal refunded = it.getRefundedQty() != null ? it.getRefundedQty() : BigDecimal.ZERO;
            return refunded.compareTo(BigDecimal.ZERO) > 0;
        });
        if (anyRefunded) {
            order.setPayStatus(PAY_STATUS_PARTIAL_REFUND);
        } else {
            order.setPayStatus(PAY_STATUS_PAID);
        }
        if (order.getOrderStatus() != null && order.getOrderStatus() == STATUS_REFUNDED) {
            order.setOrderStatus(order.getCompleteTime() != null ? STATUS_COMPLETED : STATUS_PAID);
        }
        order.setUpdateBy(userId);
        orderMapper.updateById(order);

        // 4. 恢复会员累计消费与积分（按退款时实际冲减的量精确回加）
        if (order.getMemberId() != null) {
            Member member = memberMapper.selectById(order.getMemberId());
            if (member != null) {
                BigDecimal totalConsume = member.getTotalConsume() != null ? member.getTotalConsume() : BigDecimal.ZERO;
                int totalPoints = member.getTotalPoints() != null ? member.getTotalPoints() : 0;
                BigDecimal appliedConsume = refund.getRevertConsume() != null
                        ? refund.getRevertConsume() : refund.getRefundAmount();
                int appliedPoints = refund.getRevertPoints() != null
                        ? refund.getRevertPoints() : refund.getRefundAmount().intValue();
                memberMapper.update(null, new LambdaUpdateWrapper<Member>()
                        .eq(Member::getId, member.getId())
                        .set(Member::getTotalConsume, totalConsume.add(appliedConsume))
                        .set(Member::getTotalPoints, totalPoints + appliedPoints)
                );
            }
        }

        // 5. 作废退货单
        refund.setStatus(REFUND_STATUS_CANCELLED);
        refund.setCancelTime(LocalDateTime.now());
        refund.setCancelledBy(userId);
        refund.setUpdateTime(LocalDateTime.now());
        refundMapper.updateById(refund);
    }

    /* ============================ 内部工具 ============================ */

    /**
     * 门店 ID → 门店名称（查不到时返回空串，不影响订单主流程）。
     */
    private String resolveStoreName(Long storeId, Long tenantId) {
        if (storeId == null) return "";
        Store store = storeMapper.selectById(storeId);
        if (store == null) return "";
        return store.getStoreName() != null ? store.getStoreName() : "";
    }

    private Order getOrder(Long id, Long tenantId) {
        Order order = orderMapper.selectOne(
                new LambdaQueryWrapper<Order>()
                        .eq(Order::getId, id)
                        .eq(Order::getTenantId, tenantId)
                        .eq(Order::getDeleted, 0)
        );
        if (order == null) {
            throw new BusinessException(4001, "订单不存在或已删除");
        }
        return order;
    }

    /**
     * 订单明细数量（Integer）→ BigDecimal。
     */
    private BigDecimal toQuantity(Integer quantity) {
        return quantity == null ? BigDecimal.ZERO : new BigDecimal(quantity);
    }

    /**
     * 取订单的「原始收款记录」。
     *
     * <p>取消/恢复只按原始收款回滚：调整记录（退款冲减/取消冲减/恢复冲增）
     * 由 record_type 标记，不参与回滚计算，否则会出现重复冲减导致余额错乱。
     */
    private List<OrderPayment> listPayments(Long orderId) {
        return orderPaymentMapper.selectList(
                new LambdaQueryWrapper<OrderPayment>()
                        .eq(OrderPayment::getOrderId, orderId)
                        .eq(OrderPayment::getDeleted, 0)
                        .eq(OrderPayment::getRecordType, PAYMENT_RECORD_ORIGINAL)
                        .gt(OrderPayment::getAmount, BigDecimal.ZERO)
        );
    }

    /**
     * 回补库存（取消订单 / 退货退款共用）。
     */
    private void restoreStock(Order order, Long productId, BigDecimal quantity, int logType,
                              String remark, Long userId, Long relatedId) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) return;
        Stock stock = stockMapper.selectByProduct(order.getTenantId(), order.getStoreId(), productId);
        if (stock == null) {
            throw new BusinessException("库存记录不存在: " + productId);
        }
        BigDecimal before = stock.getShelfQuantity() != null ? stock.getShelfQuantity() : BigDecimal.ZERO;
        stockMapper.restoreStock(productId, order.getStoreId(), quantity);

        StockLog stockLog = new StockLog();
        stockLog.setTenantId(order.getTenantId());
        stockLog.setStoreId(order.getStoreId());
        stockLog.setProductId(productId);
        stockLog.setLogType(logType);
        stockLog.setQuantity(quantity);
        stockLog.setBeforeStock(before);
        stockLog.setAfterStock(before.add(quantity));
        stockLog.setRelatedId(relatedId);
        stockLog.setOperatorId(userId);
        stockLog.setRemark(remark);
        stockLogMapper.insert(stockLog);
    }

    /**
     * 扣减库存（恢复订单 / 作废退货单共用）。
     */
    private void deductStock(Order order, Long productId, BigDecimal quantity, int logType,
                             String remark, Long userId, Long relatedId) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) return;
        Stock stock = stockMapper.selectByProduct(order.getTenantId(), order.getStoreId(), productId);
        if (stock == null) {
            throw new BusinessException("库存记录不存在: " + productId);
        }
        BigDecimal before = stock.getShelfQuantity() != null ? stock.getShelfQuantity() : BigDecimal.ZERO;
        if (before.compareTo(quantity) < 0) {
            throw new BusinessException("库存不足，无法回退（剩余 " + before.toPlainString() + "）");
        }
        int rows = stockMapper.deductStock(productId, order.getStoreId(), quantity);
        if (rows == 0) {
            throw new BusinessException("库存扣减失败，库存不足: " + productId);
        }

        StockLog stockLog = new StockLog();
        stockLog.setTenantId(order.getTenantId());
        stockLog.setStoreId(order.getStoreId());
        stockLog.setProductId(productId);
        stockLog.setLogType(logType);
        stockLog.setQuantity(quantity);
        stockLog.setBeforeStock(before);
        stockLog.setAfterStock(before.subtract(quantity));
        stockLog.setRelatedId(relatedId);
        stockLog.setOperatorId(userId);
        stockLog.setRemark(remark);
        stockLogMapper.insert(stockLog);
    }

    /**
     * 回退支付账户金额与会员储值余额。
     *
     * @param sign -1 表示冲减（取消/退款），1 表示冲增（恢复）
     */
    private void revertPayments(Order order, List<OrderPayment> payments, int sign, Long userId, String remark) {
        for (OrderPayment op : payments) {
            BigDecimal amount = op.getAmount() != null ? op.getAmount() : BigDecimal.ZERO;
            if (amount.compareTo(BigDecimal.ZERO) <= 0) continue;

            if (PAY_METHOD_STORED.equals(op.getPaymentMethod())) {
                // 储值卡：退回到会员余额
                if (order.getMemberId() != null) {
                    Member member = memberMapper.selectById(order.getMemberId());
                    if (member != null) {
                        BigDecimal balance = member.getBalance() != null ? member.getBalance() : BigDecimal.ZERO;
                        BigDecimal next = sign < 0 ? balance.add(amount) : balance.subtract(amount);
                        if (next.compareTo(BigDecimal.ZERO) < 0) {
                            throw new BusinessException("会员储值卡余额不足，无法回退");
                        }
                        memberMapper.update(null, new LambdaUpdateWrapper<Member>()
                                .eq(Member::getId, member.getId())
                                .set(Member::getBalance, next)
                        );
                    }
                }
            } else {
                // 其他支付方式：调整支付账户余额
                PaymentMethod pm = paymentMethodMapper.selectOne(
                        new LambdaQueryWrapper<PaymentMethod>()
                                .eq(PaymentMethod::getTenantId, order.getTenantId())
                                .eq(PaymentMethod::getCode, op.getPaymentMethod())
                                .eq(PaymentMethod::getDeleted, 0)
                );
                if (pm != null) {
                    BigDecimal balance = pm.getBalance() != null ? pm.getBalance() : BigDecimal.ZERO;
                    // 冲减不得为负：差额由 cancel 记录的原始收款回收，保证恢复后可精确回加
                    BigDecimal next = sign < 0 ? balance.subtract(amount) : balance.add(amount);
                    if (next.compareTo(BigDecimal.ZERO) < 0) {
                        throw new BusinessException("支付账户「" + op.getPaymentMethod() + "」余额不足，无法回退");
                    }
                    pm.setBalance(next);
                    paymentMethodMapper.updateById(pm);
                }
            }

            // 写入冲增/冲减流水，保证财务报表口径正确
            int recordType = sign < 0 ? PAYMENT_RECORD_CANCEL : PAYMENT_RECORD_RESTORE;
            insertPaymentRecord(order, op.getPaymentMethod(), amount.multiply(BigDecimal.valueOf(sign)),
                    userId, remark, null, recordType);
        }
    }

    /**
     * 回退会员累计消费与积分。
     *
     * <p>取消（sign=-1）时记录「实际冲减的量」到订单的 revertConsume/revertPoints，
     * 恢复（sign=1）时按该记录精确回加，保证「取消 → 恢复」后数据与取消前完全一致。
     * 若直接按订单金额回加，余额被下限截断时会导致恢复后数值偏大。
     *
     * @param sign -1 冲减，1 冲增
     */
    private void revertMemberConsume(Order order, int sign) {
        if (order.getMemberId() == null || order.getPayAmount() == null) return;
        Member member = memberMapper.selectById(order.getMemberId());
        if (member == null) return;
        BigDecimal totalConsume = member.getTotalConsume() != null ? member.getTotalConsume() : BigDecimal.ZERO;
        int totalPoints = member.getTotalPoints() != null ? member.getTotalPoints() : 0;

        if (sign < 0) {
            // 冲减：受下限保护，记录实际冲减量供恢复时回加
            BigDecimal nextConsume = totalConsume.subtract(order.getPayAmount()).max(BigDecimal.ZERO);
            int nextPoints = Math.max(0, totalPoints - order.getPayAmount().intValue());
            BigDecimal appliedConsume = totalConsume.subtract(nextConsume);
            int appliedPoints = totalPoints - nextPoints;
            order.setRevertConsume(appliedConsume);
            order.setRevertPoints(appliedPoints);
            memberMapper.update(null, new LambdaUpdateWrapper<Member>()
                    .eq(Member::getId, member.getId())
                    .set(Member::getTotalConsume, nextConsume)
                    .set(Member::getTotalPoints, nextPoints)
            );
        } else {
            // 回加：按取消时实际冲减的量精确回加
            BigDecimal appliedConsume = order.getRevertConsume() != null
                    ? order.getRevertConsume() : order.getPayAmount();
            int appliedPoints = order.getRevertPoints() != null
                    ? order.getRevertPoints() : order.getPayAmount().intValue();
            memberMapper.update(null, new LambdaUpdateWrapper<Member>()
                    .eq(Member::getId, member.getId())
                    .set(Member::getTotalConsume, totalConsume.add(appliedConsume))
                    .set(Member::getTotalPoints, totalPoints + appliedPoints)
            );
            order.setRevertConsume(null);
            order.setRevertPoints(null);
        }
    }

    /**
     * 退款时冲减支付账户与会员储值余额。
     *
     * <p>储值卡支付的部分必须退回会员余额；其余部分按退款方式处理：
     * 原路退回按原支付方式比例冲减，现金退款统一从现金账户支出。
     */
    private void applyRefundPayments(Order order, List<OrderPayment> payments, BigDecimal refundAmount,
                                     Integer refundMethod, Long userId, String refundNo) {
        Map<String, BigDecimal> allocation = allocateRefund(payments, refundAmount, refundMethod);

        for (Map.Entry<String, BigDecimal> entry : allocation.entrySet()) {
            String code = entry.getKey();
            BigDecimal amount = entry.getValue();
            if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) continue;

            if (PAY_METHOD_STORED.equals(code)) {
                if (order.getMemberId() != null) {
                    Member member = memberMapper.selectById(order.getMemberId());
                    if (member != null) {
                        BigDecimal balance = member.getBalance() != null ? member.getBalance() : BigDecimal.ZERO;
                        memberMapper.update(null, new LambdaUpdateWrapper<Member>()
                                .eq(Member::getId, member.getId())
                                .set(Member::getBalance, balance.add(amount))
                        );
                    }
                }
            } else {
                PaymentMethod pm = paymentMethodMapper.selectOne(
                        new LambdaQueryWrapper<PaymentMethod>()
                                .eq(PaymentMethod::getTenantId, order.getTenantId())
                                .eq(PaymentMethod::getCode, code)
                                .eq(PaymentMethod::getDeleted, 0)
                );
                if (pm != null) {
                    BigDecimal balance = pm.getBalance() != null ? pm.getBalance() : BigDecimal.ZERO;
                    pm.setBalance(balance.subtract(amount).max(BigDecimal.ZERO));
                    paymentMethodMapper.updateById(pm);
                }
            }
            insertPaymentRecord(order, code, amount.negate(), userId, "退货退款 " + refundNo, refundNo,
                    PAYMENT_RECORD_REFUND);
        }
    }

    /**
     * 作废退货单时回退支付账户与会员储值余额。
     */
    private void applyRefundReversal(Order order, List<OrderPayment> payments, BigDecimal refundAmount,
                                     Integer refundMethod, Long userId, String refundNo) {
        Map<String, BigDecimal> allocation = allocateRefund(payments, refundAmount, refundMethod);

        for (Map.Entry<String, BigDecimal> entry : allocation.entrySet()) {
            String code = entry.getKey();
            BigDecimal amount = entry.getValue();
            if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) continue;

            if (PAY_METHOD_STORED.equals(code)) {
                if (order.getMemberId() != null) {
                    Member member = memberMapper.selectById(order.getMemberId());
                    if (member != null) {
                        BigDecimal balance = member.getBalance() != null ? member.getBalance() : BigDecimal.ZERO;
                        BigDecimal next = balance.subtract(amount);
                        if (next.compareTo(BigDecimal.ZERO) < 0) {
                            throw new BusinessException("会员储值卡余额不足，无法回退");
                        }
                        memberMapper.update(null, new LambdaUpdateWrapper<Member>()
                                .eq(Member::getId, member.getId())
                                .set(Member::getBalance, next)
                        );
                    }
                }
            } else {
                PaymentMethod pm = paymentMethodMapper.selectOne(
                        new LambdaQueryWrapper<PaymentMethod>()
                                .eq(PaymentMethod::getTenantId, order.getTenantId())
                                .eq(PaymentMethod::getCode, code)
                                .eq(PaymentMethod::getDeleted, 0)
                );
                if (pm != null) {
                    BigDecimal balance = pm.getBalance() != null ? pm.getBalance() : BigDecimal.ZERO;
                    pm.setBalance(balance.add(amount));
                    paymentMethodMapper.updateById(pm);
                }
            }
            insertPaymentRecord(order, code, amount, userId, "作废退货单 " + refundNo, refundNo,
                    PAYMENT_RECORD_RESTORE);
        }
    }

    /**
     * 计算退款金额在各支付方式上的分摊。
     *
     * @return 支付账户编码 → 退款金额
     */
    private Map<String, BigDecimal> allocateRefund(List<OrderPayment> payments, BigDecimal refundAmount,
                                                    Integer refundMethod) {
        Map<String, BigDecimal> result = new LinkedHashMap<>();
        BigDecimal storedTotal = BigDecimal.ZERO;
        BigDecimal nonStoredTotal = BigDecimal.ZERO;
        for (OrderPayment p : payments) {
            BigDecimal amount = p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO;
            if (amount.compareTo(BigDecimal.ZERO) <= 0) continue;
            if (PAY_METHOD_STORED.equals(p.getPaymentMethod())) {
                storedTotal = storedTotal.add(amount);
            } else {
                nonStoredTotal = nonStoredTotal.add(amount);
            }
        }

        // 储值卡部分必须退回会员余额（现金退款也不能占用会员预存的钱）
        BigDecimal storedRefund = BigDecimal.ZERO;
        BigDecimal total = storedTotal.add(nonStoredTotal);
        if (storedTotal.compareTo(BigDecimal.ZERO) > 0 && total.compareTo(BigDecimal.ZERO) > 0) {
            storedRefund = refundAmount.multiply(storedTotal).divide(total, 2, RoundingMode.HALF_UP);
            if (storedRefund.compareTo(refundAmount) > 0) storedRefund = refundAmount;
        }
        BigDecimal nonStoredRefund = refundAmount.subtract(storedRefund);

        if (storedRefund.compareTo(BigDecimal.ZERO) > 0) {
            result.put(PAY_METHOD_STORED, storedRefund);
        }

        if (nonStoredRefund.compareTo(BigDecimal.ZERO) > 0) {
            if (refundMethod != null && refundMethod == REFUND_METHOD_ORIGINAL && nonStoredTotal.compareTo(BigDecimal.ZERO) > 0) {
                // 原路退回：按各支付方式占比分摊
                BigDecimal allocated = BigDecimal.ZERO;
                List<OrderPayment> nonStored = payments.stream()
                        .filter(p -> !PAY_METHOD_STORED.equals(p.getPaymentMethod()))
                        .filter(p -> p.getAmount() != null && p.getAmount().compareTo(BigDecimal.ZERO) > 0)
                        .collect(Collectors.toList());
                for (int i = 0; i < nonStored.size(); i++) {
                    OrderPayment p = nonStored.get(i);
                    BigDecimal part;
                    if (i == nonStored.size() - 1) {
                        // 最后一行补齐差额，避免分摊后总额对不上
                        part = nonStoredRefund.subtract(allocated);
                    } else {
                        part = nonStoredRefund.multiply(p.getAmount())
                                .divide(nonStoredTotal, 2, RoundingMode.HALF_UP);
                    }
                    allocated = allocated.add(part);
                    result.merge(p.getPaymentMethod(), part, BigDecimal::add);
                }
            } else {
                // 现金退款：非储值部分从现金账户支出
                result.merge(PAY_METHOD_CASH, nonStoredRefund, BigDecimal::add);
            }
        }
        return result;
    }

    /**
     * 写入支付流水记录（金额为负表示冲减）。
     *
     * @param recordType 记录类型：1-原始收款 2-退款冲减 3-取消冲减 4-恢复冲增
     */
    private void insertPaymentRecord(Order order, String paymentMethod, BigDecimal amount, Long userId,
                                     String remark, String relatedNo, int recordType) {
        OrderPayment record = new OrderPayment();
        record.setTenantId(order.getTenantId());
        record.setStoreId(order.getStoreId());
        record.setOrderId(order.getId());
        record.setPaymentMethod(paymentMethod);
        record.setAmount(amount);
        record.setRecordType(recordType);
        record.setReceivedAmount(amount);
        record.setOperatorId(userId);
        record.setPayTime(LocalDateTime.now());
        record.setRemark(remark);
        orderPaymentMapper.insert(record);
    }

    private RefundVO toRefundVO(Refund refund) {
        RefundVO vo = new RefundVO();
        BeanUtils.copyProperties(refund, vo);
        vo.setRefundMethodName(refund.getRefundMethod() != null && refund.getRefundMethod() == REFUND_METHOD_ORIGINAL
                ? "原路退回" : "现金");
        if (refund.getOperatorId() != null) {
            User user = userMapper.selectById(refund.getOperatorId());
            if (user != null) {
                vo.setOperatorName(user.getName() != null ? user.getName() : user.getUsername());
            }
        }
        List<RefundItem> items = refundItemMapper.selectByRefundId(refund.getId());
        List<RefundItemVO> itemVOs = items.stream().map(it -> {
            RefundItemVO itemVO = new RefundItemVO();
            BeanUtils.copyProperties(it, itemVO);
            return itemVO;
        }).collect(Collectors.toList());
        vo.setItems(itemVOs);
        return vo;
    }

    private String generateRefundNo() {
        String timestamp = LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
        return "TH" + timestamp + String.format("%04d", (System.nanoTime() % 10000));
    }
}
