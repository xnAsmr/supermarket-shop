-- ============================================================
-- upgrade-log-export-perm.sql
-- 日志导出权限（配合「操作日志 / 登录日志」页面的导出按钮）
--
-- 背景：
--   1. 两个页面新增「导出」按钮，走 hasAuth 判定，与「清理日志」按钮同一套机制。
--   2. 导出是只读动作，权限跟随日志查看权限：凡已拥有父级菜单
--      （操作日志 1005 / 登录日志 1006）的角色，一并授予导出按钮。
--   3. 清理按钮（1007/1008）仍只授 sysAdmin，且接口层 requirePlatformAdmin 二次校验。
--
-- 幂等：可重复执行
-- 执行：mysql --default-character-set=utf8mb4 -uroot -p123456 supermarket_erp < upgrade-log-export-perm.sql
-- ============================================================

-- 1. 新增按钮权限行（menu_type=2，仅用于权限判定，不产生菜单项或页面）
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES
  (1009, 1005, '导出操作日志', 2, NULL, NULL, 'sys:operation:export', NULL, 2, 1, 1, 0, NOW(), NOW()),
  (1010, 1006, '导出登录日志', 2, NULL, NULL, 'sys:login:export', NULL, 2, 1, 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `deleted` = 0,
  `status` = 1,
  `parent_id` = VALUES(`parent_id`),
  `menu_type` = 2,
  `menu_name` = VALUES(`menu_name`),
  `permission` = VALUES(`permission`);

-- 2. 授予已拥有对应父级菜单的角色（导出跟随日志查看权限）
--    若希望导出也仅限平台超管，把整段替换为：
--    SELECT r.id, m.id, 0 FROM sys_role r JOIN sys_menu m ON m.id IN (1009, 1010)
--    WHERE r.deleted = 0 AND r.role_code = 'sysAdmin';
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`)
SELECT DISTINCT rm.role_id, m.id, 0
FROM `sys_role_menu` rm
JOIN `sys_menu` m ON m.deleted = 0 AND m.id IN (1009, 1010)
WHERE rm.deleted = 0
  AND rm.menu_id = m.parent_id;

-- 3. 校验：两个权限行各挂在操作日志/登录日志菜单下
-- SELECT id, parent_id, menu_name, menu_type, permission FROM sys_menu WHERE id IN (1009, 1010);
