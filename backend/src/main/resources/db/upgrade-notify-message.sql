-- ============================================================
-- 公告/通知留言（反馈）功能
--
-- 设计要点（与“平台公告=私密、租户通知=公开”的原始设想对齐后的最终口径）：
--   1. 一张统一表 notify_message，用 scope 区分两种语义：
--      - PRIVATE  ：平台公告下的私密反馈。仅「留言人 + 平台」可见，工单式（PENDING/REPLIED/CLOSED）
--      - AUDIENCE ：租户通知下的公告内留言。可见范围继承通知定向范围（能收到通知才看得到）
--   2. 「公开」不是租户全员公开：tenant_notice 支持按门店/角色/人员定向，
--      留言若对租户全员开放会让未命中定向的人绕过定向看到内容，故按 AUDIENCE（继承公告可见性）实现
--   3. 可见性校验在服务层复用 platform_announcement / tenant_notice 的可见性 SQL，
--      不接受前端传入 tenant_id / user_id
--   4. 留言与已读、强制确认（require_ack）完全解耦，不参与已读率/确认率统计
--
-- 幂等：可重复执行。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 留言表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notify_message` (
  `id`             BIGINT        NOT NULL AUTO_INCREMENT COMMENT '主键',
  `target_type`    VARCHAR(20)   NOT NULL COMMENT '留言对象类型：ANNOUNCEMENT=平台公告 NOTICE=租户通知',
  `target_id`      BIGINT        NOT NULL COMMENT '留言对象ID',
  `tenant_id`      BIGINT        NOT NULL COMMENT '留言人所属租户（私密反馈中即提问方租户；平台回复沿用提问方租户）',
  `store_id`       BIGINT        NULL COMMENT '留言人所属门店（可空）',
  `user_id`        BIGINT        NOT NULL COMMENT '留言人ID（平台回复时为平台超管ID）',
  `user_name`      VARCHAR(64)   NULL COMMENT '留言人姓名快照',
  `author_type`    TINYINT       NOT NULL DEFAULT 1 COMMENT '作者类型：1=租户用户 2=平台',
  `scope`          VARCHAR(16)   NOT NULL DEFAULT 'AUDIENCE' COMMENT '可见范围：PRIVATE=仅留言人+平台 AUDIENCE=公告可见范围内公开',
  `parent_id`      BIGINT        NOT NULL DEFAULT 0 COMMENT '父留言ID：0=顶层；AUDIENCE 仅一层回复',
  `thread_status`  VARCHAR(16)   NULL COMMENT '工单状态（仅 PRIVATE 顶层）：PENDING待处理 REPLIED已回复 CLOSED已关闭',
  `reply_by`       BIGINT        NULL COMMENT '最近回复人ID（平台）',
  `reply_by_name`  VARCHAR(64)   NULL COMMENT '最近回复人姓名',
  `reply_at`       DATETIME      NULL COMMENT '最近回复时间',
  `content`        VARCHAR(1000) NOT NULL COMMENT '留言内容（纯文本）',
  `status`         TINYINT       NOT NULL DEFAULT 0 COMMENT '状态：0正常 1本人撤回 2管理员屏蔽',
  `create_time`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted`        TINYINT       NOT NULL DEFAULT 0 COMMENT '逻辑删除：0未删除 1已删除',
  PRIMARY KEY (`id`),
  KEY `idx_target` (`target_type`, `target_id`, `status`, `create_time`),
  KEY `idx_thread` (`target_type`, `target_id`, `parent_id`),
  KEY `idx_user` (`tenant_id`, `user_id`),
  KEY `idx_pending` (`target_type`, `thread_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci COMMENT='公告/通知留言（平台私密反馈 + 租户公告内留言）';

-- ------------------------------------------------------------
-- 2. 按钮权限（menu_type=2，后端权限集合唯一来源）
--    - 1206：平台公告「反馈处理」→ platform:announcement:feedback:manage（超管）
--    - 1207：租户通知「留言管理」→ notify:notice:comment:manage（租户管理员/店长/超管）
--    用户侧发表/查看留言不设按钮权限：能看见公告/通知即可参与，
--    越权由服务层的可见性校验兜底（与消息中心“全员通用”口径一致）。
-- ------------------------------------------------------------
INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES (1206, 1202, '反馈处理', 2, '', NULL, 'platform:announcement:feedback:manage', '', 2, 1, 1, 0, '2026-10-26 10:00:00', '2026-10-26 10:00:00')
ON DUPLICATE KEY UPDATE `menu_name` = VALUES(`menu_name`), `parent_id` = VALUES(`parent_id`), `permission` = VALUES(`permission`), `visible` = 1, `status` = 1, `deleted` = 0;

INSERT INTO `sys_menu` (`id`, `parent_id`, `menu_name`, `menu_type`, `path`, `component`, `permission`, `icon`, `sort`, `visible`, `status`, `deleted`, `create_time`, `update_time`)
VALUES (1207, 1203, '留言管理', 2, '', NULL, 'notify:notice:comment:manage', '', 2, 1, 1, 0, '2026-10-26 10:00:00', '2026-10-26 10:00:00')
ON DUPLICATE KEY UPDATE `menu_name` = VALUES(`menu_name`), `parent_id` = VALUES(`parent_id`), `permission` = VALUES(`permission`), `visible` = 1, `status` = 1, `deleted` = 0;

-- ------------------------------------------------------------
-- 3. 角色授权（幂等）
--    角色：1租户管理员 2店长 9系统管理员(超管)
-- ------------------------------------------------------------
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (9, 1206, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (1, 1207, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (2, 1207, 0);
INSERT IGNORE INTO `sys_role_menu` (`role_id`, `menu_id`, `deleted`) VALUES (9, 1207, 0);
