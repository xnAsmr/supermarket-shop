package com.supermarket.erp.module.product.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 商品价格历史（快照式）：建档与每次调价后记录当时的三价。
 *
 * <p>追加写入，不更新不删除；价格未变化的编辑不产生记录。
 */
@Data
@TableName("pms_price_history")
public class PriceHistory {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long productId;

    /** 进价快照 */
    private BigDecimal purchasePrice;

    /** 售价快照 */
    private BigDecimal salePrice;

    /** 会员价快照（0 表示无会员价） */
    private BigDecimal vipPrice;

    /** 来源：create=建档 edit=调价 */
    private String source;

    /** 操作人ID */
    private Long operatorId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableLogic
    private Integer deleted;
}
