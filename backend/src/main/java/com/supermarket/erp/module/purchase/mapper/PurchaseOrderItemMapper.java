package com.supermarket.erp.module.purchase.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.purchase.entity.PurchaseOrderItem;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface PurchaseOrderItemMapper extends BaseMapper<PurchaseOrderItem> {

    @Select("SELECT * FROM pms_purchase_order_item WHERE order_id = #{orderId} AND deleted = 0 ORDER BY id")
    List<PurchaseOrderItem> selectByOrderId(@Param("orderId") Long orderId);

    @Delete("DELETE FROM pms_purchase_order_item WHERE order_id = #{orderId}")
    int hardDeleteByOrderId(@Param("orderId") Long orderId);
}
