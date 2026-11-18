-- ============================================================================
-- 货架库存与库存预警：上架单 + 两级预警阈值
--
-- 设计要点：
--   1. 三层库存：在途(pending) → 仓库(warehouse) → 货架(shelf)
--      货架库存才是收银台的可售库存，POS 销售扣减 shelf_quantity
--   2. 「上架」是同一门店内 仓库 → 货架 的移动，独立成单，不设审核
--   3. 调拨是跨门店 仓库 → 仓库，与上架区分开
--   4. 预警阈值支持「商品级默认 + 门店级覆盖」，两级：预警线 / 紧急线
--
-- 执行顺序：先执行本脚本，再执行 seed-shelf-inventory-menu.sql
-- ============================================================================

-- ============================================================================
-- 1. 上架单
-- ============================================================================
DROP TABLE IF EXISTS `wms_shelf_up`;
CREATE TABLE `wms_shelf_up`
(
    `id`             bigint         NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id`      bigint         NOT NULL COMMENT '租户ID',
    `shelf_up_no`    varchar(32)    NOT NULL COMMENT '上架单号',
    `store_id`       bigint         NOT NULL COMMENT '门店ID',
    `total_quantity` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '上架总数量',
    `status`         tinyint        NOT NULL DEFAULT 0 COMMENT '状态：0草稿 1已上架 2已撤销',
    `operator_id`    bigint         NULL DEFAULT NULL COMMENT '制单人ID',
    `shelf_up_user_id` bigint       NULL DEFAULT NULL COMMENT '上架操作人ID',
    `shelf_up_time`  datetime       NULL DEFAULT NULL COMMENT '上架时间',
    `remark`         varchar(500)   NULL DEFAULT NULL COMMENT '备注',
    `create_time`    datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`    datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `create_by`      bigint         NULL DEFAULT NULL COMMENT '创建人',
    `update_by`      bigint         NULL DEFAULT NULL COMMENT '更新人',
    `deleted`        tinyint        NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_tenant_shelf_up_no` (`tenant_id`, `shelf_up_no`) USING BTREE,
    INDEX `idx_tenant_id` (`tenant_id`) USING BTREE,
    INDEX `idx_store_id` (`store_id`) USING BTREE,
    INDEX `idx_status` (`status`) USING BTREE,
    INDEX `idx_tenant_create` (`tenant_id`, `create_time`) USING BTREE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci COMMENT ='上架单（仓库→货架）' ROW_FORMAT = Dynamic;

-- ============================================================================
-- 2. 上架单明细
-- ============================================================================
DROP TABLE IF EXISTS `wms_shelf_up_item`;
CREATE TABLE `wms_shelf_up_item`
(
    `id`           bigint         NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id`    bigint         NOT NULL COMMENT '租户ID',
    `shelf_up_id`  bigint         NOT NULL COMMENT '上架单ID',
    `product_id`   bigint         NOT NULL COMMENT '商品ID',
    `product_name` varchar(200)   NOT NULL COMMENT '商品名称快照',
    `barcode`      varchar(64)    NULL DEFAULT NULL COMMENT '条形码快照',
    `spec`         varchar(100)   NULL DEFAULT NULL COMMENT '规格快照',
    `unit`         varchar(20)    NOT NULL DEFAULT '' COMMENT '单位快照',
    `quantity`     decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '本次上架数量',
    `remark`       varchar(500)   NULL DEFAULT NULL COMMENT '行备注',
    `deleted`      tinyint        NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
    `create_time`  datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`  datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_shelf_up_id` (`shelf_up_id`) USING BTREE,
    INDEX `idx_product_id` (`product_id`) USING BTREE,
    INDEX `idx_tenant_id` (`tenant_id`) USING BTREE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci COMMENT ='上架单明细' ROW_FORMAT = Dynamic;

-- ============================================================================
-- 3. 商品级预警阈值（默认值，门店可覆盖）
-- ============================================================================
ALTER TABLE `pms_product`
    ADD COLUMN `stock_warn_threshold`   decimal(10, 2) NOT NULL DEFAULT 10.00
        COMMENT '库存预警线（商品默认，货架库存低于此值预警）' AFTER `is_promotion`,
    ADD COLUMN `stock_urgent_threshold` decimal(10, 2) NOT NULL DEFAULT 3.00
        COMMENT '库存紧急线（商品默认，货架库存低于此值紧急）' AFTER `stock_warn_threshold`;

-- ============================================================================
-- 4. 门店级预警阈值覆盖（NULL 表示沿用商品默认）
-- ============================================================================
ALTER TABLE `wms_stock`
    ADD COLUMN `warn_threshold`   decimal(10, 2) NULL DEFAULT NULL
        COMMENT '门店级预警线覆盖（NULL 沿用商品默认）' AFTER `avg_cost`,
    ADD COLUMN `urgent_threshold` decimal(10, 2) NULL DEFAULT NULL
        COMMENT '门店级紧急线覆盖（NULL 沿用商品默认）' AFTER `warn_threshold`;
