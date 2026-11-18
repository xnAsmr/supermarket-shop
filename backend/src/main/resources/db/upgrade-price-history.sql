-- ============================================================================
-- 商品价格历史：进价 / 售价 / 会员价 走势（快照式）
--
-- 设计要点：
--   1. 建档（create）与每次价格变化的编辑（edit）各追加一行快照
--   2. 只记录价格，不记录其它字段；价格未变化的编辑不产生记录
--   3. 追加写入，不更新不删除；查询按 create_time 升序供前端折线图使用
--   4. vip_price 为 0 表示无会员价
--
-- 执行顺序：本脚本可独立执行（不依赖其它升级脚本）
-- ============================================================================

CREATE TABLE IF NOT EXISTS `pms_price_history`
(
    `id`             bigint         NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id`      bigint         NOT NULL COMMENT '租户ID',
    `product_id`     bigint         NOT NULL COMMENT '商品ID',
    `purchase_price` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '进价快照',
    `sale_price`     decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '售价快照',
    `vip_price`      decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '会员价快照（0=无会员价）',
    `source`         varchar(20)    NOT NULL DEFAULT 'edit' COMMENT '来源：create=建档 edit=调价',
    `operator_id`    bigint         NULL DEFAULT NULL COMMENT '操作人ID',
    `create_time`    datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '记录时间',
    `deleted`        tinyint        NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_tenant_product_time` (`tenant_id`, `product_id`, `create_time`) USING BTREE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci COMMENT ='商品价格历史（进价/售价/会员价快照）' ROW_FORMAT = Dynamic;
