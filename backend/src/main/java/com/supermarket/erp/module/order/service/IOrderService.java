package com.supermarket.erp.module.order.service;

import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.module.order.dto.OrderQueryDTO;
import com.supermarket.erp.module.order.dto.RefundCreateDTO;
import com.supermarket.erp.module.order.dto.RefundQueryDTO;
import com.supermarket.erp.module.order.entity.OrderItem;
import com.supermarket.erp.module.order.vo.OrderVO;
import com.supermarket.erp.module.order.vo.RefundVO;

import java.util.List;

public interface IOrderService {

    OrderVO getById(Long id, Long tenantId);

    PageResult<OrderVO> pageList(OrderQueryDTO query, Long tenantId);

    /**
     * 取消订单（逻辑取消，可恢复）。
     * <p>回滚该订单引起的：货架库存、支付账户余额、会员储值余额与累计消费/积分。
     */
    void cancel(Long id, Long tenantId, Long userId, String reason);

    /**
     * 恢复已取消的订单（重新扣减库存、恢复支付账户与会员数据）。
     */
    void restore(Long id, Long tenantId, Long userId);

    void complete(Long id, Long tenantId, Long userId);

    /**
     * 整单退款（保留兼容能力，优先使用按商品退货接口）。
     */
    void refund(Long id, Long tenantId, Long userId);

    /**
     * 彻底删除订单（仅允许删除已取消的订单；若订单为已支付/已完成状态，需先取消或退款）。
     */
    void delete(Long id, Long tenantId, Long userId);

    void updateRemark(Long id, Long tenantId, String remark, Long userId);

    List<OrderItem> getOrderItems(Long orderId);

    /* ------------------------- 退货退款 ------------------------- */

    /** 发起退货（按商品部分退货）：回补库存、冲减支付账户、冲减会员累计消费 */
    RefundVO createRefund(RefundCreateDTO dto, Long tenantId, Long userId);

    /** 退货单分页查询 */
    PageResult<RefundVO> pageRefunds(RefundQueryDTO query, Long tenantId);

    /** 退货单详情 */
    RefundVO getRefund(Long id, Long tenantId);

    /**
     * 作废退货单（相当于取消退货）：回退库存、恢复支付账户与会员数据、恢复订单状态。
     */
    void cancelRefund(Long id, Long tenantId, Long userId);
}
