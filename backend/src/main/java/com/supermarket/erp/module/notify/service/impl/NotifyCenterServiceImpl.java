package com.supermarket.erp.module.notify.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.notify.entity.NotifyEventLog;
import com.supermarket.erp.module.notify.entity.NotifyMessage;
import com.supermarket.erp.module.notify.entity.PlatformAnnouncement;
import com.supermarket.erp.module.notify.entity.PlatformAnnouncementRead;
import com.supermarket.erp.module.notify.entity.TenantNotice;
import com.supermarket.erp.module.notify.entity.TenantNoticeRead;
import com.supermarket.erp.module.notify.mapper.NotifyEventLogMapper;
import com.supermarket.erp.module.notify.mapper.NotifyMessageMapper;
import com.supermarket.erp.module.notify.mapper.PlatformAnnouncementMapper;
import com.supermarket.erp.module.notify.mapper.PlatformAnnouncementReadMapper;
import com.supermarket.erp.module.notify.mapper.TenantNoticeMapper;
import com.supermarket.erp.module.notify.mapper.TenantNoticeReadMapper;
import com.supermarket.erp.module.notify.service.INotifyCenterService;
import com.supermarket.erp.module.notify.vo.AnnouncementVO;
import com.supermarket.erp.module.notify.vo.EventVO;
import com.supermarket.erp.module.notify.vo.NoticeVO;
import com.supermarket.erp.module.notify.vo.NotifyUnreadVO;
import com.supermarket.erp.module.notify.vo.TargetCountRow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotifyCenterServiceImpl implements INotifyCenterService {

    private final PlatformAnnouncementMapper announcementMapper;
    private final PlatformAnnouncementReadMapper announcementReadMapper;
    private final TenantNoticeMapper noticeMapper;
    private final TenantNoticeReadMapper noticeReadMapper;
    private final NotifyEventLogMapper eventLogMapper;
    private final NotifyMessageMapper messageMapper;

    @Override
    public List<AnnouncementVO> announcements() {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        List<AnnouncementVO> list = announcementMapper.selectVisibleForUser(tenantId, userId);
        for (AnnouncementVO vo : list) {
            fillAnnouncementState(vo);
        }
        Map<Long, Integer> unread = loadUnreadComments(
                list.stream().map(AnnouncementVO::getId).toList(), tenantId, userId, true);
        list.forEach(vo -> vo.setUnreadComments(unread.getOrDefault(vo.getId(), 0)));
        return list;
    }

    @Override
    public AnnouncementVO announcement(Long announcementId) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        AnnouncementVO vo = announcementMapper.selectVisibleDetail(announcementId, tenantId, userId);
        if (vo == null) {
            throw new BusinessException(4004, "公告不存在或无权查看");
        }
        fillAnnouncementState(vo);
        vo.setUnreadComments(loadUnreadComments(List.of(vo.getId()), tenantId, userId, true)
                .getOrDefault(vo.getId(), 0));
        return vo;
    }

    @Override
    public List<NoticeVO> notices() {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        List<NoticeVO> list = noticeMapper.selectVisibleForUser(tenantId, userId);
        for (NoticeVO vo : list) {
            vo.setRead(vo.getReadAt() != null);
        }
        Map<Long, Integer> unread = loadUnreadComments(
                list.stream().map(NoticeVO::getId).toList(), tenantId, userId, false);
        list.forEach(vo -> vo.setUnreadComments(unread.getOrDefault(vo.getId(), 0)));
        return list;
    }

    @Override
    public NoticeVO notice(Long noticeId) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        NoticeVO vo = noticeMapper.selectVisibleDetail(noticeId, tenantId, userId);
        if (vo == null) {
            throw new BusinessException(4004, "通知不存在或无权查看");
        }
        vo.setRead(vo.getReadAt() != null);
        vo.setUnreadComments(loadUnreadComments(List.of(vo.getId()), tenantId, userId, false)
                .getOrDefault(vo.getId(), 0));
        return vo;
    }

    @Override
    public List<EventVO> events() {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        LambdaQueryWrapper<NotifyEventLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(NotifyEventLog::getTenantId, tenantId)
               .eq(NotifyEventLog::getUserId, userId)
               .orderByDesc(NotifyEventLog::getCreateTime)
               .last("LIMIT 50");
        return eventLogMapper.selectList(wrapper).stream().map(this::toEventVO).toList();
    }

    @Override
    public EventVO event(Long eventId) {
        // 事件提醒按 (tenant_id, user_id) 分区：只能看自己的，别人的事件视为不存在
        LambdaQueryWrapper<NotifyEventLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(NotifyEventLog::getId, eventId)
               .eq(NotifyEventLog::getTenantId, SecurityUtil.getTenantId())
               .eq(NotifyEventLog::getUserId, SecurityUtil.getUserId());
        NotifyEventLog log = eventLogMapper.selectOne(wrapper);
        if (log == null) {
            throw new BusinessException(4004, "提醒不存在或无权查看");
        }
        return toEventVO(log);
    }

    /** 公告已读/待确认状态回填（列表与详情共用） */
    private void fillAnnouncementState(AnnouncementVO vo) {
        vo.setRead(vo.getReadAt() != null);
        vo.setNeedAck(vo.getRequireAck() != null && vo.getRequireAck() == 1 && vo.getAckAt() == null);
    }

    /** 事件日志实体 → EventVO（列表与详情共用） */
    private EventVO toEventVO(NotifyEventLog e) {
        EventVO vo = new EventVO();
        vo.setId(e.getId());
        vo.setEventType(e.getEventType());
        vo.setTitle(e.getTitle());
        vo.setContent(e.getContent());
        vo.setBizType(e.getBizType());
        vo.setBizId(e.getBizId());
        vo.setRead(e.getIsRead() != null && e.getIsRead() == 1);
        vo.setCreateTime(e.getCreateTime());
        return vo;
    }

    @Override
    public NotifyUnreadVO unreadCount() {
        NotifyUnreadVO vo = new NotifyUnreadVO();
        int announcementUnread = 0;
        for (AnnouncementVO item : announcements()) {
            if (!Boolean.TRUE.equals(item.getRead())) {
                announcementUnread++;
            }
        }
        int noticeUnread = 0;
        for (NoticeVO item : notices()) {
            if (!Boolean.TRUE.equals(item.getRead())) {
                noticeUnread++;
            }
        }
        Long eventUnread = eventLogMapper.selectCount(new LambdaQueryWrapper<NotifyEventLog>()
                .eq(NotifyEventLog::getTenantId, SecurityUtil.getTenantId())
                .eq(NotifyEventLog::getUserId, SecurityUtil.getUserId())
                .eq(NotifyEventLog::getIsRead, 0));
        vo.setAnnouncements(announcementUnread);
        vo.setNotices(noticeUnread);
        vo.setEvents(eventUnread == null ? 0 : eventUnread.intValue());
        return vo;
    }

    @Override
    public void readAnnouncement(Long announcementId) {
        PlatformAnnouncement announcement = requireVisibleAnnouncement(announcementId);
        announcementReadMapper.insertIgnoreRead(announcement.getId(), SecurityUtil.getTenantId(),
                SecurityUtil.getUserId(), LocalDateTime.now());
    }

    @Override
    public void ackAnnouncement(Long announcementId) {
        PlatformAnnouncement announcement = requireVisibleAnnouncement(announcementId);
        announcementReadMapper.insertIgnoreAck(announcement.getId(), SecurityUtil.getTenantId(),
                SecurityUtil.getUserId(), LocalDateTime.now());
    }

    @Override
    public void readNotice(Long noticeId) {
        TenantNotice notice = noticeMapper.selectById(noticeId);
        if (notice == null || !SecurityUtil.getTenantId().equals(notice.getTenantId())) {
            throw new BusinessException(4004, "通知不存在或无权查看");
        }
        // 已撤回的通知对接收人不可见，不允许标记已读
        if (TenantNotice.STATUS_WITHDRAWN == nzStatus(notice.getStatus())) {
            throw new BusinessException(4004, "通知已撤回");
        }
        noticeReadMapper.insertIgnoreRead(notice.getId(), SecurityUtil.getTenantId(),
                SecurityUtil.getUserId(), LocalDateTime.now());
    }

    /** 通知状态兜底：历史数据 status 为 NULL 时按已发送处理 */
    private int nzStatus(Integer status) {
        return status == null ? TenantNotice.STATUS_SENT : status;
    }

    @Override
    public void readEvent(Long eventId) {
        LambdaUpdateWrapper<NotifyEventLog> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(NotifyEventLog::getId, eventId)
               .eq(NotifyEventLog::getUserId, SecurityUtil.getUserId())
               .set(NotifyEventLog::getIsRead, 1)
               .set(NotifyEventLog::getReadAt, LocalDateTime.now());
        eventLogMapper.update(null, wrapper);
    }

    @Override
    public void readAllEvents() {
        LambdaUpdateWrapper<NotifyEventLog> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(NotifyEventLog::getUserId, SecurityUtil.getUserId())
               .eq(NotifyEventLog::getIsRead, 0)
               .set(NotifyEventLog::getIsRead, 1)
               .set(NotifyEventLog::getReadAt, LocalDateTime.now());
        eventLogMapper.update(null, wrapper);
    }

    /** 校验公告存在且已发布（可见性口径与列表一致，防止越权写已读记录） */
    private PlatformAnnouncement requireVisibleAnnouncement(Long announcementId) {
        PlatformAnnouncement announcement = announcementMapper.selectById(announcementId);
        if (announcement == null || announcement.getStatus() == null
                || announcement.getStatus() != PlatformAnnouncement.STATUS_PUBLISHED) {
            throw new BusinessException(4004, "公告不存在或未发布");
        }
        return announcement;
    }

    /**
     * 批量取「留言未读红点」数（列表页用，避免 N+1）
     * announcement=true：平台对我方私密工单的回复；false：别人在通知下发表的公开留言
     */
    private Map<Long, Integer> loadUnreadComments(List<Long> ids, Long tenantId, Long userId, boolean announcement) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        List<TargetCountRow> rows = announcement
                ? messageMapper.countUnreadPrivateByTargets(
                NotifyMessage.TARGET_ANNOUNCEMENT, tenantId, userId, ids)
                : messageMapper.countUnreadAudienceByTargets(
                NotifyMessage.TARGET_NOTICE, userId, ids);
        return rows.stream().collect(Collectors.toMap(TargetCountRow::getTargetId,
                row -> row.getTotal() == null ? 0 : row.getTotal(), (a, b) -> a));
    }
}
