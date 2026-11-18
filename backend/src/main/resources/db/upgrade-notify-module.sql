-- ============================================================
-- 消息通知模块升级脚本（增量，不清空现有数据）
-- 内容：
--   1. 平台公告（platform_announcement + platform_announcement_read）
--   2. 租户通知（tenant_notice + tenant_notice_read）
--   3. 事件提醒日志（notify_event_log）
--   4. 菜单与角色授权（消息中心 / 通知管理 / 平台公告管理）
-- 设计要点：
--   - 平台层与租户层数据表、权限严格分开；消息中心为用户侧统一入口
--   - 定时发布不做定时任务：可见性查询统一加 effective_at <= NOW() 判断，到点自动可见
--   - 已读/确认按「用户」维度记录（read/ack），统计由查询聚合得出
-- 适用：MySQL 8.x；幂等：可重复执行
-- ============================================================
-- ------------------------------------------------------------
-- 1. 平台公告（平台层，超管维护，定向租户可见）
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `platform_announcement` (
  `id`                BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`             VARCHAR(200) NOT NULL COMMENT '公告标题',
  `content`           TEXT         NULL COMMENT '公告内容（支持纯文本/换行）',
  `notice_type`       TINYINT      NOT NULL DEFAULT 1 COMMENT '类型：1功能更新 2系统维护 3规则变更',
  `target_scope`      VARCHAR(16)  NOT NULL DEFAULT 'ALL' COMMENT '定向范围：ALL全部租户/PLAN按套餐/ASSIGN指定租户',
  `target_plan_type`  TINYINT      NULL COMMENT 'target_scope=PLAN 时生效（对应 sys_tenant.plan_type）',
  `target_tenant_ids` VARCHAR(1000) NULL COMMENT 'target_scope=ASSIGN 时生效，逗号分隔租户ID',
  `effective_at`      DATETIME     NOT NULL COMMENT '生效时间（可预约，到点自动可见）',
  `expire_at`         DATETIME     NULL COMMENT '失效时间（NULL=长期有效）',
  `require_ack`       TINYINT      NOT NULL DEFAULT 0 COMMENT '是否强制已读确认：0否 1是（重大变更）',
  `target_user_type`  TINYINT      NULL COMMENT '定向用户类型：NULL=目标租户全部用户；2=仅租户内系统管理员(user_type=2)',
  `status`            TINYINT      NOT NULL DEFAULT 0 COMMENT '状态：0草稿 1已发布 2已撤回',
  `publisher_id`      BIGINT       NULL COMMENT '发布人ID',
  `publisher_name`    VARCHAR(64)  NULL COMMENT '发布人姓名',
  `create_by`         BIGINT       NULL,
  `update_by`         BIGINT       NULL,
  `create_time`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`           TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_status_effective` (`status`, `effective_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='平台公告（平台层→租户）';

-- 平台公告已读/确认记录（按用户）
CREATE TABLE IF NOT EXISTS `platform_announcement_read` (
  `id`              BIGINT   NOT NULL AUTO_INCREMENT COMMENT '主键',
  `announcement_id` BIGINT   NOT NULL COMMENT '公告ID',
  `tenant_id`       BIGINT   NOT NULL COMMENT '用户所属租户',
  `user_id`         BIGINT   NOT NULL COMMENT '阅读用户',
  `read_at`         DATETIME NULL COMMENT '阅读时间',
  `ack_at`          DATETIME NULL COMMENT '确认（我已知晓）时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_announcement_user` (`announcement_id`, `user_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='平台公告阅读/确认记录';

-- 兼容旧版：platform_announcement 已存在（无 target_user_type 列）时补列；不存在则跳过
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'platform_announcement' AND column_name = 'target_user_type');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE platform_announcement ADD COLUMN target_user_type TINYINT NULL COMMENT ''定向用户类型：NULL=目标租户全部用户；2=仅租户内系统管理员(user_type=2)''',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 2. 租户通知（租户层，管理员按门店/角色/指定人发送）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tenant_notice` (
  `id`               BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tenant_id`        BIGINT       NOT NULL COMMENT '租户ID（强制隔离）',
  `store_id`         BIGINT       NULL COMMENT '发起门店：NULL=租户总部发起（全租户可见）；非空=仅该门店员工可见',
  `title`            VARCHAR(200) NOT NULL COMMENT '通知标题',
  `content`          TEXT         NULL COMMENT '通知内容',
  `target_scope`     VARCHAR(16)  NOT NULL DEFAULT 'ALL' COMMENT '定向范围：ALL全员/STORE指定门店/ROLE指定角色/USER指定人员',
  `target_store_ids` VARCHAR(500) NULL COMMENT 'target_scope=STORE 时生效，逗号分隔门店ID',
  `target_role_ids`  VARCHAR(500) NULL COMMENT 'target_scope=ROLE 时生效，逗号分隔角色ID（sys_role.id）',
  `target_user_ids`  VARCHAR(1000) NULL COMMENT 'target_scope=USER 时生效，逗号分隔用户ID',
  `sender_id`        BIGINT       NOT NULL COMMENT '发送人ID（后端会话取，不收前端传参）',
  `sender_name`      VARCHAR(64)  NULL COMMENT '发送人姓名',
  `send_time`        DATETIME     NULL COMMENT '发送时间',
  `create_by`        BIGINT       NULL,
  `update_by`        BIGINT       NULL,
  `create_time`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`          TINYINT      NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`, `send_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='租户通知（租户内发送）';

-- 租户通知已读记录（按用户）
CREATE TABLE IF NOT EXISTS `tenant_notice_read` (
  `id`        BIGINT   NOT NULL AUTO_INCREMENT COMMENT '主键',
  `notice_id` BIGINT   NOT NULL COMMENT '通知ID',
  `tenant_id` BIGINT   NOT NULL COMMENT '租户ID',
  `user_id`   BIGINT   NOT NULL COMMENT '阅读用户',
  `read_at`   DATETIME NULL COMMENT '阅读时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notice_user` (`notice_id`, `user_id`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='租户通知阅读记录';

-- ------------------------------------------------------------
-- 3. 事件提醒日志（系统触发，按接收人逐条落库，发送与已读追踪）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notify_event_log` (
  `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
  `tenant_id`  BIGINT       NOT NULL COMMENT '租户ID',
  `store_id`   BIGINT       NULL COMMENT '业务门店（可空）',
  `user_id`    BIGINT       NOT NULL COMMENT '接收人用户ID',
  `event_type` VARCHAR(32)  NOT NULL COMMENT '事件类型：PURCHASE_SUBMIT/PURCHASE_APPROVED/PURCHASE_REVIEW_REVOKED 等',
  `title`      VARCHAR(200) NOT NULL COMMENT '提醒标题',
  `content`    VARCHAR(500) NULL COMMENT '提醒内容',
  `biz_type`   VARCHAR(32)  NULL COMMENT '关联业务类型：PURCHASE_ORDER 等',
  `biz_id`     BIGINT       NULL COMMENT '关联业务ID',
  `is_read`    TINYINT      NOT NULL DEFAULT 0 COMMENT '是否已读：0未读 1已读',
  `read_at`    DATETIME     NULL COMMENT '已读时间',
  `create_time` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_unread` (`tenant_id`, `user_id`, `is_read`),
  KEY `idx_biz` (`biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='事件提醒日志（系统触发）';

-- ------------------------------------------------------------
-- 4. 菜单（幂等 upsert；component 对应前端视图文件，path 与前端路由完整路径严格一致）
--    sys_menu: (id, parent_id, menu_name, menu_type, path, component, permission, icon, sort, visible, status, deleted, create_time, update_time)
--    menu_type: 0=目录 1=菜单 2=按钮
--    路径铁律：sys_menu.path === 前端路由完整路径。
--      - 组件解析：ComponentLoader 按 path 到 views 下找 {path}.vue / {path}/index.vue；
--      - 菜单 key：deriveMenuKey 优先命中「前端路由 path → name」注册表；
--      两者都依赖 path 与前端路由一致，否则 key 退化为组件 basename，
--      多个 index.vue 页面会碰撞成同一个 'Index'，导致角色授权错配、静默丢失。
--    说明：
--     - 消息中心是「收件箱」类功能，所有登录账号都需要，故页面不加权限串、也不做按钮权限，
--       消息中心接口对任何登录用户开放（不受菜单权限约束）。
--     - 平台公告 / 租户通知 需要「菜单 + 按钮权限」：页面菜单控制显隐，按钮菜单(menu_type=2)
--       承载 @PreAuthorize 校验串（后端权限集合仅从 menu_type=2 收集，见 MenuMapper.selectPermissionCodesByUserId）。
--     - 超管(user_type=3)同属租户(tenant_id 非空)，授予 1203/1205 后与其他管理员一样使用租户通知。
-- ------------------------------------------------------------
-- 顶层目录：消息通知（所有登录用户可见；子菜单按角色细分）
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES (12, 0, '消息通知', 0, '/notify', NULL, NULL, 'ri:notification-3-line', 12, 1, 1, 0, '2026-10-24 20:00:00', '2026-10-24 20:00:00')
ON DUPLICATE KEY UPDATE `menu_name` = VALUES(`menu_name`), `path` = VALUES(`path`), `icon` = VALUES(`icon`), `sort` = VALUES(`sort`), `visible` = 1, `status` = 1, `deleted` = 0;
-- 消息中心（用户侧统一入口：系统公告 + 我的通知 + 事件提醒）所有角色可见，无权限串（全员通用）
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES (1201, 12, '消息中心', 1, '/notify/center', '/notify/center/index.vue', '', 'ri:notification-3-line', 1, 1, 1, 0, '2026-10-24 20:00:00', '2026-10-24 20:00:00')
ON DUPLICATE KEY UPDATE `menu_name` = VALUES(`menu_name`), `path` = VALUES(`path`), `component` = VALUES(`component`), `icon` = VALUES(`icon`), `sort` = VALUES(`sort`), `visible` = 1, `status` = 1, `deleted` = 0;
-- 平台公告管理（超管：发布/撤回/定向租户/强制确认/已读统计）页面菜单
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES (1202, 12, '平台公告', 1, '/platform/announcement', '/platform/announcement/index.vue', '', 'ri:megaphone-line', 2, 1, 1, 0, '2026-10-24 20:00:00', '2026-10-24 20:00:00')
ON DUPLICATE KEY UPDATE `menu_name` = VALUES(`menu_name`), `path` = VALUES(`path`), `component` = VALUES(`component`), `icon` = VALUES(`icon`), `sort` = VALUES(`sort`), `visible` = 1, `status` = 1, `deleted` = 0;
-- 平台公告按钮权限（menu_type=2，供 @PreAuthorize 校验）
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES (1204, 1202, '公告管理', 2, '', NULL, 'platform:announcement:manage', '', 1, 1, 1, 0, '2026-10-24 20:00:00', '2026-10-24 20:00:00')
ON DUPLICATE KEY UPDATE `menu_name` = VALUES(`menu_name`), `parent_id` = VALUES(`parent_id`), `permission` = VALUES(`permission`), `visible` = 1, `status` = 1, `deleted` = 0;
-- 租户通知管理（租户管理员/店长：按门店/角色/人员发送 + 已读统计；店长发送范围由后端按门店收敛）页面菜单
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES (1203, 12, '租户通知', 1, '/tenant/notice', '/tenant/notice/index.vue', '', 'ri:send-plane-line', 3, 1, 1, 0, '2026-10-24 20:00:00', '2026-10-24 20:00:00')
ON DUPLICATE KEY UPDATE `menu_name` = VALUES(`menu_name`), `path` = VALUES(`path`), `component` = VALUES(`component`), `icon` = VALUES(`icon`), `sort` = VALUES(`sort`), `visible` = 1, `status` = 1, `deleted` = 0;
-- 租户通知按钮权限（menu_type=2，供 @PreAuthorize 校验）
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES (1205, 1203, '通知管理', 2, '', NULL, 'notify:notice:manage', '', 1, 1, 1, 0, '2026-10-24 20:00:00', '2026-10-24 20:00:00')
ON DUPLICATE KEY UPDATE `menu_name` = VALUES(`menu_name`), `parent_id` = VALUES(`parent_id`), `permission` = VALUES(`permission`), `visible` = 1, `status` = 1, `deleted` = 0;

-- ------------------------------------------------------------
-- 5. 角色授权 sys_role_menu (role_id, menu_id, deleted)
--    角色：1租户管理员 2店长 3收银员 4仓管员 9系统管理员(超管角色，同属租户1，user_type=3)
--    幂等：INSERT IGNORE，可重复执行
-- ------------------------------------------------------------
-- 消息通知目录 + 消息中心：所有角色可见
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (1, 12, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (1, 1201, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (2, 12, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (2, 1201, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (3, 12, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (3, 1201, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (4, 12, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (4, 1201, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (9, 12, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (9, 1201, 0);
-- 平台公告管理：平台系统管理员（role_id=9）
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (9, 1202, 0);
-- 租户通知管理：租户管理员(1) + 店长(2)；超管(9)同属租户(tenant_id 非空)，授权后与其他管理员一样收发
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (1, 1203, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (2, 1203, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (9, 1203, 0);
-- 按钮权限（menu_type=2，后端权限集合来源）：平台公告管理=超管(9)；租户通知管理=租户管理员(1)+店长(2)+超管(9)
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (9, 1204, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (1, 1205, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (2, 1205, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (9, 1205, 0);
