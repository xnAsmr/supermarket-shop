-- ============================================================
-- sys_menu / sys_role_menu 全新种子数据
-- 对齐当前前端路由结构（route name） 后端接口权限标识
-- 说明：前端 roleMenus 以「路由 name」「路由 name_按钮标识」为 node-key；
--       sys_menu 通过 component 文件名 / path 末段 / permission 末段派生相同的 key；
--       因此这里 component 文件名、路径均需与前端路由 name 完全一致。
-- 适用：MySQL 8.x，导入前会清空现有 sys_menu / sys_role_menu
-- ============================================================

DELETE FROM `sys_role_menu`;
DELETE FROM `sys_menu`;

-- ------------------------------------------------------------
-- Records of sys_menu (id, parent_id, menu_name, menu_type, path,
--   component, permission, icon, sort, visible, status, deleted, create_time, update_time)
-- menu_type: 0-目录 1-页面 2-按钮
-- ------------------------------------------------------------

-- ① 顶层目录
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

-- ② 平台管理
INSERT INTO `sys_menu` VALUES (101, 1, '系统管理工作台', 1, '/platform/workbench', '/platform/PlatformWorkbench.vue', 'platform:workbench:view', 'ri:bar-chart-box-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');

-- ③ 工作台
INSERT INTO `sys_menu` VALUES (201, 2, '经营驾驶舱', 1, '/dashboard/console', '/dashboard/Console.vue', 'dashboard:console:view', 'ri:home-smile-2-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (202, 2, '经营分析', 1, '/dashboard/analysis', '/dashboard/Analysis.vue', 'dashboard:analysis:view', 'ri:line-chart-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');

-- ④ 收银管理
INSERT INTO `sys_menu` VALUES (301, 3, '收银台', 1, '/pos/checkout', '/pos/PosCheckout.vue', 'pos:checkout:view', 'ri:scan-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');

-- ⑤ 商品管理
INSERT INTO `sys_menu` VALUES (401, 4, '商品列表', 1, '/product/list', '/product/ProductList.vue', 'pms:product:list', 'ri:shopping-bag-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (402, 4, '商品分类', 1, '/product/category', '/product/ProductCategory.vue', 'pms:category:list', 'ri:apps-2-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (403, 4, '供应商管理', 1, '/product/supplier', '/product/ProductSupplier.vue', 'pms:supplier:list', 'ri:truck-line', 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
-- 商品按钮
INSERT INTO `sys_menu` VALUES (411, 401, '商品新增', 2, NULL, NULL, 'pms:product:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (412, 401, '商品编辑', 2, NULL, NULL, 'pms:product:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (413, 401, '商品删除', 2, NULL, NULL, 'pms:product:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
-- 分类按钮
INSERT INTO `sys_menu` VALUES (421, 402, '分类新增', 2, NULL, NULL, 'pms:category:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (422, 402, '分类编辑', 2, NULL, NULL, 'pms:category:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (423, 402, '分类删除', 2, NULL, NULL, 'pms:category:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
-- 供应商按钮
INSERT INTO `sys_menu` VALUES (431, 403, '供应商新增', 2, NULL, NULL, 'pms:supplier:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (432, 403, '供应商编辑', 2, NULL, NULL, 'pms:supplier:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (433, 403, '供应商删除', 2, NULL, NULL, 'pms:supplier:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');

-- ⑥ 采购管理
INSERT INTO `sys_menu` VALUES (501, 5, '采购单', 1, '/purchase/list', '/purchase/PurchaseList.vue', 'pms:purchase:list', 'ri:file-list-2-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (511, 501, '采购新增', 2, NULL, NULL, 'pms:purchase:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (512, 501, '采购编辑', 2, NULL, NULL, 'pms:purchase:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (513, 501, '采购删除', 2, NULL, NULL, 'pms:purchase:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');

-- ⑦ 订单管理
INSERT INTO `sys_menu` VALUES (601, 6, '销售订单', 1, '/order/sales', '/order/OrderSales.vue', 'oms:order:list', 'ri:file-list-3-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (602, 6, '退货退款', 1, '/order/returns', '/order/OrderReturns.vue', 'oms:order:return:list', 'ri:arrow-go-back-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (611, 601, '订单导出', 2, NULL, NULL, 'oms:order:export', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (612, 601, '订单取消', 2, NULL, NULL, 'oms:order:cancel', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (613, 601, '订单完成', 2, NULL, NULL, 'oms:order:complete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (614, 601, '订单退款', 2, NULL, NULL, 'oms:order:refund', NULL, 4, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (621, 602, '新增退货', 2, NULL, NULL, 'oms:order:return:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');

-- ⑧ 仓库管理
INSERT INTO `sys_menu` VALUES (701, 7, '库存查询', 1, '/warehouse/stock', '/warehouse/stock', 'wms:stock:list', 'ri:box-3-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (702, 7, '入库管理', 1, '/warehouse/inbound', '/warehouse/inbound', 'wms:stock:inbound:list', 'ri:download-2-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (703, 7, '出库管理', 1, '/warehouse/outbound', '/warehouse/outbound', 'wms:stock:outbound:list', 'ri:upload-2-line', 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (721, 702, '新增入库', 2, NULL, NULL, 'wms:stock:inbound:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (731, 703, '新增出库', 2, NULL, NULL, 'wms:stock:outbound:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');

-- ⑨ 财务管理
INSERT INTO `sys_menu` VALUES (801, 8, '收支流水', 1, '/finance/flow', '/finance/FinanceFlow.vue', 'finance:flow:list', 'ri:money-cny-circle-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (802, 8, '日结管理', 1, '/finance/daily', '/finance/FinanceDaily.vue', 'finance:daily:list', 'ri:bank-card-line', 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (803, 8, '经营报表', 1, '/finance/report', '/finance/FinanceReport.vue', 'finance:report:list', 'ri:line-chart-line', 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (804, 8, '支付账户', 1, '/finance/account', '/finance/FinanceAccount.vue', 'finance:account:list', 'ri:wallet-3-line', 4, 1, 1, 0, '2026-10-19 10:00:00', '2026-10-19 10:00:00');
INSERT INTO `sys_menu` VALUES (811, 801, '新增收支', 2, NULL, NULL, 'finance:flow:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (821, 802, '生成日结', 2, NULL, NULL, 'finance:daily:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (841, 804, '账户新增', 2, NULL, NULL, 'finance:account:add', NULL, 1, 1, 1, 0, '2026-10-19 10:00:00', '2026-10-19 10:00:00');
INSERT INTO `sys_menu` VALUES (842, 804, '账户编辑', 2, NULL, NULL, 'finance:account:edit', NULL, 2, 1, 1, 0, '2026-10-19 10:00:00', '2026-10-19 10:00:00');
INSERT INTO `sys_menu` VALUES (843, 804, '账户删除', 2, NULL, NULL, 'finance:account:delete', NULL, 3, 1, 1, 0, '2026-10-19 10:00:00', '2026-10-19 10:00:00');

-- ⑩ 租户管理
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

-- ⑪ 系统管理
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

-- ⑫ 会员管理
INSERT INTO `sys_menu` VALUES (1101, 11, '会员列表', 1, '/member/list', '/member/MemberList.vue', 'ums:member:list', 'ri:user-star-line', 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1111, 1101, '会员新增', 2, NULL, NULL, 'ums:member:add', NULL, 1, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1112, 1101, '会员编辑', 2, NULL, NULL, 'ums:member:edit', NULL, 2, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1113, 1101, '会员删除', 2, NULL, NULL, 'ums:member:delete', NULL, 3, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');
INSERT INTO `sys_menu` VALUES (1114, 1101, '会员充值', 2, NULL, NULL, 'ums:member:recharge', NULL, 4, 1, 1, 0, '2026-10-18 10:00:00', '2026-10-18 10:00:00');

-- ------------------------------------------------------------
-- Records of sys_role_menu (id, role_id, menu_id, deleted)
-- ------------------------------------------------------------

-- 系统管理员 sysAdmin (role_id=9)：全部菜单
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

-- 租户管理员 TENANT_ADMIN (role_id=1)：全部业务模块 + 系统
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

-- 店长 STORE_MANAGER (role_id=2)：业务主模块（不含采购、租户/系统）
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

-- 收银员 CASHIER (role_id=3)：收银 + 工作台 + 订单查看
INSERT INTO `sys_role_menu` VALUES (180, 3, 2, 0);
INSERT INTO `sys_role_menu` VALUES (181, 3, 201, 0);
INSERT INTO `sys_role_menu` VALUES (182, 3, 3, 0);
INSERT INTO `sys_role_menu` VALUES (183, 3, 301, 0);
INSERT INTO `sys_role_menu` VALUES (184, 3, 6, 0);
INSERT INTO `sys_role_menu` VALUES (185, 3, 601, 0);
INSERT INTO `sys_role_menu` VALUES (186, 3, 611, 0);
INSERT INTO `sys_role_menu` VALUES (187, 3, 602, 0);
INSERT INTO `sys_role_menu` VALUES (188, 3, 621, 0);

-- 仓管员 WAREHOUSE_KEEPER (role_id=4)：仓库 + 商品
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
-- log menu role bindings (super 9 / tenant admin 1)
INSERT INTO `sys_role_menu` VALUES (234, 9, 1005, 0);
INSERT INTO `sys_role_menu` VALUES (235, 9, 1006, 0);
INSERT INTO `sys_role_menu` VALUES (236, 1, 1005, 0);
INSERT INTO `sys_role_menu` VALUES (237, 1, 1006, 0);
