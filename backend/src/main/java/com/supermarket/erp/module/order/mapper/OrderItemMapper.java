package com.supermarket.erp.module.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.order.entity.OrderItem;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface OrderItemMapper extends BaseMapper<OrderItem> {

    @Select("SELECT * FROM oms_order_item WHERE order_id = #{orderId} AND deleted = 0")
    List<OrderItem> selectByOrderId(@Param("orderId") Long orderId);

    /**
     * 物理删除订单明细（彻底删除订单时清理关联数据）。
     */
    @Delete("DELETE FROM oms_order_item WHERE order_id = #{orderId}")
    int hardDeleteByOrderId(@Param("orderId") Long orderId);
}
