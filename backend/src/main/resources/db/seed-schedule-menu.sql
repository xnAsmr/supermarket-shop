-- ============================================================================
-- 排班模块：菜单与按钮权限种子
--
-- 执行（可重复执行，幂等）：
--   mysql --default-character-set=utf8mb4 -uroot -p supermarket_erp < seed-schedule-menu.sql
-- 依赖：upgrade-schedule.sql（先建表，再插菜单）
--
-- 说明：
--   1. 前端 VITE_ACCESS_MODE=backend，菜单来自 GET /api/v1/menus/current。
--      mapMenuTree 以 sys_menu.path 作为路由 component，因此 path 必须是
--      /schedule/roster 这样的完整绝对路径，与 router/modules/schedule.ts 一致。
--   2. menu_type：0目录 / 1页面 / 2按钮（与 seed-sys-menu.sql 保持一致）。
--   3. ID 段：目录沿用 1200，页面/按钮使用 3001~3032。
--      注意 1201~1207 已被「消息通知」模块占用，不可复用；
--      早前误用 1201~1232 的脚本会被下面的兼容修复清理。
--   4. 授权采用「sys_role 全量 CROSS JOIN」，避免不同环境 role_id 不一致导致菜单不可见。
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_general_ci;

-- 兼容修复：清理早期误用 1201~1232 段时插入的排班按钮及其授权。
-- 1201~1207 属于消息通知模块，不在此清理范围内。
DELETE FROM `sys_role_menu`
WHERE `menu_id` IN (1211, 1212, 1213, 1214, 1221, 1222, 1223, 1231, 1232);
DELETE FROM `sys_menu`
WHERE `id` IN (1211, 1212, 1213, 1214, 1221, 1222, 1223, 1231, 1232);

-- ------------------------------ 目录 ------------------------------
INSERT INTO `sys_menu`
  (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES
  (1200, 0, '排班管理', 0, '/schedule', '/schedule', NULL, 'ri:calendar-line', 12, 1, 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `parent_id` = VALUES(`parent_id`), `menu_name` = VALUES(`menu_name`), `menu_type` = VALUES(`menu_type`),
  `path` = VALUES(`path`), `component` = VALUES(`component`), `icon` = VALUES(`icon`),
  `sort` = VALUES(`sort`), `visible` = VALUES(`visible`), `status` = VALUES(`status`),
  `deleted` = 0, `update_time` = NOW();

-- ------------------------------ 页面 ------------------------------
INSERT INTO `sys_menu`
  (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES
  (3001, 1200, '周排班',   1, '/schedule/roster', '/schedule/roster', 'sch:roster:view', 'ri:file-list-3-line', 1, 1, 1, 0, NOW(), NOW()),
  (3002, 1200, '班次管理', 1, '/schedule/shift',  '/schedule/shift',  'sch:shift:list',  'ri:time-line',       2, 1, 1, 0, NOW(), NOW()),
  (3003, 1200, '调班审批', 1, '/schedule/change', '/schedule/change', 'sch:change:list', 'ri:exchange-2-line', 3, 1, 1, 0, NOW(), NOW()),
  (3004, 1200, '我的排班', 1, '/schedule/mine',   '/schedule/mine',   'sch:mine:view',   'ri:user-line',       4, 1, 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `parent_id` = VALUES(`parent_id`), `menu_name` = VALUES(`menu_name`), `menu_type` = VALUES(`menu_type`),
  `path` = VALUES(`path`), `component` = VALUES(`component`), `permission` = VALUES(`permission`),
  `icon` = VALUES(`icon`), `sort` = VALUES(`sort`), `visible` = VALUES(`visible`),
  `status` = VALUES(`status`), `deleted` = 0, `update_time` = NOW();

-- ------------------------------ 按钮权限 ------------------------------
INSERT INTO `sys_menu`
  (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES
  (3011, 3001, '保存排班', 2, NULL, NULL, 'sch:roster:save',    NULL, 1, 1, 1, 0, NOW(), NOW()),
  (3012, 3001, '发布班表', 2, NULL, NULL, 'sch:roster:publish', NULL, 2, 1, 1, 0, NOW(), NOW()),
  (3013, 3001, '撤回发布', 2, NULL, NULL, 'sch:roster:revoke',  NULL, 3, 1, 1, 0, NOW(), NOW()),
  (3014, 3001, '复制上周', 2, NULL, NULL, 'sch:roster:copy',    NULL, 4, 1, 1, 0, NOW(), NOW()),
  (3021, 3002, '新增班次', 2, NULL, NULL, 'sch:shift:add',      NULL, 1, 1, 1, 0, NOW(), NOW()),
  (3022, 3002, '编辑班次', 2, NULL, NULL, 'sch:shift:edit',     NULL, 2, 1, 1, 0, NOW(), NOW()),
  (3023, 3002, '删除班次', 2, NULL, NULL, 'sch:shift:delete',   NULL, 3, 1, 1, 0, NOW(), NOW()),
  (3031, 3003, '发起调班', 2, NULL, NULL, 'sch:change:add',     NULL, 1, 1, 1, 0, NOW(), NOW()),
  (3032, 3003, '审批调班', 2, NULL, NULL, 'sch:change:review',  NULL, 2, 1, 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `parent_id` = VALUES(`parent_id`), `menu_name` = VALUES(`menu_name`), `menu_type` = VALUES(`menu_type`),
  `permission` = VALUES(`permission`), `sort` = VALUES(`sort`), `visible` = VALUES(`visible`),
  `status` = VALUES(`status`), `deleted` = 0, `update_time` = NOW();

-- ------------------------------ 角色授权 ------------------------------
-- 所有现存角色均授予排班目录、页面与按钮，保证任意测试账号登录后都能看到并使用排班。
-- 超级管理员（user_type=3）不依赖角色授权，permissions 为 *:*:* 直接放行。
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`)
SELECT r.`id`, m.`id`
FROM `sys_role` r
CROSS JOIN `sys_menu` m
WHERE r.`deleted` = 0
  AND (m.`id` = 1200 OR m.`id` BETWEEN 3001 AND 3032)
  AND m.`deleted` = 0;
