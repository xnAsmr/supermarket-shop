-- ============================================================================
-- 一级菜单排序调整（增量升级脚本，可重复执行）
--
-- 侧边栏顺序由 sys_menu.sort 升序决定：后端 /api/v1/menus/current 依
-- ORDER BY sort 返回（MenuMapper.selectMenusByUserId），前端不做二次排序，
-- 所以直接校正一级目录的 sort 即可，无需改代码。
--
-- 目标顺序：
--   1  平台管理 /platform
--   2  工作台   /dashboard
--   3  收银管理 /pos
--   4  订单管理 /order
--   5  商品管理 /product
--   6  采购管理 /purchase
--   7  仓库管理 /warehouse
--   8  会员管理 /member
--   9  财务管理 /finance
--   10 租户管理 /tenant
--   11 系统管理 /system
--   12 消息通知 /notify   （本次未指定，保持末尾）
--
-- 顺带修复：/warehouse 与 /member 历史上同为 sort=7，排序并列、先后不确定
--
-- 定位用 path 而非 id：sys_menu.path 必须与前端路由完整路径一致，是稳定标识
--
-- 全新安装请执行 init-test-data.sql（其 sort 已同步为同一顺序），无需本脚本
-- ============================================================================

UPDATE `sys_menu` SET `sort` = 1,  `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/platform';
UPDATE `sys_menu` SET `sort` = 2,  `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/dashboard';
UPDATE `sys_menu` SET `sort` = 3,  `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/pos';
UPDATE `sys_menu` SET `sort` = 4,  `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/order';
UPDATE `sys_menu` SET `sort` = 5,  `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/product';
UPDATE `sys_menu` SET `sort` = 6,  `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/purchase';
UPDATE `sys_menu` SET `sort` = 7,  `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/warehouse';
UPDATE `sys_menu` SET `sort` = 8,  `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/member';
UPDATE `sys_menu` SET `sort` = 9,  `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/finance';
UPDATE `sys_menu` SET `sort` = 10, `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/tenant';
UPDATE `sys_menu` SET `sort` = 11, `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/system';
UPDATE `sys_menu` SET `sort` = 12, `update_time` = NOW() WHERE `parent_id` = 0 AND `path` = '/notify';
