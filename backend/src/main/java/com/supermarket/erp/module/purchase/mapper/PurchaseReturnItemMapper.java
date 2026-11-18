package com.supermarket.erp.module.purchase.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.purchase.entity.PurchaseReturnItem;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface PurchaseReturnItemMapper extends BaseMapper<PurchaseReturnItem> {

    @Select("SELECT * FROM pms_purchase_return_item WHERE return_id = #{returnId} AND deleted = 0 ORDER BY id")
    List<PurchaseReturnItem> selectByReturnId(@Param("returnId") Long returnId);

    @Delete("DELETE FROM pms_purchase_return_item WHERE return_id = #{returnId}")
    int hardDeleteByReturnId(@Param("returnId") Long returnId);
}
