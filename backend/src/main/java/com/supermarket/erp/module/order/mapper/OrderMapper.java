package com.supermarket.erp.module.order.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.order.entity.Order;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface OrderMapper extends BaseMapper<Order> {

    /**
     * 物理删除订单（彻底删除，绕过 @TableLogic 逻辑删除）。
     * 仅允许在业务校验通过后调用。
     */
    @Delete("DELETE FROM oms_order WHERE id = #{id} AND tenant_id = #{tenantId} AND deleted = 0")
    int hardDelete(@Param("id") Long id, @Param("tenantId") Long tenantId);
}
