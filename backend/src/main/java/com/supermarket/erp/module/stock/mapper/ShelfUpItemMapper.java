package com.supermarket.erp.module.stock.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.stock.entity.ShelfUpItem;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ShelfUpItemMapper extends BaseMapper<ShelfUpItem> {

    @Select("SELECT * FROM wms_shelf_up_item WHERE shelf_up_id = #{shelfUpId} AND deleted = 0 ORDER BY id")
    List<ShelfUpItem> selectByShelfUpId(@Param("shelfUpId") Long shelfUpId);

    @Delete("DELETE FROM wms_shelf_up_item WHERE shelf_up_id = #{shelfUpId}")
    int hardDeleteByShelfUpId(@Param("shelfUpId") Long shelfUpId);
}
