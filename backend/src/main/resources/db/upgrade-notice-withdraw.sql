-- ============================================================
-- 租户通知撤回能力升级（幂等，可重复执行）
-- 1. tenant_notice 增加 status 列：0=已发送（默认） 1=已撤回
--    撤回后：用户侧（消息中心/未读数/滚动条）不再可见，已读记录保留，可重新发布
-- 2. 兼容历史数据：存量通知一律视为已发送
-- ============================================================

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'tenant_notice' AND column_name = 'status');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE tenant_notice ADD COLUMN status TINYINT NOT NULL DEFAULT 0 COMMENT ''通知状态：0=已发送 1=已撤回''',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 存量数据兜底（正常默认值即为 0，此处防御脏数据）
UPDATE tenant_notice SET status = 0 WHERE status IS NULL;
