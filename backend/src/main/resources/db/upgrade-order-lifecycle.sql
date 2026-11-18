-- ============================================================================
-- 销售订单全生命周期支持：取消 / 恢复 / 删除 / 退货退款
--
-- 1. oms_order_item 增加 refunded_qty：记录明细已退数量，支持按商品部分退货
-- 2. oms_refund_item：退货单商品明细（原 oms_refund 只能整单退款）
-- 3. oms_refund 增加 deleted / cancel 状态字段：退货单可作废（恢复原订单）
--
-- 说明：字段取值与项目内既有两套枚举保持兼容
--   order_status: 0-待支付 1-已支付 2-已完成 3-已取消 4-已退款
--   pay_status:    0-未支付 1-已支付 2-部分退款 3-全额退款
--   refund.status: 0-待处理 1-已完成 2-已驳回 3-已作废
-- ============================================================================

-- ---------- 1. 订单明细：已退数量 ----------
ALTER TABLE `oms_order_item`
    ADD COLUMN `refunded_qty` decimal(10, 2) NOT NULL DEFAULT 0.00
        COMMENT '已退数量'
        AFTER `quantity`;

-- ---------- 2. 退货单商品明细 ----------
DROP TABLE IF EXISTS `oms_refund_item`;
CREATE TABLE `oms_refund_item`
(
    `id`            bigint       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
    `tenant_id`     bigint       NOT NULL COMMENT '租户ID',
    `store_id`      bigint       NOT NULL COMMENT '门店ID',
    `refund_id`     bigint       NOT NULL COMMENT '退货单ID',
    `order_id`      bigint       NOT NULL COMMENT '原订单ID',
    `product_id`    bigint       NOT NULL COMMENT '商品ID',
    `product_name`  varchar(200) NOT NULL COMMENT '商品名称快照',
    `barcode`       varchar(64)           DEFAULT NULL COMMENT '条形码快照',
    `spec`          varchar(100)          DEFAULT NULL COMMENT '规格快照',
    `unit`          varchar(20)  NOT NULL COMMENT '单位快照',
    `quantity`      decimal(10, 2) NOT NULL COMMENT '退货数量',
    `sale_price`    decimal(10, 2) NOT NULL COMMENT '单价',
    `total_price`   decimal(10, 2) NOT NULL COMMENT '小计金额',
    `deleted`       tinyint      NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
    `create_time`   datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `update_time`   datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`) USING BTREE,
    INDEX `idx_refund_id` (`refund_id`) USING BTREE,
    INDEX `idx_order_id` (`order_id`) USING BTREE,
    INDEX `idx_product_id` (`product_id`) USING BTREE,
    INDEX `idx_tenant_id` (`tenant_id`) USING BTREE
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_general_ci COMMENT '退货单商品明细表' ROW_FORMAT = Dynamic;

-- ---------- 3. 退货单：作废（取消）支持 ----------
ALTER TABLE `oms_refund`
    ADD COLUMN `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除' AFTER `remark`,
    ADD COLUMN `cancel_time` datetime NULL DEFAULT NULL COMMENT '作废时间' AFTER `deleted`,
    ADD COLUMN `cancelled_by` bigint NULL DEFAULT NULL COMMENT '作废操作人ID' AFTER `cancel_time',
    ADD COLUMN `pay_method` varchar(32) NULL DEFAULT NULL COMMENT '退款支付账户编码（cash/wechat/alipay/card/stored）' AFTER `refund_method`;

-- ---------- 4. 订单主表：取消原因与操作留痕 ----------
-- revert_consume / revert_points 记录取消时「实际冲减」的会员累计消费与积分，
-- 恢复时按该值精确回加，保证「取消 → 恢复」后数据与取消前完全一致
ALTER TABLE `oms_order`
    ADD COLUMN `cancel_reason` varchar(200) NULL DEFAULT NULL COMMENT '取消原因' AFTER `remark`,
    ADD COLUMN `cancel_time` datetime NULL DEFAULT NULL COMMENT '取消时间' AFTER `cancel_reason`,
    ADD COLUMN `restore_time` datetime NULL DEFAULT NULL COMMENT '恢复时间' AFTER `cancel_time`,
    ADD COLUMN `revert_consume` decimal(10, 2) NULL DEFAULT NULL
        COMMENT '取消时实际冲减的会员累计消费金额（恢复时按此精确回加）' AFTER `restore_time`,
    ADD COLUMN `revert_points` int NULL DEFAULT NULL
        COMMENT '取消时实际冲减的会员积分（恢复时按此精确回加）' AFTER `revert_consume`;

-- ---------- 5. 订单支付明细：支持负数冲减（退款回退） ----------
-- amount 为负数表示退款冲减，统计 SQL 已按正负分别汇总
-- record_type 区分记录性质：1-原始收款 2-退款冲减 3-取消冲减 4-恢复冲增
-- 只有 record_type=1 的记录才是订单原始收款，取消/恢复时只按它回滚，避免重复冲减
ALTER TABLE `oms_order_payment`
    MODIFY COLUMN `amount` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '支付金额（负数为退款冲减）',
    ADD COLUMN `record_type` tinyint NOT NULL DEFAULT 1
        COMMENT '记录类型：1-原始收款 2-退款冲减 3-取消冲减 4-恢复冲增' AFTER `amount`;

-- ---------- 6. 补充索引：支持按已取消状态筛选 ----------
ALTER TABLE `oms_order`
    ADD INDEX `idx_tenant_status` (`tenant_id`, `order_status`, `deleted`) USING BTREE;
