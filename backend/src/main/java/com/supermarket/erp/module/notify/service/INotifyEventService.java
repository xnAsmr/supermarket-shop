package com.supermarket.erp.module.notify.service;

import java.util.List;

/**
 * 事件提醒引擎：系统触发的事件提醒统一入口（写 notify_event_log，按接收人逐条落库）
 */
public interface INotifyEventService {

    /**
     * 向指定用户发布事件提醒
     *
     * @param tenantId  租户
     * @param storeId   业务门店（可空）
     * @param userIds   接收人用户ID列表（空列表则不发送）
     * @param eventType 事件类型（如 PURCHASE_SUBMIT）
     * @param title     标题
     * @param content   内容
     * @param bizType   关联业务类型（如 PURCHASE_ORDER）
     * @param bizId     关联业务ID
     */
    void publishToUsers(Long tenantId, Long storeId, List<Long> userIds,
                        String eventType, String title, String content, String bizType, Long bizId);

    /**
     * 向租户管理员（user_type=2）发布事件提醒（排除指定用户，如提交人自己）
     */
    void publishToTenantAdmins(Long tenantId, Long storeId, Long excludeUserId,
                               String eventType, String title, String content, String bizType, Long bizId);

    /**
     * 向平台超管（user_type=3）发布事件提醒
     * 用于平台公告私密反馈：租户提交新反馈时提醒平台处理
     */
    void publishToPlatformAdmins(String eventType, String title, String content, String bizType, Long bizId);
}
