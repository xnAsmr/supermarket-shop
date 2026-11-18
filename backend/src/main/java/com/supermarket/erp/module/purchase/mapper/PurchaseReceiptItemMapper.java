package com.supermarket.erp.module.purchase.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.purchase.entity.PurchaseReceiptItem;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface PurchaseReceiptItemMapper extends BaseMapper<PurchaseReceiptItem> {

    @Select("SELECT * FROM wms_purchase_receipt_item WHERE receipt_id = #{receiptId} AND deleted = 0 ORDER BY id")
    List<PurchaseReceiptItem> selectByReceiptId(@Param("receiptId") Long receiptId);

    @Delete("DELETE FROM wms_purchase_receipt_item WHERE receipt_id = #{receiptId}")
    int hardDeleteByReceiptId(@Param("receiptId") Long receiptId);
}
