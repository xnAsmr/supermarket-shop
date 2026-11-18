-- ============================================================
-- upgrade-role-menu-fix.sql
-- 菜单权限链路修复（配合前端 VITE_ACCESS_MODE=backend）
--
-- 修复内容：
-- 1. 补齐「父目录未授权」导致的孤立子菜单：
--    角色已授权子菜单但缺父级目录时，补授父级目录
--    （否则 sys_menu.parent_id 指向未授权节点，整支子树会被静默丢弃）
-- 2. 采购单菜单路径对齐前端路由（/purchase/list 为重构前的旧页面）
-- 3. 采购退货菜单挂错父级（挂在 订单管理/退货退款 下，应为 采购管理）
-- 4. 恢复被删除的操作日志 / 登录日志菜单（角色授权里已引用其 id）
-- 5. 系统管理员补全全部菜单授权
-- 6. 店长补齐业务菜单
-- 7. 仓库管理员/收银员/门店管理员：补齐「已授权页面」的同父级兄弟页面所属按钮
--    （品牌按钮除外，见 9，品牌权限跟随商品新增权限）
-- 8. 新增品牌按钮行（pms:brand:add/edit/delete）
-- 9. 品牌权限跟随「商品新增」权限授予
--
-- 幂等：可重复执行
-- 执行：mysql --default-character-set=utf8mb4 -uroot -p123456 supermarket_erp < upgrade-role-menu-fix.sql
-- ============================================================

-- 1. 补齐父级目录授权
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`)
SELECT DISTINCT rm.role_id, m.parent_id, 0
FROM `sys_role_menu` rm
JOIN `sys_menu` m ON m.id = rm.menu_id AND m.deleted = 0
WHERE rm.deleted = 0
  AND m.parent_id IS NOT NULL
  AND m.parent_id > 0
  AND EXISTS (
    SELECT 1 FROM `sys_menu` p WHERE p.id = m.parent_id AND p.deleted = 0
  );

-- 2. 采购单菜单路径对齐前端路由
UPDATE `sys_menu`
SET `path` = '/purchase/order',
    `component` = '/purchase/PurchaseOrder.vue'
WHERE id = 501
  AND (`path` <> '/purchase/order' OR `component` <> '/purchase/PurchaseOrder.vue');

-- 3. 采购退货挂回采购管理
UPDATE `sys_menu`
SET `parent_id` = 5, `sort` = 2
WHERE id = 631 AND `parent_id` <> 5;

-- 4. 恢复操作日志 / 登录日志菜单
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES
  (1005, 10, '操作日志', 1, '/system/operation-log', '/system/OperationLog.vue', 'sys:operation:list', 'ri:file-list-3-line', 5, 1, 1, 0, NOW(), NOW()),
  (1006, 10, '登录日志', 1, '/system/login-log', '/system/LoginLog.vue', 'sys:login:list', 'ri:login-circle-line', 6, 1, 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE `deleted` = 0, `status` = 1, `parent_id` = 10;

-- 5. 系统管理员(role_code=sysAdmin) 补全全部菜单授权
--    历史数据缺 501/702/703/707/1005/1006，菜单权限改为后端生效后这些页面将不可见
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`)
SELECT r.id, m.id, 0
FROM `sys_role` r
CROSS JOIN `sys_menu` m
WHERE r.deleted = 0 AND r.role_code = 'sysAdmin'
  AND m.deleted = 0;

-- 6. 店长(role_code=STORE_MANAGER) 补齐业务菜单
--    历史数据只授了账户管理(804)，缺采购订单/收支流水/日结管理/经营报表，
--    以及已授权页面 采购退货(631) 之外同父级的兄弟页面，导致店长实际看不到这些菜单
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`)
SELECT r.id, m.id, 0
FROM `sys_role` r
JOIN `sys_menu` m ON m.deleted = 0 AND m.id IN (5, 501, 511, 512, 513, 801, 811, 802, 821, 803)
WHERE r.deleted = 0 AND r.role_code = 'STORE_MANAGER';

-- 7. 仓库管理员/收银员/门店管理员：补齐「已授权页面」的同父级兄弟页面所属按钮
--    （仅补 button 行，不新增页面，避免改变业务可见范围）
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`)
SELECT r.id, b.id, 0
FROM `sys_role` r
JOIN `sys_role_menu` rm ON rm.role_id = r.id AND rm.deleted = 0
JOIN `sys_menu` p ON p.id = rm.menu_id AND p.deleted = 0 AND p.menu_type = 1
JOIN `sys_menu` b ON b.parent_id = p.id AND b.deleted = 0 AND b.menu_type = 2
WHERE r.deleted = 0
  AND r.role_code IN ('CASHIER', 'WAREHOUSE_KEEPER', 'STORE_MANAGER')
  -- 品牌按钮不在这里自动补授，改由 9 按「商品新增」权限跟随授予
  AND b.permission NOT LIKE 'pms:brand:%'
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_menu` x
    WHERE x.role_id = r.id AND x.menu_id = b.id AND x.deleted = 0
  );

-- 8. 品牌按钮行（pms:brand:add/edit/delete）
--    BrandController 用 @perm.check 强制校验这三个权限，但 sys_menu 此前没有任何
--    品牌按钮行，导致这些权限无法授权，只有超管(*:*:*)能新增/编辑/删除品牌。
--    挂在商品列表(401)下：品牌在商品表单中选择与维护。
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES
  (441, 401, '品牌新增', 2, NULL, NULL, 'pms:brand:add',    NULL, 4, 1, 1, 0, NOW(), NOW()),
  (442, 401, '品牌编辑', 2, NULL, NULL, 'pms:brand:edit',   NULL, 5, 1, 1, 0, NOW(), NOW()),
  (443, 401, '品牌删除', 2, NULL, NULL, 'pms:brand:delete', NULL, 6, 1, 1, 0, NOW(), NOW())
ON DUPLICATE KEY UPDATE `deleted` = 0, `status` = 1, `parent_id` = 401, `menu_type` = 2,
  `menu_name` = VALUES(`menu_name`), `permission` = VALUES(`permission`), `sort` = VALUES(`sort`);

-- 9. 品牌权限跟随「商品新增」权限：能维护商品的角色才能维护品牌
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`)
SELECT r.id, b.id, 0
FROM `sys_role` r
JOIN `sys_menu` addMenu ON addMenu.deleted = 0 AND addMenu.permission = 'pms:product:add'
JOIN `sys_role_menu` rm ON rm.role_id = r.id AND rm.menu_id = addMenu.id AND rm.deleted = 0
CROSS JOIN `sys_menu` b
WHERE r.deleted = 0
  AND b.deleted = 0
  AND b.id IN (441, 442, 443)
  AND NOT EXISTS (
    SELECT 1 FROM `sys_role_menu` x
    WHERE x.role_id = r.id AND x.menu_id = b.id AND x.deleted = 0
  );
