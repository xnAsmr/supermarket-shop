-- ============================================================================
-- 排班模块：数据库表结构 + 初始演示数据
--
-- 执行（可重复执行，幂等）：
--   mysql --default-character-set=utf8mb4 -uroot -p123456 supermarket_erp < upgrade-schedule.sql
-- 依赖：init-test-data.sql（sys_store / sys_user / sys_menu / sys_role 已存在）
-- 顺序：先执行本脚本，再执行 seed-schedule-menu.sql
--
-- 设计说明：
--   1. 四张表：sch_shift(班次模板) / sch_schedule(周班表) /
--      sch_schedule_item(排班明细) / sch_shift_change(调班申请)
--   2. 全部带 tenant_id，按「租户 + 门店」双维度隔离；沿用项目公共审计字段与软删除
--   3. 班次起止时间用 varchar(5)（HH:mm）：前端契约为 string，且项目 JacksonConfig
--      未注册 LocalTime 序列化器
--   4. 明细冗余 shift_start_at / shift_end_at：把「营业日 + 班次时间 + 跨夜标记」
--      归一为真实时刻区间，跨周/跨夜的冲突检测直接比较这两个字段
--   5. 员工复用 sys_user、门店复用 sys_store，不新建主数据表
-- ============================================================================

-- 统一连接排序规则，避免字面量(utf8mb4_0900_ai_ci)与用户变量/表列排序规则冲突
SET NAMES utf8mb4 COLLATE utf8mb4_general_ci;

-- ------------------------------ 1. 班次模板 ------------------------------
CREATE TABLE IF NOT EXISTS `sch_shift` (
  `id`            bigint       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id`     bigint       NOT NULL COMMENT '租户ID',
  `store_id`      bigint       NULL COMMENT '归属门店ID；NULL=租户通用班次',
  `shift_name`    varchar(50)  NOT NULL COMMENT '班次名称',
  `shift_code`    varchar(50)  NOT NULL COMMENT '班次编码',
  `start_time`    varchar(5)   NOT NULL COMMENT '开始时间 HH:mm',
  `end_time`      varchar(5)   NOT NULL COMMENT '结束时间 HH:mm',
  `cross_day`     tinyint      NOT NULL DEFAULT 0 COMMENT '是否跨夜 0否 1是',
  `color`         varchar(20)  NOT NULL DEFAULT '#3D7FFF' COMMENT '班次卡片配色',
  `min_staff`     int          NOT NULL DEFAULT 1 COMMENT '最低在岗人数（发布校验）',
  `role_name`     varchar(50)  NOT NULL DEFAULT '' COMMENT '岗位要求（对应前端 role）',
  `rest_minutes`  int          NOT NULL DEFAULT 0 COMMENT '休息分钟数（工时统计扣除）',
  `sort`          int          NOT NULL DEFAULT 0 COMMENT '排序',
  `enabled`       tinyint      NOT NULL DEFAULT 1 COMMENT '是否启用 0停用 1启用',
  `remark`        varchar(500) NULL COMMENT '备注',
  `create_time`   datetime(0)  NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time`   datetime(0)  NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by`     bigint       NULL COMMENT '创建人',
  `update_by`     bigint       NULL COMMENT '更新人',
  `deleted`       tinyint      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0未删 1已删',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_tenant_store` (`tenant_id`, `store_id`) USING BTREE,
  INDEX `idx_tenant_code` (`tenant_id`, `shift_code`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '排班-班次模板' ROW_FORMAT = Dynamic;

-- ------------------------------ 2. 周班表 ------------------------------
CREATE TABLE IF NOT EXISTS `sch_schedule` (
  `id`               bigint       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id`        bigint       NOT NULL COMMENT '租户ID',
  `store_id`         bigint       NOT NULL COMMENT '门店ID',
  `week_start_date`  date         NOT NULL COMMENT '周一日期（一周一张班表）',
  `status`           tinyint      NOT NULL DEFAULT 0 COMMENT '状态 0草稿 1已发布 2已归档',
  `publish_time`     datetime(0)  NULL COMMENT '发布时间',
  `publisher_id`     bigint       NULL COMMENT '发布人',
  `remark`           varchar(500) NULL COMMENT '备注',
  `create_time`      datetime(0)  NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time`      datetime(0)  NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by`        bigint       NULL COMMENT '创建人',
  `update_by`        bigint       NULL COMMENT '更新人',
  `deleted`          tinyint      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0未删 1已删',
  PRIMARY KEY (`id`) USING BTREE,
  -- 班表不做删除（只流转状态），唯一键不含 deleted 也不会产生软删冲突
  UNIQUE INDEX `uk_tenant_store_week` (`tenant_id`, `store_id`, `week_start_date`) USING BTREE,
  INDEX `idx_tenant_status` (`tenant_id`, `status`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '排班-周班表' ROW_FORMAT = Dynamic;

-- ------------------------------ 3. 排班明细 ------------------------------
CREATE TABLE IF NOT EXISTS `sch_schedule_item` (
  `id`              bigint       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id`       bigint       NOT NULL COMMENT '租户ID',
  `schedule_id`     bigint       NOT NULL COMMENT '周班表ID',
  `store_id`        bigint       NOT NULL COMMENT '门店ID',
  `shift_id`        bigint       NOT NULL COMMENT '班次ID',
  `work_date`       date         NOT NULL COMMENT '营业日（跨夜班记开始日）',
  `user_id`         bigint       NOT NULL COMMENT '员工ID（sys_user.id）',
  `user_name`       varchar(50)  NOT NULL DEFAULT '' COMMENT '员工姓名快照',
  `role_code`       varchar(50)  NOT NULL DEFAULT '' COMMENT '岗位快照',
  `shift_start_at`  datetime(0)  NOT NULL COMMENT '归一化开始时刻',
  `shift_end_at`    datetime(0)  NOT NULL COMMENT '归一化结束时刻（跨夜已+1天）',
  `status`          tinyint      NOT NULL DEFAULT 0 COMMENT '状态 0正常 1已取消 2已调出',
  `source`          tinyint      NOT NULL DEFAULT 0 COMMENT '来源 0手工 1复制上周 2调班生成',
  `create_time`     datetime(0)  NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time`     datetime(0)  NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by`       bigint       NULL COMMENT '创建人',
  `update_by`       bigint       NULL COMMENT '更新人',
  `deleted`         tinyint      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0未删 1已删',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_schedule` (`schedule_id`, `deleted`) USING BTREE,
  INDEX `idx_user_date` (`tenant_id`, `user_id`, `work_date`, `deleted`) USING BTREE,
  INDEX `idx_tenant_range` (`tenant_id`, `shift_start_at`, `shift_end_at`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '排班-排班明细' ROW_FORMAT = Dynamic;

-- ------------------------------ 4. 调班申请 ------------------------------
CREATE TABLE IF NOT EXISTS `sch_shift_change` (
  `id`               bigint       NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `tenant_id`        bigint       NOT NULL COMMENT '租户ID',
  `store_id`         bigint       NOT NULL COMMENT '门店ID',
  `applicant_id`     bigint       NOT NULL COMMENT '申请人ID',
  `applicant_name`   varchar(50)  NOT NULL DEFAULT '' COMMENT '申请人姓名快照',
  `target_user_id`   bigint       NOT NULL COMMENT '接班人ID',
  `target_user_name` varchar(50)  NOT NULL DEFAULT '' COMMENT '接班人姓名快照',
  `work_date`        date         NOT NULL COMMENT '调班营业日',
  `shift_id`         bigint       NOT NULL COMMENT '班次ID',
  `change_type`      tinyint      NOT NULL DEFAULT 2 COMMENT '类型 1换班 2替班 3请假',
  `reason`           varchar(500) NOT NULL DEFAULT '' COMMENT '调班原因',
  `status`           tinyint      NOT NULL DEFAULT 0 COMMENT '状态 0待审批 1已通过 2已拒绝',
  `reviewer_id`      bigint       NULL COMMENT '审批人ID',
  `reviewer_name`    varchar(50)  NULL COMMENT '审批人姓名快照',
  `review_time`      datetime(0)  NULL COMMENT '审批时间',
  `create_time`      datetime(0)  NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
  `update_time`      datetime(0)  NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0) COMMENT '更新时间',
  `create_by`        bigint       NULL COMMENT '创建人',
  `update_by`        bigint       NULL COMMENT '更新人',
  `deleted`          tinyint      NOT NULL DEFAULT 0 COMMENT '逻辑删除 0未删 1已删',
  PRIMARY KEY (`id`) USING BTREE,
  INDEX `idx_tenant_status` (`tenant_id`, `status`, `deleted`) USING BTREE,
  INDEX `idx_store_date` (`tenant_id`, `store_id`, `work_date`) USING BTREE
) ENGINE = InnoDB CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci COMMENT = '排班-调班申请' ROW_FORMAT = Dynamic;

-- ============================================================================
-- 初始数据（幂等）：班次模板 + 本周草稿班表 + 演示明细 + 调班申请
-- 说明：门店/员工均通过子查询动态取得，避免硬编码 ID 在不同环境失效
-- ============================================================================
SET @tid = (SELECT `tenant_id` FROM `sys_store` WHERE `deleted` = 0 ORDER BY `id` LIMIT 1);
SET @sid = (SELECT `id` FROM `sys_store` WHERE `deleted` = 0 ORDER BY `id` LIMIT 1);
SET @wk  = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);

-- 三个标准班次（租户通用，store_id = NULL）
INSERT INTO `sch_shift`
  (`tenant_id`, `store_id`, `shift_name`, `shift_code`, `start_time`, `end_time`, `cross_day`, `color`, `min_staff`, `role_name`, `rest_minutes`, `sort`, `enabled`, `remark`, `create_time`, `update_time`, `deleted`)
SELECT @tid, NULL, '早班', 'MORNING', '08:00', '16:00', 0, '#3D7FFF', 2, '收银员', 30, 1, 1, '开业高峰，至少 2 人在岗', NOW(), NOW(), 0
WHERE @tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `sch_shift` WHERE `tenant_id` = @tid AND `shift_code` = 'MORNING' AND `deleted` = 0);

INSERT INTO `sch_shift`
  (`tenant_id`, `store_id`, `shift_name`, `shift_code`, `start_time`, `end_time`, `cross_day`, `color`, `min_staff`, `role_name`, `rest_minutes`, `sort`, `enabled`, `remark`, `create_time`, `update_time`, `deleted`)
SELECT @tid, NULL, '晚班', 'EVENING', '16:00', '22:00', 0, '#2ED3B7', 2, '收银员', 20, 2, 1, NULL, NOW(), NOW(), 0
WHERE @tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `sch_shift` WHERE `tenant_id` = @tid AND `shift_code` = 'EVENING' AND `deleted` = 0);

INSERT INTO `sch_shift`
  (`tenant_id`, `store_id`, `shift_name`, `shift_code`, `start_time`, `end_time`, `cross_day`, `color`, `min_staff`, `role_name`, `rest_minutes`, `sort`, `enabled`, `remark`, `create_time`, `update_time`, `deleted`)
SELECT @tid, NULL, '夜班', 'NIGHT', '22:00', '06:00', 1, '#7C5CFF', 1, '值班', 60, 3, 1, '闭店盘点与补货，次日 06:00 下班', NOW(), NOW(), 0
WHERE @tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM `sch_shift` WHERE `tenant_id` = @tid AND `shift_code` = 'NIGHT' AND `deleted` = 0);

-- 本周草稿班表
INSERT INTO `sch_schedule`
  (`tenant_id`, `store_id`, `week_start_date`, `status`, `remark`, `create_time`, `update_time`, `deleted`)
SELECT @tid, @sid, @wk, 0, '系统初始化的本周草稿班表', NOW(), NOW(), 0
WHERE @sid IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM `sch_schedule` WHERE `tenant_id` = @tid AND `store_id` = @sid AND `week_start_date` = @wk AND `deleted` = 0
);

SET @sch_id = (SELECT `id` FROM `sch_schedule` WHERE `tenant_id` = @tid AND `store_id` = @sid AND `week_start_date` = @wk AND `deleted` = 0 LIMIT 1);
SET @sh1 = (SELECT `id` FROM `sch_shift` WHERE `tenant_id` = @tid AND `shift_code` = 'MORNING' AND `deleted` = 0 LIMIT 1);
SET @sh2 = (SELECT `id` FROM `sch_shift` WHERE `tenant_id` = @tid AND `shift_code` = 'EVENING' AND `deleted` = 0 LIMIT 1);
SET @sh3 = (SELECT `id` FROM `sch_shift` WHERE `tenant_id` = @tid AND `shift_code` = 'NIGHT' AND `deleted` = 0 LIMIT 1);
-- 演示员工只取本租户、本门店或总部未分配门店的在职用户，保证与接口返回的员工字典一致
SET @u1 = (SELECT `id` FROM `sys_user` WHERE `deleted` = 0 AND `status` = 1 AND `tenant_id` = @tid AND (`store_id` = @sid OR `store_id` IS NULL) ORDER BY `id` LIMIT 1);
SET @u2 = (SELECT `id` FROM `sys_user` WHERE `deleted` = 0 AND `status` = 1 AND `tenant_id` = @tid AND (`store_id` = @sid OR `store_id` IS NULL) ORDER BY `id` LIMIT 1 OFFSET 1);
SET @u3 = (SELECT `id` FROM `sys_user` WHERE `deleted` = 0 AND `status` = 1 AND `tenant_id` = @tid AND (`store_id` = @sid OR `store_id` IS NULL) ORDER BY `id` LIMIT 1 OFFSET 2);

-- 演示明细：覆盖本周 7 天，遵循「一人一天一班」且真实时间段不重叠，
-- 因此开箱即可通过发布校验；想验证冲突可把同一员工再加入同一天的另一个班次。
INSERT INTO `sch_schedule_item`
  (`tenant_id`, `schedule_id`, `store_id`, `shift_id`, `work_date`, `user_id`, `user_name`, `role_code`,
   `shift_start_at`, `shift_end_at`, `status`, `source`, `create_time`, `update_time`, `deleted`)
SELECT @tid, @sch_id, @sid, v.shift_id, v.work_date, u.id, u.name, '店员',
       CONCAT(v.work_date, ' ', sh.start_time, ':00'),
       CONCAT(DATE_ADD(v.work_date, INTERVAL sh.cross_day DAY), ' ', sh.end_time, ':00'),
       0, 0, NOW(), NOW(), 0
FROM (
  SELECT @sh1 AS shift_id, DATE_ADD(@wk, INTERVAL 0 DAY) AS work_date, @u1 AS uid
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 0 DAY), @u2
  UNION ALL SELECT @sh2, DATE_ADD(@wk, INTERVAL 0 DAY), @u3
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 1 DAY), @u1
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 1 DAY), @u3
  UNION ALL SELECT @sh2, DATE_ADD(@wk, INTERVAL 1 DAY), @u2
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 2 DAY), @u2
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 2 DAY), @u3
  UNION ALL SELECT @sh2, DATE_ADD(@wk, INTERVAL 2 DAY), @u1
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 3 DAY), @u1
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 3 DAY), @u2
  UNION ALL SELECT @sh3, DATE_ADD(@wk, INTERVAL 3 DAY), @u3
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 4 DAY), @u1
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 4 DAY), @u3
  UNION ALL SELECT @sh2, DATE_ADD(@wk, INTERVAL 4 DAY), @u2
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 5 DAY), @u2
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 5 DAY), @u3
  UNION ALL SELECT @sh2, DATE_ADD(@wk, INTERVAL 5 DAY), @u1
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 6 DAY), @u1
  UNION ALL SELECT @sh1, DATE_ADD(@wk, INTERVAL 6 DAY), @u2
  UNION ALL SELECT @sh3, DATE_ADD(@wk, INTERVAL 6 DAY), @u3
) v
JOIN `sch_shift` sh ON sh.`id` = v.shift_id AND sh.`deleted` = 0
JOIN `sys_user` u ON u.`id` = v.uid AND u.`deleted` = 0
WHERE @sch_id IS NOT NULL AND @sh1 IS NOT NULL AND @sh2 IS NOT NULL AND @sh3 IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `sch_schedule_item` WHERE `schedule_id` = @sch_id AND `deleted` = 0);

-- 演示调班申请
INSERT INTO `sch_shift_change`
  (`tenant_id`, `store_id`, `applicant_id`, `applicant_name`, `target_user_id`, `target_user_name`,
   `work_date`, `shift_id`, `change_type`, `reason`, `status`, `create_time`, `update_time`, `deleted`)
SELECT @tid, @sid, a.id, a.name, b.id, b.name, DATE_ADD(@wk, INTERVAL 2 DAY), @sh2, 2,
       '家中有事，已与同事协商替班', 0, NOW(), NOW(), 0
FROM `sys_user` a JOIN `sys_user` b
WHERE a.`id` = @u1 AND b.`id` = @u2 AND @sch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `sch_shift_change` WHERE `tenant_id` = @tid AND `deleted` = 0);

INSERT INTO `sch_shift_change`
  (`tenant_id`, `store_id`, `applicant_id`, `applicant_name`, `target_user_id`, `target_user_name`,
   `work_date`, `shift_id`, `change_type`, `reason`, `status`, `reviewer_name`, `review_time`, `create_time`, `update_time`, `deleted`)
SELECT @tid, @sid, a.id, a.name, b.id, b.name, DATE_ADD(@wk, INTERVAL 1 DAY), @sh1, 1,
       '周末调休，双方互换班次', 1, '店长', NOW(), NOW(), NOW(), 0
FROM `sys_user` a JOIN `sys_user` b
WHERE a.`id` = @u3 AND b.`id` = @u1 AND @sch_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM `sch_shift_change` WHERE `tenant_id` = @tid AND `status` = 1 AND `deleted` = 0);
