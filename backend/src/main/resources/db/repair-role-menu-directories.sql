-- ============================================================
-- 修复：角色授权丢失父目录导致侧边栏菜单扁平化
--
-- 背景：角色授权弹窗保存时只提交了「全选」节点，半选（indeterminate）的
--       父目录被静默丢弃（如「消息通知」目录对租户管理员天然半选，因为
--       「平台公告」仅超管可用）。下次登录时后端 getUserMenuTree 发现
--       子菜单的父目录不在授权集，便把整支子树提升为一级菜单。
--
-- 本脚本为幂等修复：凡某角色已授权某个菜单，就补授权它的祖先目录。
-- 可重复执行；跑完后无需再进弹窗保存，重新登录即可恢复菜单层级。
--
-- 依赖：sys_menu / sys_role_menu 表结构（init-test-data.sql）
-- ============================================================

-- 第一级：为所有已授权的页面/按钮补上直接父目录
-- （覆盖根目录 → 页面/按钮 的两层结构，即当前 schema 的全部情况）
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`)
SELECT rm.role_id, c.parent_id, 0
FROM `sys_role_menu` rm
JOIN `sys_menu` c ON c.id = rm.menu_id AND c.deleted = 0
WHERE rm.deleted = 0
  AND c.parent_id IS NOT NULL
  AND c.parent_id <> 0;

-- 第二级：为上一轮补上的目录再补更上层目录（防御未来出现三层及以上的菜单结构）
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`)
SELECT rm.role_id, c.parent_id, 0
FROM `sys_role_menu` rm
JOIN `sys_menu` c ON c.id = rm.menu_id AND c.deleted = 0
WHERE rm.deleted = 0
  AND c.parent_id IS NOT NULL
  AND c.parent_id <> 0;

-- 校验：执行后不应再有「已授权子菜单、但父目录未授权」的角色
-- 有输出即说明仍有遗漏（理论上本脚本执行后为空）
SELECT rm.role_id, c.parent_id AS missing_dir_id, p.menu_name AS missing_dir_name
FROM `sys_role_menu` rm
JOIN `sys_menu` c ON c.id = rm.menu_id AND c.deleted = 0
LEFT JOIN `sys_menu` p ON p.id = c.parent_id AND p.deleted = 0
LEFT JOIN `sys_role_menu` pm ON pm.role_id = rm.role_id AND pm.menu_id = c.parent_id AND pm.deleted = 0
WHERE rm.deleted = 0
  AND c.parent_id IS NOT NULL
  AND c.parent_id <> 0
  AND pm.id IS NULL;
