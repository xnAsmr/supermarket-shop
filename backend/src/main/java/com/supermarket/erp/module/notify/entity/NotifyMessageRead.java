package com.supermarket.erp.module.notify.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 留言已读水位（用户 × 留言对象，target_type + target_id + user_id 唯一）
 *
 * 用自增 id 记录水位而非时间：同一秒内的多条留言也能精确区分先后，
 * 未读数 = 该对象下「别人发的、id > last_read_id」的正常留言数。
 */
@Data
@TableName("notify_message_read")
public class NotifyMessageRead {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** ANNOUNCEMENT=平台公告 NOTICE=租户通知 */
    private String targetType;

    private Long targetId;

    private Long tenantId;

    private Long userId;

    /** 已读水位：该对象下最后一条已读留言ID（含自己发的） */
    private Long lastReadId;

    private LocalDateTime lastReadAt;
}
