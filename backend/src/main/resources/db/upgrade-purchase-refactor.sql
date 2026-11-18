-- ============================================================================
-- 采购业务模块重构：拆分「采购订单」与「收货单」，新增「采购退货单」
--
-- 设计文档：docs/采购业务模块重构设计.md
--
-- 核心变化：
--   1. pms_purchase_order   采购订单（业务意图：订什么）
--   2. pms_purchase_order_item  订购量 / 已收量 / 已退量 三个数量
--   3. wms_purchase_receipt  收货单（物理事实：实际到了什么）—— 一单可多张
--   4. wms_purchase_receipt_item  本次实收数量
--   5. pms_purchase_return   采购退货单（红字）
--   6. pms_purchase_return_item  本次退货数量
--
-- 数据处理：清空旧采购入库数据，从零开始（见需求确认）
-- ============================================================================

-- ---------- 清理旧采购入库数据（保留表结构，仅清数据） ----------
DELETE FROM `wms_purchase_in_item`;
DELETE FROM `wms_purchase_in`;

-- ============================================================================
-- 1. 采购订单
-- ============================================================================
DROP TABLE IF EXISTS `pms_purchase_order`;
CREATE TABLE `pms_purchase_order`
(
    `id`                  bigint         NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id`           bigint         NOT NULL COMMENT '租户ID',
    `order_no`            varchar(32)    NOT NULL COMMENT '采购单号',
    `supplier_id`         bigint         NULL DEFAULT NULL COMMENT '供应商ID',
    `store_id`            bigint         NOT NULL COMMENT '收货门店ID',
    `total_amount`        decimal(12, 2) NOT NULL DEFAULT 0.00 COMMENT '订单总金额',
    `total_ordered_qty`   decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '订购总数量',
    `total_received_qty`  decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '已收总数量',
    `total_returned_qty`  decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '已退总数量',
    `status`              tinyint        NOT NULL DEFAULT 0 COMMENT '状态：0草稿 1待审核 2已审核 3部分收货 4已完成 5已取消 6部分退货 7已退货',
    `operator_id`         bigint         NULL DEFAULT NULL COMMENT '制单人ID',
    `reviewer_id`         bigint         NULL DEFAULT NULL COMMENT '审核人ID',
    `review_time`         datetime       NULL DEFAULT NULL COMMENT '审核时间',
    `review_remark`       varchar(500)   NULL DEFAULT NULL COMMENT '审核备注',
    `finish_time`         datetime       NULL DEFAULT NULL COMMENT '完成时间（全部收齐）',
    `remark`              varchar(500)   NULL DEFAULT NULL COMMENT '备注',
    `create_time`         datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`         datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `create_by`           bigint         NULL DEFAULT NULL COMMENT '创建人',
    `update_by`           bigint         NULL DEFAULT NULL COMMENT '更新人',
    `deleted`             tinyint        NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_tenant_order_no` (`tenant_id`, `order_no`) USING BTREE,
    INDEX `idx_tenant_id` (`tenant_id`) USING BTREE,
    INDEX `idx_supplier_id` (`supplier_id`) USING BTREE,
    INDEX `idx_store_id` (`store_id`) USING BTREE,
    INDEX `idx_status` (`status`) USING BTREE,
    INDEX `idx_tenant_create` (`tenant_id`, `create_time`) USING BTREE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci COMMENT ='采购订单' ROW_FORMAT = Dynamic;

-- ============================================================================
-- 2. 采购订单明细
-- ============================================================================
DROP TABLE IF EXISTS `pms_purchase_order_item`;
CREATE TABLE `pms_purchase_order_item`
(
    `id`            bigint         NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id`     bigint         NOT NULL COMMENT '租户ID',
    `order_id`      bigint         NOT NULL COMMENT '采购订单ID',
    `product_id`    bigint         NOT NULL COMMENT '商品ID',
    `product_name`  varchar(200)   NOT NULL COMMENT '商品名称快照',
    `barcode`       varchar(64)    NULL DEFAULT NULL COMMENT '条形码快照',
    `spec`          varchar(100)   NULL DEFAULT NULL COMMENT '规格快照',
    `unit`          varchar(20)    NOT NULL DEFAULT '' COMMENT '单位快照',
    `ordered_qty`   decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '订购数量',
    `received_qty`  decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '已收数量',
    `returned_qty`  decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '已退数量',
    `purchase_price` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '采购单价',
    `total_price`   decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '小计金额',
    `remark`        varchar(500)   NULL DEFAULT NULL COMMENT '行备注',
    `deleted`       tinyint        NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
    `create_time`   datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`   datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_order_id` (`order_id`) USING BTREE,
    INDEX `idx_product_id` (`product_id`) USING BTREE,
    INDEX `idx_tenant_id` (`tenant_id`) USING BTREE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci COMMENT ='采购订单明细' ROW_FORMAT = Dynamic;

-- ============================================================================
-- 3. 收货单
-- ============================================================================
DROP TABLE IF EXISTS `wms_purchase_receipt`;
CREATE TABLE `wms_purchase_receipt`
(
    `id`              bigint         NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id`       bigint         NOT NULL COMMENT '租户ID',
    `receipt_no`      varchar(32)    NOT NULL COMMENT '收货单号',
    `order_id`        bigint         NULL DEFAULT NULL COMMENT '来源采购订单ID（手工收货为空）',
    `order_no`        varchar(32)    NULL DEFAULT NULL COMMENT '来源采购单号（快照）',
    `supplier_id`     bigint         NULL DEFAULT NULL COMMENT '供应商ID',
    `store_id`        bigint         NOT NULL COMMENT '收货门店ID',
    `total_amount`    decimal(12, 2) NOT NULL DEFAULT 0.00 COMMENT '本次收货金额',
    `total_quantity`  decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '本次收货总数量',
    `status`          tinyint        NOT NULL DEFAULT 0 COMMENT '状态：0草稿 1待审核 2已审核 3已入库 4已作废',
    `operator_id`     bigint         NULL DEFAULT NULL COMMENT '制单人ID',
    `reviewer_id`     bigint         NULL DEFAULT NULL COMMENT '审核人ID',
    `review_time`     datetime       NULL DEFAULT NULL COMMENT '审核时间',
    `review_remark`   varchar(500)   NULL DEFAULT NULL COMMENT '审核备注',
    `stock_in_user_id` bigint        NULL DEFAULT NULL COMMENT '入库人ID',
    `stock_in_time`   datetime       NULL DEFAULT NULL COMMENT '入库时间',
    `remark`          varchar(500)   NULL DEFAULT NULL COMMENT '备注',
    `create_time`     datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`     datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `create_by`       bigint         NULL DEFAULT NULL COMMENT '创建人',
    `update_by`       bigint         NULL DEFAULT NULL COMMENT '更新人',
    `deleted`         tinyint        NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_tenant_receipt_no` (`tenant_id`, `receipt_no`) USING BTREE,
    INDEX `idx_tenant_id` (`tenant_id`) USING BTREE,
    INDEX `idx_order_id` (`order_id`) USING BTREE,
    INDEX `idx_supplier_id` (`supplier_id`) USING BTREE,
    INDEX `idx_store_id` (`store_id`) USING BTREE,
    INDEX `idx_status` (`status`) USING BTREE,
    INDEX `idx_tenant_create` (`tenant_id`, `create_time`) USING BTREE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci COMMENT ='采购收货单' ROW_FORMAT = Dynamic;

-- ============================================================================
-- 4. 收货单明细
-- ============================================================================
DROP TABLE IF EXISTS `wms_purchase_receipt_item`;
CREATE TABLE `wms_purchase_receipt_item`
(
    `id`             bigint         NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id`      bigint         NOT NULL COMMENT '租户ID',
    `receipt_id`     bigint         NOT NULL COMMENT '收货单ID',
    `order_id`       bigint         NULL DEFAULT NULL COMMENT '来源采购订单ID',
    `order_item_id`  bigint         NULL DEFAULT NULL COMMENT '来源采购订单明细ID',
    `product_id`     bigint         NOT NULL COMMENT '商品ID',
    `product_name`   varchar(200)   NOT NULL COMMENT '商品名称快照',
    `barcode`        varchar(64)    NULL DEFAULT NULL COMMENT '条形码快照',
    `spec`           varchar(100)   NULL DEFAULT NULL COMMENT '规格快照',
    `unit`           varchar(20)    NOT NULL DEFAULT '' COMMENT '单位快照',
    `quantity`       decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '本次实收数量',
    `purchase_price` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '采购单价',
    `total_price`    decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '小计金额',
    `batch_no`       varchar(64)    NULL DEFAULT NULL COMMENT '批次号',
    `expire_time`    datetime       NULL DEFAULT NULL COMMENT '有效期',
    `deleted`        tinyint        NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
    `create_time`    datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`    datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_receipt_id` (`receipt_id`) USING BTREE,
    INDEX `idx_order_id` (`order_id`) USING BTREE,
    INDEX `idx_order_item_id` (`order_item_id`) USING BTREE,
    INDEX `idx_product_id` (`product_id`) USING BTREE,
    INDEX `idx_tenant_id` (`tenant_id`) USING BTREE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci COMMENT ='采购收货单明细' ROW_FORMAT = Dynamic;

-- ============================================================================
-- 5. 采购退货单
-- ============================================================================
DROP TABLE IF EXISTS `pms_purchase_return`;
CREATE TABLE `pms_purchase_return`
(
    `id`             bigint         NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id`      bigint         NOT NULL COMMENT '租户ID',
    `return_no`      varchar(32)    NOT NULL COMMENT '退货单号',
    `order_id`       bigint         NULL DEFAULT NULL COMMENT '来源采购订单ID',
    `order_no`       varchar(32)    NULL DEFAULT NULL COMMENT '来源采购单号',
    `receipt_id`     bigint         NULL DEFAULT NULL COMMENT '来源收货单ID',
    `receipt_no`     varchar(32)    NULL DEFAULT NULL COMMENT '来源收货单号',
    `supplier_id`    bigint         NULL DEFAULT NULL COMMENT '供应商ID',
    `store_id`       bigint         NOT NULL COMMENT '门店ID',
    `total_amount`   decimal(12, 2) NOT NULL DEFAULT 0.00 COMMENT '退货金额',
    `total_quantity` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '退货总数量',
    `status`         tinyint        NOT NULL DEFAULT 0 COMMENT '状态：0草稿 1待审核 2已审核 3已退货 4已作废',
    `operator_id`    bigint         NULL DEFAULT NULL COMMENT '制单人ID',
    `reviewer_id`    bigint         NULL DEFAULT NULL COMMENT '审核人ID',
    `review_time`    datetime       NULL DEFAULT NULL COMMENT '审核时间',
    `review_remark`  varchar(500)   NULL DEFAULT NULL COMMENT '审核备注',
    `return_time`    datetime       NULL DEFAULT NULL COMMENT '退货生效时间',
    `reason`         varchar(500)   NULL DEFAULT NULL COMMENT '退货原因',
    `remark`         varchar(500)   NULL DEFAULT NULL COMMENT '备注',
    `create_time`    datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`    datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    `create_by`      bigint         NULL DEFAULT NULL COMMENT '创建人',
    `update_by`      bigint         NULL DEFAULT NULL COMMENT '更新人',
    `deleted`        tinyint        NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
    PRIMARY KEY (`id`) USING BTREE,
    UNIQUE INDEX `uk_tenant_return_no` (`tenant_id`, `return_no`) USING BTREE,
    INDEX `idx_tenant_id` (`tenant_id`) USING BTREE,
    INDEX `idx_order_id` (`order_id`) USING BTREE,
    INDEX `idx_receipt_id` (`receipt_id`) USING BTREE,
    INDEX `idx_supplier_id` (`supplier_id`) USING BTREE,
    INDEX `idx_status` (`status`) USING BTREE,
    INDEX `idx_tenant_create` (`tenant_id`, `create_time`) USING BTREE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci COMMENT ='采购退货单' ROW_FORMAT = Dynamic;

-- ============================================================================
-- 6. 采购退货单明细
-- ============================================================================
DROP TABLE IF EXISTS `pms_purchase_return_item`;
CREATE TABLE `pms_purchase_return_item`
(
    `id`              bigint         NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id`       bigint         NOT NULL COMMENT '租户ID',
    `return_id`       bigint         NOT NULL COMMENT '退货单ID',
    `order_id`        bigint         NULL DEFAULT NULL COMMENT '来源采购订单ID',
    `order_item_id`   bigint         NULL DEFAULT NULL COMMENT '来源采购订单明细ID',
    `receipt_id`      bigint         NULL DEFAULT NULL COMMENT '来源收货单ID',
    `receipt_item_id` bigint         NULL DEFAULT NULL COMMENT '来源收货单明细ID',
    `product_id`      bigint         NOT NULL COMMENT '商品ID',
    `product_name`    varchar(200)   NOT NULL COMMENT '商品名称快照',
    `barcode`         varchar(64)    NULL DEFAULT NULL COMMENT '条形码快照',
    `spec`            varchar(100)   NULL DEFAULT NULL COMMENT '规格快照',
    `unit`            varchar(20)    NOT NULL DEFAULT '' COMMENT '单位快照',
    `quantity`        decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '本次退货数量',
    `purchase_price`  decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '采购单价',
    `total_price`     decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '小计金额',
    `deleted`         tinyint        NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
    `create_time`     datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`     datetime       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_return_id` (`return_id`) USING BTREE,
    INDEX `idx_order_id` (`order_id`) USING BTREE,
    INDEX `idx_order_item_id` (`order_item_id`) USING BTREE,
    INDEX `idx_receipt_item_id` (`receipt_item_id`) USING BTREE,
    INDEX `idx_product_id` (`product_id`) USING BTREE,
    INDEX `idx_tenant_id` (`tenant_id`) USING BTREE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci COMMENT ='采购退货单明细' ROW_FORMAT = Dynamic;
