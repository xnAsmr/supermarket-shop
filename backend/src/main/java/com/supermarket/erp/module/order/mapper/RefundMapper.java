package com.supermarket.erp.module.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.order.entity.Refund;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface RefundMapper extends BaseMapper<Refund> {

    /**
     * 物理删除退货单（彻底删除订单时清理关联数据）。
     */
    @Delete("DELETE FROM oms_refund WHERE order_id = #{orderId}")
    int hardDeleteByOrderId(@Param("orderId") Long orderId);
}
