/*
 Navicat Premium Data Transfer

 Source Server         : klt
 Source Server Type    : MySQL
 Source Server Version : 80033
 Source Host           : localhost:3306
 Source Schema         : supermarket_erp

 Target Server Type    : MySQL
 Target Server Version : 80033
 File Encoding         : 65001

 Date: 07/09/2026 14:18:47
*/

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for oms_order
-- ----------------------------
DROP TABLE IF EXISTS `oms_order`;
CREATE TABLE `oms_order`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `order_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '订单号',
  `order_type` tinyint NOT NULL DEFAULT 1 COMMENT '订单类型：1-销售 2-退货 3-换货',
  `member_id` bigint NULL DEFAULT NULL COMMENT '会员ID（散客为空）',
  `total_amount` decimal(10, 2) NOT NULL COMMENT '订单总额',
  `discount_amount` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '优惠金额',
  `pay_amount` decimal(10, 2) NOT NULL COMMENT '应付金额',
  `profit_amount` decimal(10, 2) NULL DEFAULT 0.00 COMMENT '利润',
  `change_amount` decimal(10, 2) NULL DEFAULT 0.00,
  `pay_method` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '支付方式编码',
  `is_combined_pay` tinyint NOT NULL DEFAULT 0 COMMENT '是否组合支付：0-否 1-是',
  `pay_status` tinyint NOT NULL DEFAULT 0 COMMENT '支付状态：0-未支付 1-已支付 2-部分退款 3-全额退款',
  `order_status` tinyint NOT NULL DEFAULT 0 COMMENT '订单状态：0-待支付 1-已完成 2-已取消 3-已退款',
  `total_quantity` int NOT NULL DEFAULT 0 COMMENT '商品总数',
  `operator_id` bigint NULL DEFAULT NULL,
  `cashier_id` bigint NULL DEFAULT NULL,
  `order_time` datetime(0) NULL DEFAULT NULL COMMENT '下单时间',
  `pay_time` datetime(0) NULL DEFAULT NULL COMMENT '支付时间',
  `complete_time` datetime(0) NULL DEFAULT NULL,
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_order_no`(`tenant_id`, `order_no`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_store_id`(`store_id`) USING BTREE,
  INDEX `idx_member_id`(`member_id`) USING BTREE,
  INDEX `idx_pay_status`(`pay_status`) USING BTREE,
  INDEX `idx_order_status`(`order_status`) USING BTREE,
  INDEX `idx_create_time`(`create_time`) USING BTREE,
  INDEX `idx_cashier_id`(`cashier_id`) USING BTREE,
  INDEX `idx_tenant_store`(`tenant_id`, `store_id`) USING BTREE,
  INDEX `idx_tenant_create`(`tenant_id`, `create_time`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 22 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '订单主表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of oms_order
-- ----------------------------
INSERT INTO `oms_order` VALUES (17, 1, 1, '202609040937060010001', 1, NULL, 2.50, 0.00, 2.50, 1.20, 0.00, 'wechat', 0, 1, 1, 0, 1, NULL, '2026-09-04 09:37:07', '2026-09-04 09:37:07', NULL, NULL, '2026-09-04 09:37:07', '2026-09-04 09:37:07', NULL, NULL, 0);
INSERT INTO `oms_order` VALUES (21, 1, 1, '202609041026200010001', 1, 1, 8.80, 0.00, 8.80, 3.40, 0.00, 'stored', 0, 1, 1, 0, 1, NULL, '2026-09-04 10:26:20', '2026-09-04 10:26:20', NULL, NULL, '2026-09-04 10:26:20', '2026-09-04 10:26:20', NULL, NULL, 0);

-- ----------------------------
-- Table structure for oms_order_item
-- ----------------------------
DROP TABLE IF EXISTS `oms_order_item`;
CREATE TABLE `oms_order_item`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NULL DEFAULT NULL,
  `store_id` bigint NULL DEFAULT NULL,
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `product_id` bigint NOT NULL COMMENT '商品ID',
  `product_name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '商品名称快照',
  `barcode` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '条形码快照',
  `spec` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '规格快照',
  `unit` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '单位快照',
  `quantity` decimal(10, 2) NOT NULL COMMENT '数量',
  `sale_price` decimal(10, 2) NOT NULL COMMENT '零售价',
  `discount_price` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '折后单价',
  `total_price` decimal(10, 2) NOT NULL COMMENT '小计金额',
  `cost_amount` decimal(10, 2) NULL DEFAULT 0.00 COMMENT '成本价',
  `is_weight` tinyint NOT NULL DEFAULT 0 COMMENT '是否称重商品：0-否 1-是',
  `deleted` int NULL DEFAULT 0,
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_order_id`(`order_id`) USING BTREE,
  INDEX `idx_product_id`(`product_id`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_store_id`(`store_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 19 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '订单明细表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of oms_order_item
-- ----------------------------
INSERT INTO `oms_order_item` VALUES (14, NULL, NULL, 17, 29, '晨光中性笔', '6927804081108', '1 支 / 盒', '件', 1.00, 2.50, 0.00, 2.50, 1.30, 0, 0, '2026-09-04 09:37:07', '2026-09-04 09:37:07');
INSERT INTO `oms_order_item` VALUES (18, NULL, NULL, 21, 28, '家用加厚垃圾袋', '6935349200614', '100 只 / 包', '件', 1.00, 8.80, 0.00, 8.80, 5.40, 0, 0, '2026-09-04 10:26:20', '2026-09-04 10:26:20');

-- ----------------------------
-- Table structure for oms_order_payment
-- ----------------------------
DROP TABLE IF EXISTS `oms_order_payment`;
CREATE TABLE `oms_order_payment`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NULL DEFAULT NULL,
  `store_id` bigint NULL DEFAULT NULL,
  `payment_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL,
  `order_id` bigint NOT NULL COMMENT '订单ID',
  `payment_method` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '支付方式编码',
  `amount` decimal(10, 2) NOT NULL COMMENT '支付金额',
  `received_amount` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '实收金额（现金支付）',
  `change_amount` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '找零金额（现金支付）',
  `operator_id` bigint NULL DEFAULT NULL,
  `remark` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `pay_time` datetime(0) NULL DEFAULT NULL,
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `deleted` int NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_payment_no`(`payment_no`) USING BTREE,
  INDEX `idx_order_id`(`order_id`) USING BTREE,
  INDEX `idx_payment_method`(`payment_method`) USING BTREE,
  INDEX `idx_operator_id`(`operator_id`) USING BTREE,
  INDEX `idx_store_id`(`store_id`) USING BTREE,
  INDEX `idx_pay_time`(`pay_time`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_store_paytime`(`store_id`, `pay_time`) USING BTREE,
  INDEX `idx_store_method_time`(`store_id`, `payment_method`, `pay_time`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 18 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '订单支付明细' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of oms_order_payment
-- ----------------------------
INSERT INTO `oms_order_payment` VALUES (13, 1, 1, NULL, 17, 'wechat', 2.50, 0.00, 0.00, NULL, NULL, '2026-09-04 09:37:07', '2026-09-04 09:37:07', '2026-09-04 09:37:07', 0);
INSERT INTO `oms_order_payment` VALUES (17, 1, 1, NULL, 21, 'stored', 8.80, 0.00, 0.00, NULL, NULL, '2026-09-04 10:26:20', '2026-09-04 10:26:20', '2026-09-04 10:26:20', 0);

-- ----------------------------
-- Table structure for oms_refund
-- ----------------------------
DROP TABLE IF EXISTS `oms_refund`;
CREATE TABLE `oms_refund`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `refund_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '退款单号',
  `order_id` bigint NOT NULL COMMENT '原订单ID',
  `order_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '原订单号',
  `refund_amount` decimal(10, 2) NOT NULL COMMENT '退款金额',
  `refund_method` tinyint NOT NULL COMMENT '退款方式：1-现金 2-原路退回',
  `refund_reason` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '退款原因',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-待退款 1-已退款 2-退款失败',
  `operator_id` bigint NOT NULL COMMENT '操作人ID',
  `refund_time` datetime(0) NULL DEFAULT NULL COMMENT '退款时间',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_refund_no`(`tenant_id`, `refund_no`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_store_id`(`store_id`) USING BTREE,
  INDEX `idx_order_id`(`order_id`) USING BTREE,
  INDEX `idx_create_time`(`create_time`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 1 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '退款记录表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of oms_refund
-- ----------------------------

-- ----------------------------
-- Table structure for pms_brand
-- ----------------------------
DROP TABLE IF EXISTS `pms_brand`;
CREATE TABLE `pms_brand`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '品牌名称',
  `logo` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '品牌Logo',
  `description` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '品牌描述',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `sort` int NOT NULL DEFAULT 0 COMMENT '排序',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_name`(`name`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 29 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '品牌表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of pms_brand
-- ----------------------------
INSERT INTO `pms_brand` VALUES (1, 1, '奥利奥', '', '奥利奥奥利奥奥利奥奥利奥', 1, 0, '2026-09-04 17:36:35', '2026-09-04 17:36:35', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (2, 1, '卫龙', '', '', 1, 0, '2026-09-04 17:36:42', '2026-09-04 17:36:42', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (3, 1, '洽洽', '', '', 1, 0, '2026-09-04 17:36:46', '2026-09-04 17:36:46', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (4, 1, '乐事', '', '', 1, 0, '2026-09-04 17:36:51', '2026-09-04 17:36:51', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (5, 1, '康师傅', '', '', 1, 0, '2026-09-04 17:36:56', '2026-09-04 17:36:56', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (6, 1, '统一', '', '', 1, 0, '2026-09-04 17:37:05', '2026-09-04 17:37:05', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (7, 1, '三全', '', '', 1, 0, '2026-09-04 17:37:11', '2026-09-04 17:37:11', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (8, 1, '农夫山泉', '', '', 1, 0, '2026-09-04 17:37:16', '2026-09-04 17:37:16', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (9, 1, '可口可乐', '', '', 1, 0, '2026-09-04 17:37:22', '2026-09-04 17:37:22', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (10, 1, '香飘飘', '', '', 1, 0, '2026-09-04 17:37:26', '2026-09-04 17:37:26', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (11, 1, '十月稻田', '', '', 1, 0, '2026-09-04 17:37:30', '2026-09-04 17:37:30', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (12, 1, '金龙鱼', '', '', 1, 0, '2026-09-04 17:37:33', '2026-09-04 17:37:33', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (13, 1, '海天', '', '', 1, 0, '2026-09-04 17:37:37', '2026-09-04 17:37:37', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (14, 1, '本地果业', '', '', 1, 0, '2026-09-04 17:37:40', '2026-09-04 17:37:40', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (15, 1, '本地蔬菜基地', '', '', 1, 0, '2026-09-04 17:37:45', '2026-09-04 17:37:45', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (17, 1, '农家鲜蛋', '', '', 1, 0, '2026-09-04 17:37:49', '2026-09-04 17:37:49', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (18, 1, '本地屠宰场', '', '', 1, 0, '2026-09-04 17:37:53', '2026-09-04 17:37:53', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (19, 1, '海天下', '', '', 1, 0, '2026-09-04 17:37:56', '2026-09-04 17:37:56', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (20, 1, '国联水产', '', '', 1, 0, '2026-09-04 17:38:02', '2026-09-04 17:38:02', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (21, 1, '海飞丝', '', '', 1, 0, '2026-09-04 17:38:08', '2026-09-04 17:38:08', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (22, 1, '舒肤佳', '', '', 1, 0, '2026-09-04 17:38:12', '2026-09-04 17:38:12', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (23, 1, '高露洁', '', '', 1, 0, '2026-09-04 17:38:16', '2026-09-04 17:38:16', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (24, 1, '维达', '', '', 1, 0, '2026-09-04 17:38:20', '2026-09-04 17:38:20', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (25, 1, '蓝月亮', '', '', 1, 0, '2026-09-04 17:38:24', '2026-09-04 17:38:24', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (26, 1, '美的', '', '', 1, 0, '2026-09-04 17:38:27', '2026-09-04 17:38:27', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (27, 1, '洁成', '', '', 1, 0, '2026-09-04 17:38:33', '2026-09-04 17:38:33', 1, 1, 0);
INSERT INTO `pms_brand` VALUES (28, 1, '晨光', '', '', 1, 0, '2026-09-04 17:38:36', '2026-09-04 17:38:36', 1, 1, 0);

-- ----------------------------
-- Table structure for pms_category
-- ----------------------------
DROP TABLE IF EXISTS `pms_category`;
CREATE TABLE `pms_category`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '分类名称',
  `code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '分类编码',
  `parent_id` bigint NOT NULL DEFAULT 0 COMMENT '父分类ID（0表示顶级分类）',
  `level` tinyint NOT NULL COMMENT '层级（1/2/3）',
  `sort` int NOT NULL DEFAULT 0 COMMENT '排序',
  `icon` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '分类图标',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_parent_id`(`parent_id`) USING BTREE,
  INDEX `idx_tenant_parent`(`tenant_id`, `parent_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 115 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '商品分类表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of pms_category
-- ----------------------------
INSERT INTO `pms_category` VALUES (94, 1, '食品饮料', 'FD', 0, 1, 0, NULL, 1, '2026-09-01 16:11:02', '2026-09-01 16:11:02', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (95, 1, '生鲜果蔬', 'FV', 0, 1, 0, NULL, 1, '2026-09-01 16:11:18', '2026-09-01 16:11:18', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (96, 1, '个护日化', 'PC', 0, 1, 0, NULL, 1, '2026-09-01 16:11:31', '2026-09-01 16:11:31', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (97, 1, '家居百货', 'HH', 0, 1, 0, NULL, 1, '2026-09-01 16:11:41', '2026-09-01 16:11:41', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (98, 1, '休闲零食', 'FD-01', 94, 2, 0, NULL, 1, '2026-09-01 16:20:37', '2026-09-01 16:20:37', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (99, 1, '方便速食', 'FD‑02', 94, 2, 0, NULL, 1, '2026-09-01 16:21:18', '2026-09-01 16:21:18', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (100, 1, '饮料冲调', 'FD‑03', 94, 2, 0, NULL, 1, '2026-09-01 16:25:06', '2026-09-01 16:25:06', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (101, 1, '粮油调味', 'FD‑04', 94, 2, 0, NULL, 1, '2026-09-01 16:25:18', '2026-09-01 16:25:18', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (102, 1, '新鲜水果', 'FV‑01', 95, 2, 0, NULL, 1, '2026-09-01 16:25:34', '2026-09-01 16:25:34', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (103, 1, '新鲜蔬菜', 'FV‑02', 95, 2, 0, NULL, 1, '2026-09-01 16:26:09', '2026-09-01 16:26:09', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (104, 1, '肉禽蛋类', 'FV‑03', 95, 2, 0, NULL, 1, '2026-09-01 16:26:49', '2026-09-01 16:26:49', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (105, 1, '水产海鲜', 'FV‑04', 95, 2, 0, NULL, 1, '2026-09-01 16:28:51', '2026-09-01 16:28:51', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (106, 1, '个人洗护', 'PC‑01', 96, 2, 0, NULL, 1, '2026-09-01 16:29:08', '2026-09-01 16:29:08', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (107, 1, '口腔护理', 'PC‑02', 96, 2, 0, NULL, 1, '2026-09-01 16:29:27', '2026-09-01 16:29:27', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (108, 1, '纸品家清', 'PC‑03', 96, 2, 0, NULL, 1, '2026-09-01 16:29:38', '2026-09-01 16:29:38', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (109, 1, '美妆护肤', 'PC‑04', 96, 2, 0, NULL, 1, '2026-09-01 16:29:50', '2026-09-01 16:29:50', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (110, 1, '厨具餐具', 'HH‑01', 97, 2, 0, NULL, 1, '2026-09-01 16:30:56', '2026-09-01 16:30:56', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (111, 1, '家纺布艺', 'HH‑02', 97, 2, 0, NULL, 1, '2026-09-01 16:32:20', '2026-09-01 16:32:20', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (112, 1, '收纳用品', 'HH‑03', 97, 2, 0, NULL, 1, '2026-09-01 16:32:31', '2026-09-01 16:32:31', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (113, 1, '文体玩具', 'HH‑04', 97, 2, 0, NULL, 1, '2026-09-01 16:32:41', '2026-09-01 16:32:41', NULL, NULL, 0);
INSERT INTO `pms_category` VALUES (114, 1, '一次性用品', 'HH‑05', 97, 2, 0, NULL, 1, '2026-09-01 16:32:50', '2026-09-01 16:32:50', NULL, NULL, 0);

-- ----------------------------
-- Table structure for pms_product
-- ----------------------------
DROP TABLE IF EXISTS `pms_product`;
CREATE TABLE `pms_product`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `product_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '商品编号',
  `barcode` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '条形码',
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '商品名称',
  `pinyin` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '拼音首字母（用于搜索）',
  `short_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '简称（小票打印用）',
  `category_id` bigint NOT NULL COMMENT '分类ID',
  `brand_id` bigint NULL DEFAULT NULL COMMENT '品牌ID',
  `supplier_id` bigint NULL DEFAULT NULL COMMENT '供应商ID',
  `spec` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '规格（如 500ml、1kg）',
  `unit` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '单位（个/瓶/袋/kg）',
  `purchase_price` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '进货价',
  `sale_price` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '零售价',
  `vip_price` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '会员价',
  `weight` decimal(10, 3) NULL DEFAULT NULL COMMENT '重量（kg）',
  `image` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL,
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-下架 1-上架',
  `is_weight` tinyint NOT NULL DEFAULT 0 COMMENT '是否称重商品：0-否 1-是',
  `is_promotion` tinyint NOT NULL DEFAULT 0 COMMENT '是否促销：0-否 1-是',
  `sale_count` int NOT NULL DEFAULT 0 COMMENT '销售数量（用于热销排行）',
  `sort` int NOT NULL DEFAULT 0 COMMENT '排序',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_product_no`(`tenant_id`, `product_no`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_barcode`(`barcode`) USING BTREE,
  INDEX `idx_pinyin`(`pinyin`) USING BTREE,
  INDEX `idx_category_id`(`category_id`) USING BTREE,
  INDEX `idx_brand_id`(`brand_id`) USING BTREE,
  INDEX `idx_supplier_id`(`supplier_id`) USING BTREE,
  INDEX `idx_status`(`status`) USING BTREE,
  INDEX `idx_sale_count`(`sale_count`) USING BTREE,
  INDEX `idx_tenant_status`(`tenant_id`, `status`) USING BTREE,
  INDEX `idx_tenant_category`(`tenant_id`, `category_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 30 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '商品信息表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of pms_product
-- ----------------------------
INSERT INTO `pms_product` VALUES (1, 1, 'P1788252955941', '6901668002424', '奥利奥原味夹心饼干', '奥利奥原味夹心饼干', NULL, 98, 1, NULL, '388g / 袋', '件', 8.20, 12.90, 11.50, NULL, '/api/v1/upload/file/product/df5a8557ab4b4bef9cc2d249f9d5a17a.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 16:55:56', '2026-09-01 16:55:56', 1, 1, 0);
INSERT INTO `pms_product` VALUES (2, 1, 'P1788253252471', '6924743230222', '卫龙大面筋辣条', '卫龙大面筋辣条', NULL, 98, 2, NULL, '68g / 包', '件', 3.60, 6.50, 5.80, NULL, '/api/v1/upload/file/product/e62b586580f0462a96db8aea876b0c91.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:00:52', '2026-09-01 17:00:52', 1, 1, 0);
INSERT INTO `pms_product` VALUES (3, 1, 'P1788253279735', '6924187800553', '洽洽香瓜子', '洽洽香瓜子', NULL, 98, 3, NULL, '260g / 袋', '件', 6.10, 9.90, 8.80, NULL, '/api/v1/upload/file/product/dbb4e09a7b634d3291241343c7e23748.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:01:20', '2026-09-01 17:01:20', 1, 1, 0);
INSERT INTO `pms_product` VALUES (4, 1, 'P1788253412109', '6924743222029', '乐事原味薯片', 'fanjun原味薯片', NULL, 98, 4, NULL, '75g / 罐', '件', 4.70, 8.00, 7.20, NULL, '/api/v1/upload/file/product/71fc7816a8154a12b81e3dc76cb84c49.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:03:32', '2026-09-01 17:03:32', 1, 1, 0);
INSERT INTO `pms_product` VALUES (5, 1, 'P1788253452965', '6903252100136', '康师傅红烧牛肉面', '康师傅红烧牛肉面', NULL, 99, 5, NULL, '142g / 桶', '件', 2.40, 4.50, 3.79, NULL, '/api/v1/upload/file/product/b6816cb982554609a25f05217b75be57.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:04:13', '2026-09-01 17:04:13', 1, 1, 0);
INSERT INTO `pms_product` VALUES (6, 1, 'P1788253559508', '6925037202426', '统一老坛酸菜牛肉面', '统a老坛酸菜牛肉面', NULL, 99, 6, NULL, '138g / 桶', '件', 2.40, 4.20, 3.79, NULL, '/api/v1/upload/file/product/3fc17eebed4040759a414494eeebf763.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:06:00', '2026-09-01 17:06:00', 1, 1, 0);
INSERT INTO `pms_product` VALUES (7, 1, 'P1788253607868', '6908791004727', '三全猪肉白菜水饺', 'bao全猪肉白菜水饺', NULL, 99, 7, NULL, '1000g / 袋', '件', 11.20, 16.80, 14.90, NULL, '/api/v1/upload/file/product/5421edb8b1bf4ecdb46015a796727cec.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:06:48', '2026-09-01 17:06:48', 1, 1, 0);
INSERT INTO `pms_product` VALUES (8, 1, 'P1788253950243', '6921168500244', '农夫山泉饮用天然水', '农夫山泉饮用天然水', NULL, 100, 8, NULL, '550ml / 瓶', '件', 1.10, 2.00, 1.79, NULL, '/api/v1/upload/file/product/7c4541a4d3ef44dcb41fb027a8ae013e.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:12:30', '2026-09-01 17:12:30', 1, 1, 0);
INSERT INTO `pms_product` VALUES (9, 1, 'P1788254104114', '6921317700208', '可口可乐碳酸饮料', '可口可fan碳酸饮料', NULL, 100, 9, NULL, '500ml / 瓶', '件', 2.00, 3.50, 3.10, NULL, '/api/v1/upload/file/product/97612e45c1df442abe530d81a6712d62.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:15:04', '2026-09-01 17:15:04', 1, 1, 0);
INSERT INTO `pms_product` VALUES (10, 1, 'P1788254580995', '6921770082327', '香飘飘原味奶茶', '香飘飘原味奶茶', NULL, 100, 10, NULL, '80g / 杯', '件', 3.40, 6.00, 5.30, NULL, '/api/v1/upload/file/product/354e8cdf40e54708bd39d45dad205b7e.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:23:01', '2026-09-01 17:23:01', 1, 1, 0);
INSERT INTO `pms_product` VALUES (11, 1, 'P1788254680600', '6971134460012', '五常大米', 'kong常大米', NULL, 101, 11, NULL, '5kg / 袋', '件', 42.50, 59.90, 54.90, NULL, '/api/v1/upload/file/product/ec7ddb457c794276aed1be99a33abf54.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:24:41', '2026-09-01 17:24:41', 1, 1, 0);
INSERT INTO `pms_product` VALUES (12, 1, 'P1788254719196', '6948195800122', '金龙鱼食用调和油', '金龙鱼食用调和油', NULL, 101, 12, NULL, '5L / 桶', '件', 51.00, 68.00, 62.00, NULL, '/api/v1/upload/file/product/5d9f4a9a8cd042ce8641492af489fbc6.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:25:19', '2026-09-01 17:25:19', 1, 1, 0);
INSERT INTO `pms_product` VALUES (13, 1, 'P1788254777288', '6902262200148', '海天金标生抽', '海天金标生抽', NULL, 101, 13, NULL, '1.28L / 瓶', '件', 9.30, 14.50, 12.90, NULL, '/api/v1/upload/file/product/f2f39876122145baa6dc87256c559e8c.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:26:17', '2026-09-01 17:26:17', 1, 1, 0);
INSERT INTO `pms_product` VALUES (14, 1, 'P1788255795380', '2100000000017', '红富士苹果', '红富士苹果', NULL, 102, 14, NULL, '1kg / 份', '件', 4.80, 7.99, 6.99, NULL, '/api/v1/upload/file/product/b1702361eed4426cacca695447f097cf.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:43:15', '2026-09-01 17:43:15', 1, 1, 0);
INSERT INTO `pms_product` VALUES (15, 1, 'P1788255863589', '2100000000024', '阳光玫瑰葡萄', '阳光玫瑰葡萄', NULL, 102, 14, NULL, '500g / 份', '件', 12.50, 19.90, 17.90, NULL, '/api/v1/upload/file/product/7a16d17b127a436aa28c1e18a6519761.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:44:24', '2026-09-01 17:44:24', 1, 1, 0);
INSERT INTO `pms_product` VALUES (16, 1, 'P1788255921808', '2200000000031', '上海青', 'bei海青', NULL, 103, 15, NULL, '500g / 份', '件', 1.40, 2.99, 2.49, NULL, '/api/v1/upload/file/product/6b149e27edbc4710906387a47a2cfd28.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:45:22', '2026-09-01 17:45:22', 1, 1, 0);
INSERT INTO `pms_product` VALUES (17, 1, 'P1788255971510', '2200000000048', '西红柿', '西红柿', NULL, 103, 15, NULL, '500g / 份', '件', 2.30, 4.50, 3.99, NULL, '/api/v1/upload/file/product/474ec98b40cb49038ed38144fa290d4b.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:46:12', '2026-09-01 17:46:12', 1, 1, 0);
INSERT INTO `pms_product` VALUES (18, 1, 'P1788256099821', '2300000000055', '新鲜土鸡蛋', '新鲜土鸡蛋', NULL, 104, 17, NULL, '30 枚 / 盒', '件', 8.10, 12.80, 11.20, NULL, '/api/v1/upload/file/product/f13098e5e9a74f9bbddc057b3281f38e.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:48:20', '2026-09-01 17:48:20', 1, 1, 0);
INSERT INTO `pms_product` VALUES (19, 1, 'P1788256134333', '2300000000062', '猪前腿肉', '猪前腿肉', NULL, 104, 18, NULL, '500g / 份', '件', 16.30, 22.90, 20.90, NULL, '/api/v1/upload/file/product/5cb1365bf7664595ba2fdb0c5d95cd7b.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:48:54', '2026-09-01 17:48:54', 1, 1, 0);
INSERT INTO `pms_product` VALUES (20, 1, 'P1788256163385', '2400000000079', '冷冻巴沙鱼柳', '冷冻巴沙鱼柳', NULL, 105, 20, NULL, '1000g / 袋', '件', 10.40, 15.90, 14.20, NULL, '/api/v1/upload/file/product/3fd9e31208344ed8b7190962ee4d9cd7.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:49:23', '2026-09-01 17:49:23', 1, 1, 0);
INSERT INTO `pms_product` VALUES (21, 1, 'P1788256202293', '2400000000086', '海虾冷冻大虾', '海虾冷冻大虾', NULL, 105, 20, NULL, '500g / 袋', '件', 26.00, 36.90, 33.90, NULL, '/api/v1/upload/file/product/837c613522674d7c81fe8cdf43cccac7.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:50:02', '2026-09-01 17:50:02', 1, 1, 0);
INSERT INTO `pms_product` VALUES (22, 1, 'P1788256412488', '6903148041068', '海飞丝去屑洗发水', '海飞cha去屑洗发水', NULL, 106, 21, NULL, '750ml / 瓶', '件', 27.20, 39.90, 35.90, NULL, '/api/v1/upload/file/product/67bb150dda7b48c6ac3808c897331072.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:53:32', '2026-09-03 18:26:35', 1, 1, 0);
INSERT INTO `pms_product` VALUES (23, 1, 'P1788256461666', '6903148044205', '舒肤佳沐浴露', '舒肤zhan沐浴露', NULL, 106, 22, NULL, '720ml / 瓶', '件', 16.10, 24.80, 22.30, NULL, '/api/v1/upload/file/product/c1e7b1111a8043f19ba52a9e8bcd0f34.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:54:22', '2026-09-03 18:26:33', 1, 1, 0);
INSERT INTO `pms_product` VALUES (24, 1, 'P1788256582580', '6920354503414', '高露洁冰爽牙膏', '高露洁冰爽牙膏', NULL, 107, 23, NULL, '180g / 支', '件', 10.20, 16.50, 14.80, NULL, '/api/v1/upload/file/product/d12a2407a34841ddacc5023b0c524aba.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:56:23', '2026-09-03 18:26:30', 1, 1, 0);
INSERT INTO `pms_product` VALUES (25, 1, 'P1788256617103', '6922168802448', '维达卷纸', '维达卷纸', NULL, 108, 24, NULL, '10 卷 / 提', '件', 20.50, 29.90, 26.90, NULL, '/api/v1/upload/file/product/40555cbebdeb45d69bccdbe7a7da246f.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:56:57', '2026-09-03 18:26:28', 1, 1, 0);
INSERT INTO `pms_product` VALUES (26, 1, 'P1788256779342', '6902022110388', '蓝月亮洗衣液', '蓝月long洗衣液', NULL, 108, 25, NULL, '3kg / 瓶', '件', 31.60, 45.00, 40.80, NULL, '/api/v1/upload/file/product/34a1e00969b5478f9e119fe2763b683b.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 17:59:39', '2026-09-03 18:26:25', 1, 1, 0);
INSERT INTO `pms_product` VALUES (27, 1, 'P1788256812139', '6940096031225', '美的不锈钢汤勺', '美的bi锈钢汤勺', NULL, 110, 26, NULL, '1 把 / 个', '件', 7.80, 12.90, 11.50, NULL, '/api/v1/upload/file/product/dce28fb4ebe84f23969e2b77602fbd44.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 18:00:12', '2026-09-03 18:26:22', 1, 1, 0);
INSERT INTO `pms_product` VALUES (28, 1, 'P1788256846145', '6935349200614', '家用加厚垃圾袋', '家用加厚垃圾袋', NULL, 114, 27, NULL, '100 只 / 包', '件', 5.40, 9.90, 8.80, NULL, '/api/v1/upload/file/product/37a4bde8a20942e8bdad9b6e1659e4f2.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 18:00:46', '2026-09-03 18:26:20', 1, 1, 0);
INSERT INTO `pms_product` VALUES (29, 1, 'P1788257030160', '6927804081108', '晨光中性笔', '晨光chui性笔', NULL, 113, 28, NULL, '1 支 / 盒', '件', 1.30, 2.50, 2.20, NULL, '/api/v1/upload/file/product/0d2c6e0310fa4edf96806ae8714b321d.png', 1, 0, 0, 0, 0, NULL, '2026-09-01 18:03:50', '2026-09-03 18:13:14', 1, 1, 0);

-- ----------------------------
-- Table structure for pms_supplier
-- ----------------------------
DROP TABLE IF EXISTS `pms_supplier`;
CREATE TABLE `pms_supplier`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `supplier_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '供应商编号',
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '供应商名称',
  `contact` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '联系人',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '联系电话',
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '地址',
  `bank_account` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '银行账号',
  `bank_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '开户行',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_supplier_no`(`tenant_id`, `supplier_no`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '供应商表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of pms_supplier
-- ----------------------------
INSERT INTO `pms_supplier` VALUES (1, 1, 'SUP001', '华润万家供应商', '张经理', '13800138001', '', '', '', 1, NULL, '2026-09-02 08:48:23', '2026-09-02 08:48:23', NULL, NULL, 0);
INSERT INTO `pms_supplier` VALUES (2, 1, 'SUP002', '中粮集团', '李经理', '13900139000', NULL, NULL, NULL, 1, NULL, '2026-09-02 08:48:23', '2026-09-02 08:48:23', NULL, NULL, 0);
INSERT INTO `pms_supplier` VALUES (3, 1, 'SUP003', '伊利乳业', '王经理', '13700137000', NULL, NULL, NULL, 1, NULL, '2026-09-02 08:48:23', '2026-09-02 08:48:23', NULL, NULL, 0);

-- ----------------------------
-- Table structure for sys_dict
-- ----------------------------
DROP TABLE IF EXISTS `sys_dict`;
CREATE TABLE `sys_dict`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `dict_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '字典类型',
  `dict_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '字典编码',
  `dict_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '字典名称',
  `dict_value` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '字典值',
  `sort` int NOT NULL DEFAULT 0 COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `remark` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `deleted` int NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_dict_type_code`(`dict_type`, `dict_code`) USING BTREE,
  INDEX `idx_dict_type`(`dict_type`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '数据字典表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_dict
-- ----------------------------

-- ----------------------------
-- Table structure for sys_login_log
-- ----------------------------
DROP TABLE IF EXISTS `sys_login_log`;
CREATE TABLE `sys_login_log`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL DEFAULT 0 COMMENT '租户ID',
  `user_id` bigint NULL DEFAULT NULL COMMENT '用户ID',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '用户名',
  `login_type` tinyint NOT NULL COMMENT '登录类型：1-后台登录 2-POS登录',
  `login_ip` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '登录IP',
  `login_location` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '登录地点',
  `browser` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '浏览器',
  `os` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '操作系统',
  `status` tinyint NOT NULL COMMENT '登录状态：0-失败 1-成功',
  `msg` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '提示消息',
  `login_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '登录时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_user_id`(`user_id`) USING BTREE,
  INDEX `idx_login_time`(`login_time`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '登录日志表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_login_log
-- ----------------------------

-- ----------------------------
-- Table structure for sys_menu
-- ----------------------------
DROP TABLE IF EXISTS `sys_menu`;
CREATE TABLE `sys_menu`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `parent_id` bigint NOT NULL DEFAULT 0 COMMENT '父菜单ID（0表示顶级菜单）',
  `menu_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '菜单名称',
  `menu_type` tinyint NOT NULL COMMENT '菜单类型：1-目录 2-菜单 3-按钮',
  `path` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '路由地址',
  `component` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '组件路径',
  `permission` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '权限标识（如 product:add）',
  `icon` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '图标',
  `sort` int NOT NULL DEFAULT 0 COMMENT '排序',
  `visible` tinyint NOT NULL DEFAULT 1 COMMENT '是否可见：0-隐藏 1-显示',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `deleted` tinyint NOT NULL DEFAULT 0,
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_parent_id`(`parent_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 805 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '菜单权限表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_menu
-- ----------------------------
INSERT INTO `sys_menu` VALUES (1, 0, '平台管理', 0, '/platform', NULL, NULL, 'ri:admin-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (2, 0, '工作台', 0, '/dashboard', NULL, NULL, 'ri:pie-chart-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (3, 0, '收银管理', 0, '/pos', NULL, NULL, 'ri:scan-line', 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (4, 0, '商品管理', 0, '/product', NULL, NULL, 'ri:shopping-bag-line', 5, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (5, 0, '采购管理', 0, '/purchase', NULL, NULL, 'ri:shopping-cart-2-line', 6, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (6, 0, '订单管理', 0, '/order', NULL, NULL, 'ri:file-list-3-line', 4, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (7, 0, '仓库管理', 0, '/warehouse', NULL, NULL, 'ri:archive-drawer-line', 7, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (8, 0, '财务管理', 0, '/finance', NULL, NULL, 'ri:money-cny-circle-line', 9, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (9, 0, '租户管理', 0, '/tenant', NULL, NULL, 'ri:store-2-line', 10, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (10, 0, '系统管理', 0, '/system', NULL, NULL, 'ri:user-3-line', 11, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (11, 0, '会员管理', 0, '/member', NULL, NULL, 'ri:user-star-line', 8, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (101, 1, '系统管理工作台', 1, '/platform/workbench', '/platform/PlatformWorkbench.vue', 'platform:workbench:view', 'ri:bar-chart-box-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (201, 2, '经营驾驶舱', 1, '/dashboard/console', '/dashboard/Console.vue', 'dashboard:console:view', 'ri:home-smile-2-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (202, 2, '经营分析', 1, '/dashboard/analysis', '/dashboard/Analysis.vue', 'dashboard:analysis:view', 'ri:line-chart-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (301, 3, '收银台', 1, '/pos/checkout', '/pos/PosCheckout.vue', 'pos:checkout:view', 'ri:scan-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (401, 4, '商品列表', 1, '/product/list', '/product/ProductList.vue', 'pms:product:list', 'ri:shopping-bag-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (402, 4, '商品分类', 1, '/product/category', '/product/ProductCategory.vue', 'pms:category:list', 'ri:apps-2-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (403, 4, '供应商管理', 1, '/product/supplier', '/product/ProductSupplier.vue', 'pms:supplier:list', 'ri:truck-line', 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (411, 401, '商品新增', 2, NULL, NULL, 'pms:product:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (412, 401, '商品编辑', 2, NULL, NULL, 'pms:product:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (413, 401, '商品删除', 2, NULL, NULL, 'pms:product:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (421, 402, '分类新增', 2, NULL, NULL, 'pms:category:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (422, 402, '分类编辑', 2, NULL, NULL, 'pms:category:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (423, 402, '分类删除', 2, NULL, NULL, 'pms:category:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (431, 403, '供应商新增', 2, NULL, NULL, 'pms:supplier:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (432, 403, '供应商编辑', 2, NULL, NULL, 'pms:supplier:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (433, 403, '供应商删除', 2, NULL, NULL, 'pms:supplier:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (501, 5, '采购单', 1, '/purchase/list', '/purchase/PurchaseList.vue', 'pms:purchase:list', 'ri:file-list-2-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (511, 501, '采购新增', 2, NULL, NULL, 'pms:purchase:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (512, 501, '采购编辑', 2, NULL, NULL, 'pms:purchase:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (513, 501, '采购删除', 2, NULL, NULL, 'pms:purchase:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (601, 6, '销售订单', 1, '/order/sales', '/order/OrderSales.vue', 'oms:order:list', 'ri:file-list-3-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (602, 6, '退货退款', 1, '/order/returns', '/order/OrderReturns.vue', 'oms:order:return:list', 'ri:arrow-go-back-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (611, 601, '订单导出', 2, NULL, NULL, 'oms:order:export', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (612, 601, '订单取消', 2, NULL, NULL, 'oms:order:cancel', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (613, 601, '订单完成', 2, NULL, NULL, 'oms:order:complete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (614, 601, '订单退款', 2, NULL, NULL, 'oms:order:refund', NULL, 4, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (621, 602, '新增退货', 2, NULL, NULL, 'oms:order:return:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (701, 7, '库存查询', 1, '/warehouse/stock', '/warehouse/stock', 'wms:stock:list', 'ri:box-3-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (702, 7, '入库管理', 1, '/warehouse/inbound', '/warehouse/inbound', 'wms:stock:inbound:list', 'ri:download-2-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (703, 7, '出库管理', 1, '/warehouse/outbound', '/warehouse/outbound', 'wms:stock:outbound:list', 'ri:upload-2-line', 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (721, 702, '新增入库', 2, NULL, NULL, 'wms:stock:inbound:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (731, 703, '新增出库', 2, NULL, NULL, 'wms:stock:outbound:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (801, 8, '收支流水', 1, '/finance/flow', '/finance/FinanceFlow.vue', 'finance:flow:list', 'ri:money-cny-circle-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (802, 8, '日结管理', 1, '/finance/daily', '/finance/FinanceDaily.vue', 'finance:daily:list', 'ri:bank-card-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (803, 8, '经营报表', 1, '/finance/report', '/finance/FinanceReport.vue', 'finance:report:list', 'ri:line-chart-line', 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (804, 8, '支付账户', 1, '/finance/account', '/finance/FinanceAccount.vue', 'finance:account:list', 'ri:wallet-3-line', 4, 1, 1, 0, '2026-10-19 10:00:00', '2026-10-19 10:00:00');
INSERT INTO `sys_menu` VALUES (811, 801, '新增收支', 2, NULL, NULL, 'finance:flow:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (821, 802, '生成日结', 2, NULL, NULL, 'finance:daily:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (841, 804, '账户新增', 2, NULL, NULL, 'finance:account:add', NULL, 1, 1, 1, 0, '2026-10-19 10:00:00', '2026-10-19 10:00:00');
INSERT INTO `sys_menu` VALUES (842, 804, '账户编辑', 2, NULL, NULL, 'finance:account:edit', NULL, 2, 1, 1, 0, '2026-10-19 10:00:00', '2026-10-19 10:00:00');
INSERT INTO `sys_menu` VALUES (843, 804, '账户删除', 2, NULL, NULL, 'finance:account:delete', NULL, 3, 1, 1, 0, '2026-10-19 10:00:00', '2026-10-19 10:00:00');
INSERT INTO `sys_menu` VALUES (901, 9, '租户列表', 1, '/tenant/list', '/tenant/TenantList.vue', 'sys:tenant:list', 'ri:building-2-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (902, 9, '品牌门店', 1, '/tenant/store', '/tenant/TenantStore.vue', 'sys:store:list', 'ri:store-3-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (903, 9, '套餐管理', 1, '/tenant/plan', '/tenant/TenantPlan.vue', 'sys:plan:list', 'ri:vip-crown-2-line', 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (911, 901, '租户新增', 2, NULL, NULL, 'sys:tenant:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (912, 901, '租户编辑', 2, NULL, NULL, 'sys:tenant:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (913, 901, '租户删除', 2, NULL, NULL, 'sys:tenant:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (921, 902, '门店新增', 2, NULL, NULL, 'sys:store:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (922, 902, '门店编辑', 2, NULL, NULL, 'sys:store:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (923, 902, '门店删除', 2, NULL, NULL, 'sys:store:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (931, 903, '套餐新增', 2, NULL, NULL, 'sys:plan:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (932, 903, '套餐编辑', 2, NULL, NULL, 'sys:plan:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1001, 10, '用户管理', 1, '/system/user', '/system/User.vue', 'sys:user:list', 'ri:user-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1002, 10, '角色管理', 1, '/system/role', '/system/Role.vue', 'sys:role:list', 'ri:user-settings-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1003, 10, '菜单管理', 1, '/system/menu', '/system/Menus.vue', 'sys:menu:list', 'ri:menu-line', 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1004, 10, '个人中心', 1, '/system/user-center', '/system/UserCenter.vue', 'sys:user:profile', 'ri:user-line', 4, 0, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1005, 10, '操作日志', 1, '/system/operation-log', '/system/OperationLog.vue', 'sys:operation:list', 'ri:file-list-3-line', 5, 1, 1, 0, '2026-10-20 10:00:00', '2026-10-20 10:00:00');
INSERT INTO `sys_menu` VALUES (1006, 10, '登录日志', 1, '/system/login-log', '/system/LoginLog.vue', 'sys:login:list', 'ri:login-circle-line', 6, 1, 1, 0, '2026-10-20 10:00:00', '2026-10-20 10:00:00');
INSERT INTO `sys_menu` VALUES (1011, 1001, '用户新增', 2, NULL, NULL, 'sys:user:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1012, 1001, '用户编辑', 2, NULL, NULL, 'sys:user:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1013, 1001, '用户删除', 2, NULL, NULL, 'sys:user:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1014, 1001, '重置密码', 2, NULL, NULL, 'sys:user:resetpwd', NULL, 4, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1015, 1001, '模拟登录', 2, NULL, NULL, 'sys:user:impersonate', NULL, 5, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1021, 1002, '角色新增', 2, NULL, NULL, 'sys:role:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1022, 1002, '角色编辑', 2, NULL, NULL, 'sys:role:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1023, 1002, '角色删除', 2, NULL, NULL, 'sys:role:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1031, 1003, '菜单新增', 2, NULL, NULL, 'sys:menu:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1032, 1003, '菜单编辑', 2, NULL, NULL, 'sys:menu:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1033, 1003, '菜单删除', 2, NULL, NULL, 'sys:menu:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1101, 11, '会员列表', 1, '/member/list', '/member/MemberList.vue', 'ums:member:list', 'ri:user-star-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1111, 1101, '会员新增', 2, NULL, NULL, 'ums:member:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1112, 1101, '会员编辑', 2, NULL, NULL, 'ums:member:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1113, 1101, '会员删除', 2, NULL, NULL, 'ums:member:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1114, 1101, '会员充值', 2, NULL, NULL, 'ums:member:recharge', NULL, 4, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');

-- ----------------------------
-- Table structure for sys_operation_log
-- ----------------------------
DROP TABLE IF EXISTS `sys_operation_log`;
CREATE TABLE `sys_operation_log`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL DEFAULT 0 COMMENT '租户ID',
  `module` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '操作模块',
  `operation` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '操作类型（增/删/改/查）',
  `description` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '操作描述（动态，如：模拟登录用户「xxx」）',
  `method` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '请求方法',
  `url` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '请求URL',
  `params` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '请求参数',
  `result` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '响应结果',
  `status` tinyint NOT NULL COMMENT '操作状态：0-失败 1-成功',
  `error_msg` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL COMMENT '错误信息',
  `ip` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '操作IP',
  `user_id` bigint NULL DEFAULT NULL COMMENT '操作人ID',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '操作人用户名',
  `duration` bigint NULL DEFAULT NULL COMMENT '耗时（毫秒）',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_user_id`(`user_id`) USING BTREE,
  INDEX `idx_create_time`(`create_time`) USING BTREE,
  INDEX `idx_module`(`module`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '操作日志表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Table structure for sys_payment_method
-- ----------------------------
DROP TABLE IF EXISTS `sys_payment_method`;
CREATE TABLE `sys_payment_method`  (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '支付方式名称',
  `code` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL COMMENT '编码：cash/wechat/alipay/card/stored',
  `icon` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL COMMENT '图标',
  `sort` int NOT NULL DEFAULT 0 COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `balance` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '账户余额',
  `remark` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `create_by` bigint NULL DEFAULT NULL,
  `update_by` bigint NULL DEFAULT NULL,
  `deleted` tinyint NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_code`(`tenant_id`, `code`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci COMMENT = '支付方式表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_payment_method
-- ----------------------------
INSERT INTO `sys_payment_method` VALUES (1, 1, '现金', 'cash', NULL, 1, 1, 1000.00, '', '2026-09-02 15:02:09', '2026-09-02 15:45:30', NULL, NULL, 0);
INSERT INTO `sys_payment_method` VALUES (2, 1, '微信支付', 'wechat', NULL, 2, 1, 20102.50, NULL, '2026-09-02 15:02:09', '2026-09-04 10:53:29', NULL, NULL, 0);
INSERT INTO `sys_payment_method` VALUES (3, 1, '支付宝', 'alipay', NULL, 3, 1, 50000.00, NULL, '2026-09-02 15:02:09', '2026-09-02 15:02:09', NULL, NULL, 0);
INSERT INTO `sys_payment_method` VALUES (4, 1, '建设银行柘城支行', 'card', NULL, 4, 1, 300000.00, '', '2026-09-02 15:02:09', '2026-09-02 20:56:00', NULL, NULL, 0);
INSERT INTO `sys_payment_method` VALUES (5, 1, '会员储值卡', 'stored', NULL, 5, 1, 0.00, '', '2026-09-02 15:02:09', '2026-09-02 20:56:09', NULL, NULL, 0);

-- ----------------------------
-- Table structure for sys_role
-- ----------------------------
DROP TABLE IF EXISTS `sys_role`;
CREATE TABLE `sys_role`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `role_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '角色名称',
  `role_code` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '角色编码',
  `description` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '角色描述',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `sort` int NOT NULL DEFAULT 0 COMMENT '排序',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_role_code`(`tenant_id`, `role_code`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 10 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '角色表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_role
-- ----------------------------
INSERT INTO `sys_role` VALUES (1, 1, '租户管理员', 'TENANT_ADMIN', '租户最高管理员，拥有所有业务模块权限', 1, 1, '2026-09-05 14:19:40', '2026-09-05 14:19:40', NULL, NULL, 0);
INSERT INTO `sys_role` VALUES (2, 1, '店长', 'STORE_MANAGER', '门店店长，管理商品、库存、订单、会员', 1, 2, '2026-09-05 14:19:40', '2026-09-05 14:19:40', NULL, NULL, 0);
INSERT INTO `sys_role` VALUES (3, 1, '收银员', 'CASHIER', '收银员，负责收银和会员管理', 1, 3, '2026-09-05 14:19:40', '2026-09-05 14:19:40', NULL, NULL, 0);
INSERT INTO `sys_role` VALUES (4, 1, '仓管员', 'WAREHOUSE_KEEPER', '仓管员，负责库存管理', 1, 4, '2026-09-05 14:19:40', '2026-09-05 14:19:40', NULL, NULL, 0);
INSERT INTO `sys_role` VALUES (9, 1, '系统管理员', 'sysAdmin', '', 1, 0, '2026-09-06 17:25:32', '2026-09-06 17:25:32', NULL, NULL, 0);

-- ----------------------------
-- Table structure for sys_role_menu
-- ----------------------------
DROP TABLE IF EXISTS `sys_role_menu`;
CREATE TABLE `sys_role_menu`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `role_id` bigint NOT NULL COMMENT '角色ID',
  `menu_id` bigint NOT NULL COMMENT '菜单ID',
  `deleted` int NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_role_menu`(`role_id`, `menu_id`) USING BTREE,
  INDEX `idx_role_id`(`role_id`) USING BTREE,
  INDEX `idx_menu_id`(`menu_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 438 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '角色菜单关联表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_role_menu
-- ----------------------------
INSERT INTO `sys_role_menu` VALUES (1, 9, 1, 0);
INSERT INTO `sys_role_menu` VALUES (2, 9, 101, 0);
INSERT INTO `sys_role_menu` VALUES (3, 9, 2, 0);
INSERT INTO `sys_role_menu` VALUES (4, 9, 201, 0);
INSERT INTO `sys_role_menu` VALUES (5, 9, 202, 0);
INSERT INTO `sys_role_menu` VALUES (6, 9, 3, 0);
INSERT INTO `sys_role_menu` VALUES (7, 9, 301, 0);
INSERT INTO `sys_role_menu` VALUES (8, 9, 4, 0);
INSERT INTO `sys_role_menu` VALUES (9, 9, 401, 0);
INSERT INTO `sys_role_menu` VALUES (10, 9, 411, 0);
INSERT INTO `sys_role_menu` VALUES (11, 9, 412, 0);
INSERT INTO `sys_role_menu` VALUES (12, 9, 413, 0);
INSERT INTO `sys_role_menu` VALUES (13, 9, 402, 0);
INSERT INTO `sys_role_menu` VALUES (14, 9, 421, 0);
INSERT INTO `sys_role_menu` VALUES (15, 9, 422, 0);
INSERT INTO `sys_role_menu` VALUES (16, 9, 423, 0);
INSERT INTO `sys_role_menu` VALUES (17, 9, 403, 0);
INSERT INTO `sys_role_menu` VALUES (18, 9, 431, 0);
INSERT INTO `sys_role_menu` VALUES (19, 9, 432, 0);
INSERT INTO `sys_role_menu` VALUES (20, 9, 433, 0);
INSERT INTO `sys_role_menu` VALUES (21, 9, 5, 0);
INSERT INTO `sys_role_menu` VALUES (22, 9, 501, 0);
INSERT INTO `sys_role_menu` VALUES (23, 9, 511, 0);
INSERT INTO `sys_role_menu` VALUES (24, 9, 512, 0);
INSERT INTO `sys_role_menu` VALUES (25, 9, 513, 0);
INSERT INTO `sys_role_menu` VALUES (26, 9, 6, 0);
INSERT INTO `sys_role_menu` VALUES (27, 9, 601, 0);
INSERT INTO `sys_role_menu` VALUES (28, 9, 611, 0);
INSERT INTO `sys_role_menu` VALUES (29, 9, 612, 0);
INSERT INTO `sys_role_menu` VALUES (30, 9, 613, 0);
INSERT INTO `sys_role_menu` VALUES (31, 9, 614, 0);
INSERT INTO `sys_role_menu` VALUES (32, 9, 602, 0);
INSERT INTO `sys_role_menu` VALUES (33, 9, 621, 0);
INSERT INTO `sys_role_menu` VALUES (34, 9, 7, 0);
INSERT INTO `sys_role_menu` VALUES (35, 9, 701, 0);
INSERT INTO `sys_role_menu` VALUES (36, 9, 702, 0);
INSERT INTO `sys_role_menu` VALUES (37, 9, 721, 0);
INSERT INTO `sys_role_menu` VALUES (38, 9, 703, 0);
INSERT INTO `sys_role_menu` VALUES (39, 9, 731, 0);

INSERT INTO `sys_role_menu` VALUES (44, 9, 8, 0);
INSERT INTO `sys_role_menu` VALUES (45, 9, 801, 0);
INSERT INTO `sys_role_menu` VALUES (46, 9, 811, 0);
INSERT INTO `sys_role_menu` VALUES (47, 9, 802, 0);
INSERT INTO `sys_role_menu` VALUES (48, 9, 821, 0);
INSERT INTO `sys_role_menu` VALUES (49, 9, 803, 0);
INSERT INTO `sys_role_menu` VALUES (50, 9, 9, 0);
INSERT INTO `sys_role_menu` VALUES (51, 9, 901, 0);
INSERT INTO `sys_role_menu` VALUES (52, 9, 911, 0);
INSERT INTO `sys_role_menu` VALUES (53, 9, 912, 0);
INSERT INTO `sys_role_menu` VALUES (54, 9, 913, 0);
INSERT INTO `sys_role_menu` VALUES (55, 9, 902, 0);
INSERT INTO `sys_role_menu` VALUES (56, 9, 921, 0);
INSERT INTO `sys_role_menu` VALUES (57, 9, 922, 0);
INSERT INTO `sys_role_menu` VALUES (58, 9, 923, 0);
INSERT INTO `sys_role_menu` VALUES (59, 9, 903, 0);
INSERT INTO `sys_role_menu` VALUES (60, 9, 931, 0);
INSERT INTO `sys_role_menu` VALUES (61, 9, 932, 0);
INSERT INTO `sys_role_menu` VALUES (62, 9, 10, 0);
INSERT INTO `sys_role_menu` VALUES (63, 9, 1001, 0);
INSERT INTO `sys_role_menu` VALUES (64, 9, 1011, 0);
INSERT INTO `sys_role_menu` VALUES (65, 9, 1012, 0);
INSERT INTO `sys_role_menu` VALUES (66, 9, 1013, 0);
INSERT INTO `sys_role_menu` VALUES (67, 9, 1014, 0);
INSERT INTO `sys_role_menu` VALUES (68, 9, 1015, 0);
INSERT INTO `sys_role_menu` VALUES (69, 9, 1002, 0);
INSERT INTO `sys_role_menu` VALUES (70, 9, 1021, 0);
INSERT INTO `sys_role_menu` VALUES (71, 9, 1022, 0);
INSERT INTO `sys_role_menu` VALUES (72, 9, 1023, 0);
INSERT INTO `sys_role_menu` VALUES (73, 9, 1003, 0);
INSERT INTO `sys_role_menu` VALUES (74, 9, 1031, 0);
INSERT INTO `sys_role_menu` VALUES (75, 9, 1032, 0);
INSERT INTO `sys_role_menu` VALUES (76, 9, 1033, 0);
INSERT INTO `sys_role_menu` VALUES (77, 9, 1004, 0);
INSERT INTO `sys_role_menu` VALUES (204, 9, 11, 0);
INSERT INTO `sys_role_menu` VALUES (205, 9, 1101, 0);
INSERT INTO `sys_role_menu` VALUES (206, 9, 1111, 0);
INSERT INTO `sys_role_menu` VALUES (207, 9, 1112, 0);
INSERT INTO `sys_role_menu` VALUES (208, 9, 1113, 0);
INSERT INTO `sys_role_menu` VALUES (209, 9, 1114, 0);
INSERT INTO `sys_role_menu` VALUES (222, 9, 804, 0);
INSERT INTO `sys_role_menu` VALUES (223, 9, 841, 0);
INSERT INTO `sys_role_menu` VALUES (224, 9, 842, 0);
INSERT INTO `sys_role_menu` VALUES (225, 9, 843, 0);
INSERT INTO `sys_role_menu` VALUES (234, 9, 1005, 0);
INSERT INTO `sys_role_menu` VALUES (235, 9, 1006, 0);
INSERT INTO `sys_role_menu` VALUES (78, 1, 2, 0);
INSERT INTO `sys_role_menu` VALUES (79, 1, 201, 0);
INSERT INTO `sys_role_menu` VALUES (80, 1, 202, 0);
INSERT INTO `sys_role_menu` VALUES (81, 1, 3, 0);
INSERT INTO `sys_role_menu` VALUES (82, 1, 301, 0);
INSERT INTO `sys_role_menu` VALUES (83, 1, 4, 0);
INSERT INTO `sys_role_menu` VALUES (84, 1, 401, 0);
INSERT INTO `sys_role_menu` VALUES (85, 1, 411, 0);
INSERT INTO `sys_role_menu` VALUES (86, 1, 412, 0);
INSERT INTO `sys_role_menu` VALUES (87, 1, 413, 0);
INSERT INTO `sys_role_menu` VALUES (88, 1, 402, 0);
INSERT INTO `sys_role_menu` VALUES (89, 1, 421, 0);
INSERT INTO `sys_role_menu` VALUES (90, 1, 422, 0);
INSERT INTO `sys_role_menu` VALUES (91, 1, 423, 0);
INSERT INTO `sys_role_menu` VALUES (92, 1, 403, 0);
INSERT INTO `sys_role_menu` VALUES (93, 1, 431, 0);
INSERT INTO `sys_role_menu` VALUES (94, 1, 432, 0);
INSERT INTO `sys_role_menu` VALUES (95, 1, 433, 0);
INSERT INTO `sys_role_menu` VALUES (96, 1, 5, 0);
INSERT INTO `sys_role_menu` VALUES (97, 1, 501, 0);
INSERT INTO `sys_role_menu` VALUES (98, 1, 511, 0);
INSERT INTO `sys_role_menu` VALUES (99, 1, 512, 0);
INSERT INTO `sys_role_menu` VALUES (100, 1, 513, 0);
INSERT INTO `sys_role_menu` VALUES (101, 1, 6, 0);
INSERT INTO `sys_role_menu` VALUES (102, 1, 601, 0);
INSERT INTO `sys_role_menu` VALUES (103, 1, 611, 0);
INSERT INTO `sys_role_menu` VALUES (104, 1, 612, 0);
INSERT INTO `sys_role_menu` VALUES (105, 1, 613, 0);
INSERT INTO `sys_role_menu` VALUES (106, 1, 614, 0);
INSERT INTO `sys_role_menu` VALUES (107, 1, 602, 0);
INSERT INTO `sys_role_menu` VALUES (108, 1, 621, 0);
INSERT INTO `sys_role_menu` VALUES (109, 1, 7, 0);
INSERT INTO `sys_role_menu` VALUES (110, 1, 701, 0);
INSERT INTO `sys_role_menu` VALUES (111, 1, 702, 0);
INSERT INTO `sys_role_menu` VALUES (112, 1, 721, 0);
INSERT INTO `sys_role_menu` VALUES (113, 1, 703, 0);
INSERT INTO `sys_role_menu` VALUES (114, 1, 731, 0);

INSERT INTO `sys_role_menu` VALUES (119, 1, 8, 0);
INSERT INTO `sys_role_menu` VALUES (120, 1, 801, 0);
INSERT INTO `sys_role_menu` VALUES (121, 1, 811, 0);
INSERT INTO `sys_role_menu` VALUES (122, 1, 802, 0);
INSERT INTO `sys_role_menu` VALUES (123, 1, 821, 0);
INSERT INTO `sys_role_menu` VALUES (124, 1, 803, 0);
INSERT INTO `sys_role_menu` VALUES (125, 1, 10, 0);
INSERT INTO `sys_role_menu` VALUES (126, 1, 1001, 0);
INSERT INTO `sys_role_menu` VALUES (127, 1, 1011, 0);
INSERT INTO `sys_role_menu` VALUES (128, 1, 1012, 0);
INSERT INTO `sys_role_menu` VALUES (129, 1, 1013, 0);
INSERT INTO `sys_role_menu` VALUES (130, 1, 1002, 0);
INSERT INTO `sys_role_menu` VALUES (131, 1, 1021, 0);
INSERT INTO `sys_role_menu` VALUES (132, 1, 1022, 0);
INSERT INTO `sys_role_menu` VALUES (133, 1, 1023, 0);
INSERT INTO `sys_role_menu` VALUES (134, 1, 1003, 0);
INSERT INTO `sys_role_menu` VALUES (135, 1, 1031, 0);
INSERT INTO `sys_role_menu` VALUES (136, 1, 1032, 0);
INSERT INTO `sys_role_menu` VALUES (137, 1, 1033, 0);
INSERT INTO `sys_role_menu` VALUES (203, 1, 1014, 0);
INSERT INTO `sys_role_menu` VALUES (210, 1, 11, 0);
INSERT INTO `sys_role_menu` VALUES (211, 1, 1101, 0);
INSERT INTO `sys_role_menu` VALUES (212, 1, 1111, 0);
INSERT INTO `sys_role_menu` VALUES (213, 1, 1112, 0);
INSERT INTO `sys_role_menu` VALUES (214, 1, 1113, 0);
INSERT INTO `sys_role_menu` VALUES (215, 1, 1114, 0);
INSERT INTO `sys_role_menu` VALUES (226, 1, 804, 0);
INSERT INTO `sys_role_menu` VALUES (227, 1, 841, 0);
INSERT INTO `sys_role_menu` VALUES (228, 1, 842, 0);
INSERT INTO `sys_role_menu` VALUES (229, 1, 843, 0);
INSERT INTO `sys_role_menu` VALUES (236, 1, 1005, 0);
INSERT INTO `sys_role_menu` VALUES (237, 1, 1006, 0);
INSERT INTO `sys_role_menu` VALUES (138, 2, 2, 0);
INSERT INTO `sys_role_menu` VALUES (139, 2, 201, 0);
INSERT INTO `sys_role_menu` VALUES (140, 2, 202, 0);
INSERT INTO `sys_role_menu` VALUES (141, 2, 3, 0);
INSERT INTO `sys_role_menu` VALUES (142, 2, 301, 0);
INSERT INTO `sys_role_menu` VALUES (143, 2, 4, 0);
INSERT INTO `sys_role_menu` VALUES (144, 2, 401, 0);
INSERT INTO `sys_role_menu` VALUES (145, 2, 411, 0);
INSERT INTO `sys_role_menu` VALUES (146, 2, 412, 0);
INSERT INTO `sys_role_menu` VALUES (147, 2, 413, 0);
INSERT INTO `sys_role_menu` VALUES (148, 2, 402, 0);
INSERT INTO `sys_role_menu` VALUES (149, 2, 421, 0);
INSERT INTO `sys_role_menu` VALUES (150, 2, 422, 0);
INSERT INTO `sys_role_menu` VALUES (151, 2, 423, 0);
INSERT INTO `sys_role_menu` VALUES (152, 2, 403, 0);
INSERT INTO `sys_role_menu` VALUES (153, 2, 431, 0);
INSERT INTO `sys_role_menu` VALUES (154, 2, 432, 0);
INSERT INTO `sys_role_menu` VALUES (155, 2, 433, 0);
INSERT INTO `sys_role_menu` VALUES (156, 2, 6, 0);
INSERT INTO `sys_role_menu` VALUES (157, 2, 601, 0);
INSERT INTO `sys_role_menu` VALUES (158, 2, 611, 0);
INSERT INTO `sys_role_menu` VALUES (159, 2, 612, 0);
INSERT INTO `sys_role_menu` VALUES (160, 2, 613, 0);
INSERT INTO `sys_role_menu` VALUES (161, 2, 614, 0);
INSERT INTO `sys_role_menu` VALUES (162, 2, 602, 0);
INSERT INTO `sys_role_menu` VALUES (163, 2, 621, 0);
INSERT INTO `sys_role_menu` VALUES (164, 2, 7, 0);
INSERT INTO `sys_role_menu` VALUES (165, 2, 701, 0);
INSERT INTO `sys_role_menu` VALUES (166, 2, 702, 0);
INSERT INTO `sys_role_menu` VALUES (167, 2, 721, 0);
INSERT INTO `sys_role_menu` VALUES (168, 2, 703, 0);
INSERT INTO `sys_role_menu` VALUES (169, 2, 731, 0);

INSERT INTO `sys_role_menu` VALUES (174, 2, 8, 0);
INSERT INTO `sys_role_menu` VALUES (175, 2, 801, 0);
INSERT INTO `sys_role_menu` VALUES (176, 2, 811, 0);
INSERT INTO `sys_role_menu` VALUES (177, 2, 802, 0);
INSERT INTO `sys_role_menu` VALUES (178, 2, 821, 0);
INSERT INTO `sys_role_menu` VALUES (179, 2, 803, 0);
INSERT INTO `sys_role_menu` VALUES (216, 2, 11, 0);
INSERT INTO `sys_role_menu` VALUES (217, 2, 1101, 0);
INSERT INTO `sys_role_menu` VALUES (218, 2, 1111, 0);
INSERT INTO `sys_role_menu` VALUES (219, 2, 1112, 0);
INSERT INTO `sys_role_menu` VALUES (220, 2, 1113, 0);
INSERT INTO `sys_role_menu` VALUES (221, 2, 1114, 0);
INSERT INTO `sys_role_menu` VALUES (230, 2, 804, 0);
INSERT INTO `sys_role_menu` VALUES (231, 2, 841, 0);
INSERT INTO `sys_role_menu` VALUES (232, 2, 842, 0);
INSERT INTO `sys_role_menu` VALUES (233, 2, 843, 0);
INSERT INTO `sys_role_menu` VALUES (180, 3, 2, 0);
INSERT INTO `sys_role_menu` VALUES (181, 3, 201, 0);
INSERT INTO `sys_role_menu` VALUES (182, 3, 3, 0);
INSERT INTO `sys_role_menu` VALUES (183, 3, 301, 0);
INSERT INTO `sys_role_menu` VALUES (184, 3, 6, 0);
INSERT INTO `sys_role_menu` VALUES (185, 3, 601, 0);
INSERT INTO `sys_role_menu` VALUES (186, 3, 611, 0);
INSERT INTO `sys_role_menu` VALUES (187, 3, 602, 0);
INSERT INTO `sys_role_menu` VALUES (188, 3, 621, 0);
INSERT INTO `sys_role_menu` VALUES (189, 4, 7, 0);
INSERT INTO `sys_role_menu` VALUES (190, 4, 701, 0);
INSERT INTO `sys_role_menu` VALUES (191, 4, 702, 0);
INSERT INTO `sys_role_menu` VALUES (192, 4, 721, 0);
INSERT INTO `sys_role_menu` VALUES (193, 4, 703, 0);
INSERT INTO `sys_role_menu` VALUES (194, 4, 731, 0);

INSERT INTO `sys_role_menu` VALUES (199, 4, 4, 0);
INSERT INTO `sys_role_menu` VALUES (200, 4, 401, 0);
INSERT INTO `sys_role_menu` VALUES (201, 4, 402, 0);
INSERT INTO `sys_role_menu` VALUES (202, 4, 403, 0);

-- ----------------------------
-- Table structure for sys_store
-- ----------------------------
DROP TABLE IF EXISTS `sys_store`;
CREATE TABLE `sys_store`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `store_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '门店编号',
  `store_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '门店名称',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '门店地址',
  `contact_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '联系电话',
  `manager_id` bigint NULL DEFAULT NULL COMMENT '店长用户ID',
  `store_type` tinyint NOT NULL DEFAULT 1 COMMENT '门店类型：1-直营店 2-加盟店',
  `business_hours` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '营业时间（如 08:00-22:00）',
  `logo` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '门店Logo',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-装修中 1-营业中 2-暂停营业 3-已关闭',
  `sort` int NOT NULL DEFAULT 0 COMMENT '排序',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_store_no`(`store_no`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_status`(`status`) USING BTREE,
  INDEX `idx_tenant_status`(`tenant_id`, `status`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 3 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '门店信息表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_store
-- ----------------------------
INSERT INTO `sys_store` VALUES (1, 'ST001', '阳光超市总店', 1, '北京市朝阳区建国路88号', NULL, NULL, 1, '08:00-22:00', NULL, 1, 0, NULL, '2026-09-01 23:24:50', '2026-09-01 23:24:50', NULL, NULL, 0);
-- ----------------------------
-- Table structure for sys_tenant
-- ----------------------------
DROP TABLE IF EXISTS `sys_tenant`;
CREATE TABLE `sys_tenant`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '租户编号',
  `tenant_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '租户名称（超市名称）',
  `contact_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '联系人姓名',
  `contact_phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '联系人电话',
  `contact_email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '联系人邮箱',
  `logo` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '企业Logo',
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '地址',
  `license_no` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '营业执照号',
  `plan_type` tinyint NOT NULL DEFAULT 1 COMMENT '套餐类型：1-基础版 2-专业版 3-企业版',
  `max_stores` int NOT NULL DEFAULT 1 COMMENT '最大门店数',
  `max_users` int NOT NULL DEFAULT 5 COMMENT '最大用户数',
  `expire_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-正常 2-已到期',
  `admin_user_id` bigint NULL DEFAULT NULL COMMENT '管理员用户ID',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_no`(`tenant_no`) USING BTREE,
  INDEX `idx_status`(`status`) USING BTREE,
  INDEX `idx_expire_time`(`expire_time`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '租户信息表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_tenant
-- ----------------------------
INSERT INTO `sys_tenant` VALUES (1, 'T001', '故辰', '管理员', '13800000000', '', NULL, '', '', 1, 100, 1000, '2099-12-31 23:59:59', 1, NULL, '', '2026-09-01 23:24:03', '2026-09-01 23:24:03', NULL, NULL, 0);

-- ----------------------------
-- Table structure for sys_user
-- ----------------------------
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID（0表示超级管理员）',
  `username` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '用户名',
  `password` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '密码（BCrypt加密）',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '真实姓名',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '手机号',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '邮箱',
  `avatar` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '头像URL',
  `store_id` bigint NULL DEFAULT NULL COMMENT '所属门店ID',
  `user_type` tinyint NOT NULL DEFAULT 1 COMMENT '用户类型：1-普通用户 2-系统管理员 3-超级管理员',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-正常',
  `last_login_time` datetime(0) NULL DEFAULT NULL COMMENT '最后登录时间',
  `last_login_ip` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '最后登录IP',
  `login_count` int NOT NULL DEFAULT 0 COMMENT '登录次数',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_username`(`tenant_id`, `username`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_store_id`(`store_id`) USING BTREE,
  INDEX `idx_phone`(`phone`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '系统用户表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_user
-- ----------------------------
INSERT INTO `sys_user` VALUES (1, 1, 'admin', '$2a$10$MJumaSWZiEW73NOiGiAx/.IPEGG3yTzmCbG3SXYflWAaVl8K70PVq', '故辰店长', '13800138000', NULL, NULL, 1, 1, 1, '2026-09-07 14:04:23', NULL, 68, NULL, '2026-09-01 12:07:20', '2026-09-07 14:04:23', 1, 1, 0);
INSERT INTO `sys_user` VALUES (2, 1, 'sysadmin', '$2a$10$MJumaSWZiEW73NOiGiAx/.IPEGG3yTzmCbG3SXYflWAaVl8K70PVq', '系统管理员', '13800138001', NULL, NULL, 1, 3, 1, '2026-09-07 14:04:15', NULL, 48, NULL, '2026-09-01 12:07:23', '2026-09-07 14:04:15', 1, 2, 0);
INSERT INTO `sys_user` VALUES (7, 1, 'linlin', '$2a$10$0gN0X21EgZiMEOknbIQaK.ZhbKxYx4XV./TOlC7WxsawgUZ4TiquG', '琳琳', '13999999992', NULL, NULL, NULL, 1, 1, '2026-09-06 18:37:38', NULL, 3, NULL, '2026-09-06 18:14:10', '2026-09-06 18:37:38', NULL, 7, 0);

-- ----------------------------
-- Table structure for sys_user_role
-- ----------------------------
DROP TABLE IF EXISTS `sys_user_role`;
CREATE TABLE `sys_user_role`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `user_id` bigint NOT NULL COMMENT '用户ID',
  `role_id` bigint NOT NULL COMMENT '角色ID',
  `deleted` int NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_user_role`(`user_id`, `role_id`) USING BTREE,
  INDEX `idx_user_id`(`user_id`) USING BTREE,
  INDEX `idx_role_id`(`role_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '用户角色关联表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of sys_user_role
-- ----------------------------
INSERT INTO `sys_user_role` VALUES (1, 5, 6, 0);
INSERT INTO `sys_user_role` VALUES (2, 6, 7, 0);
INSERT INTO `sys_user_role` VALUES (7, 7, 3, 0);

-- ----------------------------
-- Table structure for ums_member
-- ----------------------------
DROP TABLE IF EXISTS `ums_member`;
CREATE TABLE `ums_member`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `member_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '会员编号',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '会员姓名',
  `phone` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '手机号',
  `gender` tinyint NOT NULL DEFAULT 0 COMMENT '性别：0-未知 1-男 2-女',
  `birthday` date NULL DEFAULT NULL COMMENT '生日',
  `level_id` bigint NULL DEFAULT NULL COMMENT '会员等级ID',
  `points` int NOT NULL DEFAULT 0 COMMENT '积分余额',
  `balance` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '储值余额',
  `total_consume` decimal(12, 2) NOT NULL DEFAULT 0.00 COMMENT '累计消费',
  `total_points` int NOT NULL DEFAULT 0 COMMENT '累计获得积分',
  `email` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '邮箱',
  `address` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '地址',
  `avatar` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '头像',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-正常',
  `register_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '注册时间',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_member_no`(`tenant_id`, `member_no`) USING BTREE,
  UNIQUE INDEX `uk_tenant_phone`(`tenant_id`, `phone`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_level_id`(`level_id`) USING BTREE,
  INDEX `idx_name`(`name`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '会员信息表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of ums_member
-- ----------------------------
INSERT INTO `ums_member` VALUES (1, 1, 'M1788243464892', '五六七', '13333333333', 1, NULL, 1, 0, 101.20, 8.80, 8, NULL, NULL, NULL, 1, '2026-09-01 14:17:45', NULL, '2026-09-01 14:17:45', '2026-09-04 10:26:20', 1, 1, 0);

-- ----------------------------
-- Table structure for ums_member_level
-- ----------------------------
DROP TABLE IF EXISTS `ums_member_level`;
CREATE TABLE `ums_member_level`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '等级名称',
  `code` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '等级编码',
  `min_points` int NOT NULL DEFAULT 0 COMMENT '最低积分门槛',
  `discount` decimal(3, 2) NOT NULL DEFAULT 1.00 COMMENT '折扣率（0.90=9折）',
  `description` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '等级描述',
  `sort` int NOT NULL DEFAULT 0 COMMENT '排序',
  `status` tinyint NOT NULL DEFAULT 1 COMMENT '状态：0-禁用 1-启用',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_min_points`(`min_points`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 5 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '会员等级表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of ums_member_level
-- ----------------------------
INSERT INTO `ums_member_level` VALUES (1, 1, '普通会员', 'NORMAL', 0, 1.00, '注册即为普通会员', 1, 1, '2026-09-01 12:07:27', '2026-09-01 12:07:27', 0);
INSERT INTO `ums_member_level` VALUES (2, 1, '银卡会员', 'SILVER', 500, 0.98, '累计500积分升级', 2, 1, '2026-09-01 12:07:27', '2026-09-01 12:07:27', 0);
INSERT INTO `ums_member_level` VALUES (3, 1, '金卡会员', 'GOLD', 2000, 0.95, '累计2000积分升级', 3, 1, '2026-09-01 12:07:27', '2026-09-01 12:07:27', 0);
INSERT INTO `ums_member_level` VALUES (4, 1, '钻石会员', 'DIAMOND', 5000, 0.90, '累计5000积分升级', 4, 1, '2026-09-01 12:07:27', '2026-09-01 12:07:27', 0);

-- ----------------------------
-- Table structure for ums_member_recharge_log
-- ----------------------------
DROP TABLE IF EXISTS `ums_member_recharge_log`;
CREATE TABLE `ums_member_recharge_log`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `member_id` bigint NOT NULL COMMENT '会员ID',
  `member_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '会员姓名',
  `type` tinyint NOT NULL COMMENT '变动类型：1-充值 2-消费 3-退款 4-调整',
  `amount` decimal(10, 2) NOT NULL COMMENT '变动金额',
  `gift_amount` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '赠送金额',
  `before_balance` decimal(10, 2) NOT NULL COMMENT '变动前余额',
  `after_balance` decimal(10, 2) NOT NULL COMMENT '变动后余额',
  `pay_method` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '支付方式编码',
  `related_order_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '关联订单号',
  `operator_id` bigint NULL DEFAULT NULL COMMENT '操作人ID',
  `operator_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '操作人姓名',
  `remark` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_member_id`(`member_id`) USING BTREE,
  INDEX `idx_type`(`type`) USING BTREE,
  INDEX `idx_create_time`(`create_time`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 2 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '储值变动日志' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of ums_member_recharge_log
-- ----------------------------
INSERT INTO `ums_member_recharge_log` VALUES (1, 1, 1, '五六七', 1, 100.00, 10.00, 0.00, 110.00, 'wechat', NULL, 1, 'admin', '', '2026-09-04 09:55:18');

-- ----------------------------
-- Table structure for wms_purchase_in
-- ----------------------------
DROP TABLE IF EXISTS `wms_purchase_in`;
CREATE TABLE `wms_purchase_in`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `in_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '入库单号',
  `supplier_id` bigint NULL DEFAULT NULL COMMENT '供应商ID',
  `store_id` bigint NOT NULL COMMENT '入库门店ID',
  `total_amount` decimal(12, 2) NOT NULL DEFAULT 0.00 COMMENT '总金额',
  `total_quantity` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '总数量',
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '状态：0-草稿 1-已审核 2-已入库',
  `in_time` datetime(0) NULL DEFAULT NULL COMMENT '入库时间',
  `operator_id` bigint NULL DEFAULT NULL COMMENT '操作人ID',
  `reviewer_id` bigint NULL DEFAULT NULL COMMENT '审核人ID',
  `review_time` datetime(0) NULL DEFAULT NULL COMMENT '审核时间',
  `review_remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '审核备注',
  `stock_in_user_id` bigint NULL DEFAULT NULL COMMENT '入库人ID',
  `stock_in_time` datetime(0) NULL DEFAULT NULL COMMENT '入库时间',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_in_no`(`tenant_id`, `in_no`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_store_id`(`store_id`) USING BTREE,
  INDEX `idx_supplier_id`(`supplier_id`) USING BTREE,
  INDEX `idx_tenant_status`(`tenant_id`, `status`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 6 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '采购入库单' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of wms_purchase_in
-- ----------------------------
INSERT INTO `wms_purchase_in` VALUES (5, 1, 'PI1788482855482', 1, 1, 400.00, 150.00, 2, NULL, 1, 1, '2026-09-04 08:56:07', NULL, 1, '2026-09-04 08:57:20', NULL, '2026-09-04 08:47:35', '2026-09-04 08:47:35', NULL, NULL, 0);

-- ----------------------------
-- Table structure for wms_purchase_in_item
-- ----------------------------
DROP TABLE IF EXISTS `wms_purchase_in_item`;
CREATE TABLE `wms_purchase_in_item`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `in_id` bigint NOT NULL COMMENT '入库单ID',
  `product_id` bigint NOT NULL COMMENT '商品ID',
  `quantity` decimal(10, 2) NOT NULL COMMENT '入库数量',
  `purchase_price` decimal(10, 2) NOT NULL COMMENT '进货单价',
  `total_price` decimal(12, 2) NOT NULL COMMENT '小计金额',
  `batch_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '批次号',
  `expire_time` date NULL DEFAULT NULL COMMENT '过期日期',
  `remark` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `deleted` int NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_in_id`(`in_id`) USING BTREE,
  INDEX `idx_product_id`(`product_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 15 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '采购入库明细' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of wms_purchase_in_item
-- ----------------------------
INSERT INTO `wms_purchase_in_item` VALUES (13, 5, 29, 100.00, 1.30, 130.00, NULL, NULL, NULL, 0);
INSERT INTO `wms_purchase_in_item` VALUES (14, 5, 28, 50.00, 5.40, 270.00, NULL, NULL, NULL, 0);

-- ----------------------------
-- Table structure for wms_stock
-- ----------------------------
DROP TABLE IF EXISTS `wms_stock`;
CREATE TABLE `wms_stock`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `product_id` bigint NOT NULL COMMENT '商品ID',
  `warehouse_quantity` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '仓库库存',
  `shelf_quantity` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '货架库存',
  `avg_cost` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '平均成本价',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `deleted` int NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_product_store`(`tenant_id`, `product_id`, `store_id`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_store_id`(`store_id`) USING BTREE,
  INDEX `idx_product_id`(`product_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 11 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '库存表' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of wms_stock
-- ----------------------------
INSERT INTO `wms_stock` VALUES (9, 1, 1, 29, 50.00, 49.00, 1.30, '2026-09-04 08:57:20', '2026-09-04 09:37:07', 0);
INSERT INTO `wms_stock` VALUES (10, 1, 1, 28, 30.00, 19.00, 5.40, '2026-09-04 08:57:20', '2026-09-04 10:26:20', 0);

-- ----------------------------
-- Table structure for wms_stock_check
-- ----------------------------
DROP TABLE IF EXISTS `wms_stock_check`;
CREATE TABLE `wms_stock_check`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `check_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '盘点单号',
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '状态：0-待盘点 1-盘点中 2-已完成 3-已取消',
  `total_system` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '系统总数量',
  `total_actual` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '实际总数量',
  `total_diff` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '差异总数量',
  `operator_id` bigint NULL DEFAULT NULL COMMENT '盘点人ID',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_check_no`(`tenant_id`, `check_no`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_store_id`(`store_id`) USING BTREE,
  INDEX `idx_status`(`status`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '库存盘点单' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of wms_stock_check
-- ----------------------------

-- ----------------------------
-- Table structure for wms_stock_check_item
-- ----------------------------
DROP TABLE IF EXISTS `wms_stock_check_item`;
CREATE TABLE `wms_stock_check_item`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `check_id` bigint NOT NULL COMMENT '盘点单ID',
  `product_id` bigint NOT NULL COMMENT '商品ID',
  `system_stock` decimal(10, 2) NOT NULL COMMENT '系统库存',
  `actual_stock` decimal(10, 2) NOT NULL COMMENT '实际库存',
  `difference` decimal(10, 2) NOT NULL COMMENT '差异（实际-系统）',
  `remark` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `deleted` int NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_check_id`(`check_id`) USING BTREE,
  INDEX `idx_product_id`(`product_id`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '盘点明细' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of wms_stock_check_item
-- ----------------------------

-- ----------------------------
-- Table structure for wms_stock_log
-- ----------------------------
DROP TABLE IF EXISTS `wms_stock_log`;
CREATE TABLE `wms_stock_log`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `store_id` bigint NOT NULL COMMENT '门店ID',
  `product_id` bigint NOT NULL COMMENT '商品ID',
  `log_type` tinyint NOT NULL COMMENT '变动类型：1-采购入库 2-销售出库 3-调拨 4-报损 5-盘点调整 6-退货',
  `quantity` decimal(10, 2) NOT NULL COMMENT '变动数量（+入库/-出库）',
  `before_stock` decimal(10, 2) NOT NULL COMMENT '变动前库存',
  `after_stock` decimal(10, 2) NOT NULL COMMENT '变动后库存',
  `related_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '关联单据号',
  `related_id` bigint NULL DEFAULT NULL COMMENT '关联单据ID',
  `operator_id` bigint NULL DEFAULT NULL COMMENT '操作人ID',
  `remark` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `deleted` int NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_store_id`(`store_id`) USING BTREE,
  INDEX `idx_product_id`(`product_id`) USING BTREE,
  INDEX `idx_create_time`(`create_time`) USING BTREE,
  INDEX `idx_log_type`(`log_type`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 53 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '库存变动日志' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of wms_stock_log
-- ----------------------------
INSERT INTO `wms_stock_log` VALUES (46, 1, 1, 29, 1, 100.00, 0.00, 100.00, 'PI1788482855482', 5, 1, NULL, '2026-09-04 08:57:20', 0);
INSERT INTO `wms_stock_log` VALUES (47, 1, 1, 28, 1, 50.00, 0.00, 50.00, 'PI1788482855482', 5, 1, NULL, '2026-09-04 08:57:20', 0);
INSERT INTO `wms_stock_log` VALUES (48, 1, 1, 29, 4, 50.00, 100.00, 50.00, 'SO1788484140318', 2, 1, NULL, '2026-09-04 09:15:27', 0);
INSERT INTO `wms_stock_log` VALUES (49, 1, 1, 28, 4, 20.00, 50.00, 30.00, 'SO1788484140318', 2, 1, NULL, '2026-09-04 09:15:27', 0);
INSERT INTO `wms_stock_log` VALUES (50, 1, 1, 29, 4, 1.00, 50.00, 49.00, NULL, 17, 1, NULL, '2026-09-04 09:37:07', 0);
INSERT INTO `wms_stock_log` VALUES (53, 1, 1, 28, 4, 1.00, 20.00, 19.00, NULL, 21, 1, NULL, '2026-09-04 10:26:20', 0);

-- ----------------------------
-- Table structure for wms_stock_out
-- ----------------------------
DROP TABLE IF EXISTS `wms_stock_out`;
CREATE TABLE `wms_stock_out`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id` bigint NOT NULL COMMENT '租户ID',
  `out_no` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL COMMENT '出库单号',
  `out_type` tinyint NOT NULL COMMENT '出库类型：1-销售出库 2-调拨出库 3-报损出库 4-其他',
  `store_id` bigint NOT NULL COMMENT '出库门店ID',
  `target_store_id` bigint NULL DEFAULT NULL COMMENT '目标门店ID（调拨出库时）',
  `order_id` bigint NULL DEFAULT NULL COMMENT '关联订单ID（销售出库时）',
  `total_quantity` decimal(10, 2) NOT NULL DEFAULT 0.00 COMMENT '总出库数量',
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '状态：0-待出库 1-已出库',
  `out_time` datetime(0) NULL DEFAULT NULL COMMENT '出库时间',
  `operator_id` bigint NULL DEFAULT NULL COMMENT '操作人ID',
  `reviewer_id` bigint NULL DEFAULT NULL COMMENT '审核人ID',
  `review_time` datetime(0) NULL DEFAULT NULL COMMENT '审核时间',
  `stock_out_user_id` bigint NULL DEFAULT NULL COMMENT '出库人ID',
  `stock_out_time` datetime(0) NULL DEFAULT NULL COMMENT '出库时间',
  `remark` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `create_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time` datetime(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by` bigint NULL DEFAULT NULL COMMENT '创建人',
  `update_by` bigint NULL DEFAULT NULL COMMENT '更新人',
  `deleted` tinyint NOT NULL DEFAULT 0 COMMENT '删除标志：0-未删除 1-已删除',
  PRIMARY KEY (`id`) USING BTREE,
  UNIQUE INDEX `uk_tenant_out_no`(`tenant_id`, `out_no`) USING BTREE,
  INDEX `idx_tenant_id`(`tenant_id`) USING BTREE,
  INDEX `idx_store_id`(`store_id`) USING BTREE,
  INDEX `idx_order_id`(`order_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 4 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '出库单' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of wms_stock_out
-- ----------------------------
INSERT INTO `wms_stock_out` VALUES (2, 1, 'SO1788484140318', 1, 1, NULL, NULL, 70.00, 1, NULL, 1, NULL, NULL, 1, '2026-09-04 09:15:27', NULL, '2026-09-04 09:09:00', '2026-09-04 09:09:00', NULL, NULL, 0);
INSERT INTO `wms_stock_out` VALUES (3, 1, 'SO1788484548870', 1, 1, NULL, NULL, 1.00, 0, NULL, 1, NULL, NULL, NULL, NULL, NULL, '2026-09-04 09:15:49', '2026-09-04 09:15:49', NULL, NULL, 0);

-- ----------------------------
-- Table structure for wms_stock_out_item
-- ----------------------------
DROP TABLE IF EXISTS `wms_stock_out_item`;
CREATE TABLE `wms_stock_out_item`  (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `out_id` bigint NOT NULL COMMENT '出库单ID',
  `product_id` bigint NOT NULL COMMENT '商品ID',
  `quantity` decimal(10, 2) NOT NULL COMMENT '出库数量',
  `remark` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL DEFAULT NULL COMMENT '备注',
  `deleted` int NULL DEFAULT 0,
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_out_id`(`out_id`) USING BTREE,
  INDEX `idx_product_id`(`product_id`) USING BTREE
) ENGINE = InnoDB AUTO_INCREMENT = 8 CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '出库明细' ROW_FORMAT = Dynamic;

-- ----------------------------
-- Records of wms_stock_out_item
-- ----------------------------
INSERT INTO `wms_stock_out_item` VALUES (5, 2, 29, 50.00, NULL, 0);
INSERT INTO `wms_stock_out_item` VALUES (6, 2, 28, 20.00, NULL, 0);
INSERT INTO `wms_stock_out_item` VALUES (7, 3, 29, 1.00, NULL, 0);

SET FOREIGN_KEY_CHECKS = 1;
