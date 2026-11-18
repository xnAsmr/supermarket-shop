package com.supermarket.erp.module.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.order.entity.RefundItem;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface RefundItemMapper extends BaseMapper<RefundItem> {

    @Select("SELECT * FROM oms_refund_item WHERE refund_id = #{refundId} AND deleted = 0")
    List<RefundItem> selectByRefundId(@Param("refundId") Long refundId);

    /**
     * 物理删除退货单明细（彻底删除订单时清理关联数据）。
     */
    @Delete("DELETE FROM oms_refund_item WHERE order_id = #{orderId}")
    int hardDeleteByOrderId(@Param("orderId") Long orderId);
}
