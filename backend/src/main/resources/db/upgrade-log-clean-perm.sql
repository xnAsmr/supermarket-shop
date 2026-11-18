-- ============================================================
-- upgrade-log-clean-perm.sql
-- 日志清理权限（配合「操作日志 / 登录日志」页面的清理按钮）
--
-- 背景：
--   1. 每日 03:30 的 LogCleanTask 已按 erp.log.retain-days（默认 180 天）自动清理，
--      但压测/批量导入瞬间刷出的大量日志需要立即回收，故补手动清理接口。
--   2. 手动清理仅平台超级管理员可用（后端 requirePlatformAdmin 二次校验），
--      因此这两个按钮权限只授予 sysAdmin，租户管理员即使拿到权限行也会被接口拒绝。
--
-- 幂等：可重复执行
-- 执行：mysql --default-character-set=utf8mb4 -uroot -p123456 supermarket_erp < upgrade-log-clean-perm.sql
-- ============================================================

-- 1. 新增按钮权限行（menu_type=2，仅用于权限判定，不产生菜单项或页面）
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES
  (1007, 1005, '清理操作日志', 2, NULL, NULL, 'sys:operation:clean', NULL, 1, 1, 1, 0, NOW(), NOW()),
  (1008, 1006, '清理登录日志', 2, NULL, NULL, 'sys:login:clean', NULL, 1, 1, 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `deleted` = 0,
  `status` = 1,
  `parent_id` = VALUES(`parent_id`),
  `menu_type` = 2,
  `menu_name` = VALUES(`menu_name`),
  `permission` = VALUES(`permission`);

-- 2. 仅授予系统管理员（role_code = sysAdmin）
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`)
SELECT r.id, m.id, 0
FROM `sys_role` r
JOIN `sys_menu` m ON m.deleted = 0 AND m.id IN (1007, 1008)
WHERE r.deleted = 0
  AND r.role_code = 'sysAdmin';

-- 3. 校验：两个权限行应各挂在操作日志/登录日志菜单下
-- SELECT id, parent_id, menu_name, menu_type, permission FROM sys_menu WHERE id IN (1007, 1008);
