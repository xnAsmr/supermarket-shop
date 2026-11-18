-- ============================================================
-- 租户通知类型升级（幂等，可重复执行）
-- tenant_notice 增加 notice_type 列：1=门店通知 2=制度规范 3=活动安排（默认 1）
-- 与平台公告 notice_type（功能更新/系统维护/规则变更）是两套独立枚举，互不影响
-- ============================================================

SET @col_exists = (SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'tenant_notice' AND column_name = 'notice_type');
SET @ddl = IF(@col_exists = 0,
  'ALTER TABLE tenant_notice ADD COLUMN notice_type TINYINT NOT NULL DEFAULT 1 COMMENT ''通知类型：1=门店通知 2=制度规范 3=活动安排''',
  'SELECT 1');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 存量数据兜底：统一按「门店通知」处理
UPDATE tenant_notice SET notice_type = 1 WHERE notice_type IS NULL OR notice_type NOT IN (1, 2, 3);
