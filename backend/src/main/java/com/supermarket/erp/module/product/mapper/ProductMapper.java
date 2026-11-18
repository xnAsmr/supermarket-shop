package com.supermarket.erp.module.product.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.product.entity.Product;
import com.supermarket.erp.module.product.vo.HotProductReportVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface ProductMapper extends BaseMapper<Product> {

    @Select("SELECT * FROM pms_product WHERE barcode = #{barcode} AND deleted = 0 AND tenant_id = #{tenantId}")
    Product selectByBarcode(@Param("barcode") String barcode, @Param("tenantId") Long tenantId);

    @Select("SELECT * FROM pms_product WHERE tenant_id = #{tenantId} AND deleted = 0 " +
            "AND (name LIKE CONCAT('%',#{keyword},'%') OR pinyin LIKE CONCAT('%',#{keyword},'%') OR barcode = #{keyword})")
    List<Product> searchByKeyword(@Param("keyword") String keyword, @Param("tenantId") Long tenantId);

    /**
     * 热销商品聚合：按商品汇总已完成销售订单（order_type=1, order_status=2 已完成）的销量与销售额，
     * 时间窗口由调用方传入（工作台/经营分析取近 7 天，与本地 Mock 口径一致）。
     * 以订单的 tenant_id 过滤（POS 早期写入的订单明细 tenant_id 可能为 NULL，订单上一定有）。
     * 已删除商品仍保留其历史销量（product_name 取订单明细快照）。
     */
    @Select("SELECT oi.product_id AS productId, MAX(oi.product_name) AS productName, " +
            "IFNULL(SUM(oi.quantity), 0) AS saleCount, " +
            "IFNULL(SUM(oi.total_price), 0) AS salesAmount " +
            "FROM oms_order_item oi " +
            "INNER JOIN oms_order o ON o.id = oi.order_id AND o.deleted = 0 " +
            "WHERE o.tenant_id = #{tenantId} AND oi.deleted = 0 " +
            "AND o.order_type = 1 AND o.order_status = 2 " +
            "AND o.create_time >= #{startDate} " +
            "GROUP BY oi.product_id " +
            "ORDER BY salesAmount DESC")
    List<HotProductReportVO> selectHotProductSales(@Param("tenantId") Long tenantId,
                                                   @Param("startDate") LocalDate startDate);
}
