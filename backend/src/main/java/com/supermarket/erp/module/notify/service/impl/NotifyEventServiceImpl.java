package com.supermarket.erp.module.notify.service.impl;

import com.supermarket.erp.module.notify.entity.NotifyEventLog;
import com.supermarket.erp.module.notify.mapper.NotifyEventLogMapper;
import com.supermarket.erp.module.notify.service.INotifyEventService;
import com.supermarket.erp.module.notify.vo.PlatformAdminRow;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotifyEventServiceImpl implements INotifyEventService {

    private final NotifyEventLogMapper eventLogMapper;

    @Override
    public void publishToUsers(Long tenantId, Long storeId, List<Long> userIds,
                               String eventType, String title, String content, String bizType, Long bizId) {
        if (tenantId == null || userIds == null || userIds.isEmpty()) {
            return;
        }
        LocalDateTime now = LocalDateTime.now();
        for (Long userId : userIds) {
            if (userId == null) {
                continue;
            }
            NotifyEventLog event = new NotifyEventLog();
            event.setTenantId(tenantId);
            event.setStoreId(storeId);
            event.setUserId(userId);
            event.setEventType(eventType);
            event.setTitle(title);
            event.setContent(content);
            event.setBizType(bizType);
            event.setBizId(bizId);
            event.setIsRead(0);
            event.setCreateTime(now);
            eventLogMapper.insert(event);
        }
    }

    @Override
    public void publishToTenantAdmins(Long tenantId, Long storeId, Long excludeUserId,
                                      String eventType, String title, String content, String bizType, Long bizId) {
        List<Long> adminIds = eventLogMapper.selectTenantAdminUserIds(tenantId, excludeUserId == null ? -1L : excludeUserId);
        publishToUsers(tenantId, storeId, adminIds, eventType, title, content, bizType, bizId);
    }

    @Override
    public void publishToPlatformAdmins(String eventType, String title, String content, String bizType, Long bizId) {
        List<PlatformAdminRow> admins = eventLogMapper.selectPlatformAdmins();
        LocalDateTime now = LocalDateTime.now();
        for (PlatformAdminRow admin : admins) {
            if (admin.getUserId() == null || admin.getTenantId() == null) {
                continue;
            }
            NotifyEventLog event = new NotifyEventLog();
            // 平台超管同属某个租户，事件按各自的 tenant_id 落库，才能被其消息中心读到
            event.setTenantId(admin.getTenantId());
            event.setUserId(admin.getUserId());
            event.setEventType(eventType);
            event.setTitle(title);
            event.setContent(content);
            event.setBizType(bizType);
            event.setBizId(bizId);
            event.setIsRead(0);
            event.setCreateTime(now);
            eventLogMapper.insert(event);
        }
    }
}
