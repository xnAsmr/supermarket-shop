-- ============================================================
-- 公告/通知留言（反馈）功能 P1 增强
--
-- 前置：必须先执行 upgrade-notify-message.sql（建 notify_message 表）
--
-- 本脚本补齐三项能力：
--   1. @某人提醒
--      notify_message 增加 mentioned_user_ids / mentioned_names。
--      只允许 @「本条通知的应读用户」（复用定向范围收敛），
--      被 @ 的人收到 NOTICE_COMMENT_MENTION 事件提醒；平台私密反馈不适用 @。
--   2. 留言未读红点
--      新表 notify_message_read 记录「用户 × 留言对象」的已读水位（last_read_id）。
--      未读数 = 该对象下「别人发的、id > 水位」的正常留言数：
--        - 租户通知：全部不该由我发的公开留言
--        - 平台公告：仅平台对我的工单的回复
--      已读水位用自增 id 而非时间，避免同秒多条留言的边界问题。
--   3. 置顶留言
--      notify_message 增加 pinned；只允许置顶「租户通知下的顶层公开留言」，
--      单条通知最多置顶 3 条（服务层校验），列表按 pinned DESC 优先展示。
--
-- 幂等：可重复执行。
-- ============================================================

-- ------------------------------------------------------------
-- 1. notify_message 补列（不存在才执行）
-- ------------------------------------------------------------

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'notify_message' AND column_name = 'mentioned_user_ids');
SET @ddl = IF(@col_exists = 0,
'ALTER TABLE notify_message ADD COLUMN mentioned_user_ids VARCHAR(500) NULL COMMENT ''被@提醒的用户ID，逗号分隔（仅租户通知留言使用）'' AFTER content',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'notify_message' AND column_name = 'mentioned_names');
SET @ddl = IF(@col_exists = 0,
'ALTER TABLE notify_message ADD COLUMN mentioned_names VARCHAR(500) NULL COMMENT ''被@提醒的用户姓名快照，逗号分隔（仅展示用）'' AFTER mentioned_user_ids',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'notify_message' AND column_name = 'pinned');
SET @ddl = IF(@col_exists = 0,
'ALTER TABLE notify_message ADD COLUMN pinned TINYINT NOT NULL DEFAULT 0 COMMENT ''是否置顶：0否 1是（仅租户通知顶层公开留言可置顶）'' AFTER status',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ------------------------------------------------------------
-- 2. 留言已读水位（用户 × 留言对象）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notify_message_read` (
  `id`           BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
  `target_type`  VARCHAR(20) NOT NULL COMMENT '留言对象类型：ANNOUNCEMENT=平台公告 NOTICE=租户通知',
  `target_id`    BIGINT      NOT NULL COMMENT '留言对象ID',
  `tenant_id`    BIGINT      NOT NULL COMMENT '读者所属租户',
  `user_id`      BIGINT      NOT NULL COMMENT '读者ID',
  `last_read_id` BIGINT      NOT NULL DEFAULT 0 COMMENT '已读水位：该对象下最后一条已读留言ID（含自己发的）',
  `last_read_at` DATETIME    NULL COMMENT '最近一次进入留言区的时间',
  `create_time`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_target_user` (`target_type`, `target_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='公告/通知留言已读水位（未读红点用）';

-- ------------------------------------------------------------
-- 3. 置顶排序索引（置顶优先 + 时间升序的取数路径）
-- ------------------------------------------------------------
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'notify_message' AND index_name = 'idx_audience_order');
SET @ddl = IF(@idx_exists = 0,
'ALTER TABLE notify_message ADD INDEX idx_audience_order (target_type, target_id, scope, pinned, create_time)',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 说明：本脚本不新增菜单/按钮权限
--   - 置顶复用既有按钮权限 notify:notice:comment:manage（菜单 1207，角色 1/2/9）
--   - @提醒、留言已读属用户侧行为，能看见通知即可参与，不设按钮权限
