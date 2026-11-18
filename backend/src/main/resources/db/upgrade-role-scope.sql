-- ============================================================
-- upgrade-role-scope.sql
-- 角色「范围」维度：sys_role.role_scope
--   1 = 租户私有（默认）：仅本租户可见/可维护/可分配/可作为租户层通知对象
--   2 = 平台共享：平台提供、所有租户均可使用——
--       任何租户管理员都可见、可分配给本租户用户、可作为租户层通知的指定角色；
--       仅超级管理员(user_type=3)可创建/修改/删除（维护权归平台）
--   3 = 平台内置：仅超级管理员可见与可用（如系统管理员 sysAdmin）。
--       该角色携带平台级权限（platform:announcement:manage），
--       若允许租户管理员分配会导致提权，故单独一档、不对外共享
--
-- 背景：租户层通知按角色发送时，角色下拉 = 本租户私有 + 平台共享，
--       不会出现其他租户的私有角色，也不会出现平台内置角色（不越界）。
-- 幂等：可重复执行
-- 执行：mysql --default-character-set=utf8mb4 -uroot -p123456 supermarket_erp < upgrade-role-scope.sql
-- ============================================================

-- 1. 加列（不存在才执行；已存在则跳过，保证可重复执行）
SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'sys_role' AND column_name = 'role_scope');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE sys_role ADD COLUMN role_scope TINYINT NOT NULL DEFAULT 1 COMMENT ''角色范围：1租户私有(仅本租户可用) 2平台共享(所有租户均可用，仅超管可维护) 3平台内置(仅超管可见可用，如系统管理员)''',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. 存量兜底：历史数据一律按租户私有
UPDATE sys_role SET role_scope = 1 WHERE role_scope IS NULL;

-- 3. 平台内置角色：系统管理员（role_code='sysAdmin' 为平台角色约定）。
--    携带平台级权限，仅超级管理员可见/可维护/可分配，不参与平台共享。
--    （若历史版本曾把它置为 2=平台共享，此处一并纠正为 3）
UPDATE sys_role SET role_scope = 3 WHERE deleted = 0 AND role_code = 'sysAdmin' AND role_scope <> 3;
