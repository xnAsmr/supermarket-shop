package com.supermarket.erp.module.notify.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.notify.dto.AnnouncementSaveDTO;
import com.supermarket.erp.module.notify.dto.NotifyPageDTO;
import com.supermarket.erp.module.notify.entity.NotifyMessage;
import com.supermarket.erp.module.notify.entity.PlatformAnnouncement;
import com.supermarket.erp.module.notify.entity.PlatformAnnouncementRead;
import com.supermarket.erp.module.notify.mapper.NotifyMessageMapper;
import com.supermarket.erp.module.notify.mapper.PlatformAnnouncementMapper;
import com.supermarket.erp.module.notify.mapper.PlatformAnnouncementReadMapper;
import com.supermarket.erp.module.notify.service.IPlatformAnnouncementService;
import com.supermarket.erp.module.notify.vo.AnnouncementAdminVO;
import com.supermarket.erp.module.notify.vo.AnnouncementStatsVO;
import com.supermarket.erp.module.notify.vo.NotifyOptionVO;
import com.supermarket.erp.module.notify.vo.TargetCountRow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformAnnouncementServiceImpl implements IPlatformAnnouncementService {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final PlatformAnnouncementMapper announcementMapper;
    private final PlatformAnnouncementReadMapper readMapper;
    private final NotifyMessageMapper messageMapper;

    @Override
    public PageResult<AnnouncementAdminVO> page(NotifyPageDTO dto) {
        int page = dto.getPage() == null || dto.getPage() < 1 ? 1 : dto.getPage();
        int size = dto.getPageSize() == null || dto.getPageSize() < 1 ? 10 : dto.getPageSize();
        LambdaQueryWrapper<PlatformAnnouncement> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.hasText(dto.getKeyword()), PlatformAnnouncement::getTitle, dto.getKeyword())
               .eq(dto.getStatus() != null, PlatformAnnouncement::getStatus, dto.getStatus())
               .orderByDesc(PlatformAnnouncement::getCreateTime);
        Page<PlatformAnnouncement> result = announcementMapper.selectPage(new Page<>(page, size), wrapper);

        Map<Long, TargetCountRow> feedbackCounts = loadFeedbackCounts(result.getRecords());
        List<AnnouncementAdminVO> list = result.getRecords().stream()
                .map(entity -> toAdminVO(entity, feedbackCounts)).toList();
        return PageResult.of(list, result.getTotal(), page, size);
    }

    @Override
    public AnnouncementAdminVO detail(Long id) {
        PlatformAnnouncement entity = requireExists(id);
        // 单条也要算反馈工单数：复用列表的批量统计（传入单元素列表）
        return toAdminVO(entity, loadFeedbackCounts(List.of(entity)));
    }

    @Override
    public void save(AnnouncementSaveDTO dto) {
        if (!StringUtils.hasText(dto.getTitle())) {
            throw new BusinessException(4001, "公告标题不能为空");
        }
        String scope = StringUtils.hasText(dto.getTargetScope()) ? dto.getTargetScope() : PlatformAnnouncement.SCOPE_ALL;
        if (!PlatformAnnouncement.SCOPE_ALL.equals(scope) && !PlatformAnnouncement.SCOPE_PLAN.equals(scope)
                && !PlatformAnnouncement.SCOPE_ASSIGN.equals(scope)) {
            throw new BusinessException(4001, "定向范围不合法");
        }
        if (PlatformAnnouncement.SCOPE_PLAN.equals(scope) && dto.getTargetPlanType() == null) {
            throw new BusinessException(4001, "按套餐定向时必须选择套餐类型");
        }
        if (PlatformAnnouncement.SCOPE_ASSIGN.equals(scope) && !StringUtils.hasText(dto.getTargetTenantIds())) {
            throw new BusinessException(4001, "指定租户定向时必须选择租户");
        }

        PlatformAnnouncement entity;
        boolean create = dto.getId() == null;
        if (create) {
            entity = new PlatformAnnouncement();
        } else {
            entity = announcementMapper.selectById(dto.getId());
            if (entity == null) {
                throw new BusinessException(4004, "公告不存在");
            }
        }
        entity.setTitle(dto.getTitle());
        entity.setContent(dto.getContent());
        entity.setNoticeType(dto.getNoticeType() == null ? PlatformAnnouncement.TYPE_UPDATE : dto.getNoticeType());
        entity.setTargetScope(scope);
        entity.setTargetPlanType(PlatformAnnouncement.SCOPE_PLAN.equals(scope) ? dto.getTargetPlanType() : null);
        entity.setTargetTenantIds(PlatformAnnouncement.SCOPE_ASSIGN.equals(scope) ? dto.getTargetTenantIds() : null);
        entity.setEffectiveAt(parseDateTime(dto.getEffectiveAt(),
                create ? LocalDateTime.now() : entity.getEffectiveAt()));
        entity.setExpireAt(parseDateTime(dto.getExpireAt(), null));
        entity.setRequireAck(Boolean.TRUE.equals(dto.getRequireAck()) ? 1 : 0);
        // 定向用户类型兜底：仅接受 2（仅系统管理员），其余值一律按「目标范围全部用户」处理。
        // 可见性 SQL 为 target_user_type IS NULL OR target_user_type = user_type，
        // 若存入无效值（如历史脏数据或异常入参）会导致公告对所有人不可见
        entity.setTargetUserType(Integer.valueOf(2).equals(dto.getTargetUserType()) ? dto.getTargetUserType() : null);
        boolean publishNow = Boolean.TRUE.equals(dto.getPublishNow());
        if (create) {
            entity.setStatus(publishNow ? PlatformAnnouncement.STATUS_PUBLISHED : PlatformAnnouncement.STATUS_DRAFT);
            entity.setPublisherId(SecurityUtil.getUserId());
            entity.setPublisherName(SecurityUtil.getName());
            announcementMapper.insert(entity);
        } else {
            if (publishNow) {
                entity.setStatus(PlatformAnnouncement.STATUS_PUBLISHED);
                entity.setPublisherId(SecurityUtil.getUserId());
                entity.setPublisherName(SecurityUtil.getName());
            }
            announcementMapper.updateById(entity);
        }
    }

    @Override
    public void publish(Long id) {
        PlatformAnnouncement entity = requireExists(id);
        entity.setStatus(PlatformAnnouncement.STATUS_PUBLISHED);
        entity.setPublisherId(SecurityUtil.getUserId());
        entity.setPublisherName(SecurityUtil.getName());
        // 重新发布（草稿/已撤回 → 已发布）：刷新生效时间为当前，保证立即生效且详情展示合理
        if (entity.getEffectiveAt() == null || entity.getEffectiveAt().isBefore(LocalDateTime.now())) {
            entity.setEffectiveAt(LocalDateTime.now());
        }
        announcementMapper.updateById(entity);
    }

    @Override
    public void withdraw(Long id) {
        PlatformAnnouncement entity = requireExists(id);
        entity.setStatus(PlatformAnnouncement.STATUS_WITHDRAWN);
        announcementMapper.updateById(entity);
    }

    @Override
    public void delete(Long id) {
        requireExists(id);
        announcementMapper.deleteById(id);
    }

    @Override
    public AnnouncementStatsVO stats(Long id) {
        PlatformAnnouncement entity = requireExists(id);
        List<AnnouncementStatsVO.TenantStat> tenants = announcementMapper.selectTenantStats(id);
        AnnouncementStatsVO vo = new AnnouncementStatsVO();
        vo.setAnnouncementId(id);
        vo.setTitle(entity.getTitle());
        vo.setRequireAck(entity.getRequireAck());
        vo.setTargetUserType(entity.getTargetUserType());
        int userCount = 0;
        int readCount = 0;
        int ackCount = 0;
        for (AnnouncementStatsVO.TenantStat stat : tenants) {
            userCount += nz(stat.getUserCount());
            readCount += nz(stat.getReadCount());
            ackCount += nz(stat.getAckCount());
        }
        vo.setUserCount(userCount);
        vo.setReadCount(readCount);
        vo.setAckCount(ackCount);
        vo.setTenants(tenants);
        return vo;
    }

    @Override
    public List<NotifyOptionVO> tenantOptions() {
        return announcementMapper.selectTenantOptions();
    }

    /* ------------------------------ 私有方法 ------------------------------ */

    private AnnouncementAdminVO toAdminVO(PlatformAnnouncement entity, Map<Long, TargetCountRow> feedbackCounts) {
        AnnouncementAdminVO vo = new AnnouncementAdminVO();
        vo.setId(entity.getId());
        vo.setTitle(entity.getTitle());
        vo.setContent(entity.getContent());
        vo.setNoticeType(entity.getNoticeType());
        vo.setTargetScope(entity.getTargetScope());
        vo.setTargetPlanType(entity.getTargetPlanType());
        vo.setTargetTenantIds(entity.getTargetTenantIds());
        vo.setEffectiveAt(entity.getEffectiveAt());
        vo.setExpireAt(entity.getExpireAt());
        vo.setRequireAck(entity.getRequireAck());
        vo.setTargetUserType(entity.getTargetUserType());
        vo.setStatus(entity.getStatus());
        vo.setPublisherName(entity.getPublisherName());
        vo.setCreateTime(entity.getCreateTime());        // 已读/确认人数（读记录仅在用户阅读/确认时写入）
        vo.setReadCount(countRead(entity.getId(), false));
        vo.setAckCount(countRead(entity.getId(), true));
        // 私密反馈数（顶层工单数）与待处理数，供平台侧判断哪些公告有人反馈没消化
        TargetCountRow feedback = feedbackCounts.get(entity.getId());
        vo.setFeedbackCount(feedback == null || feedback.getTotal() == null ? 0 : feedback.getTotal());
        vo.setPendingFeedbackCount(feedback == null || feedback.getPending() == null ? 0 : feedback.getPending());
        return vo;
    }

    /** 列表页批量统计反馈工单数（避免逐行查询） */
    private Map<Long, TargetCountRow> loadFeedbackCounts(List<PlatformAnnouncement> announcements) {
        List<Long> ids = announcements.stream().map(PlatformAnnouncement::getId).toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return messageMapper.countThreadsByTargets(NotifyMessage.TARGET_ANNOUNCEMENT, ids).stream()
                .collect(Collectors.toMap(TargetCountRow::getTargetId, row -> row, (a, b) -> a));
    }

    private Integer countRead(Long announcementId, boolean ack) {
        LambdaQueryWrapper<PlatformAnnouncementRead> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PlatformAnnouncementRead::getAnnouncementId, announcementId);
        if (ack) {
            wrapper.isNotNull(PlatformAnnouncementRead::getAckAt);
        }
        Long count = readMapper.selectCount(wrapper);
        return count == null ? 0 : count.intValue();
    }

    private PlatformAnnouncement requireExists(Long id) {
        PlatformAnnouncement entity = announcementMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(4004, "公告不存在");
        }
        return entity;
    }

    private LocalDateTime parseDateTime(String text, LocalDateTime fallback) {
        if (!StringUtils.hasText(text)) {
            return fallback;
        }
        try {
            return LocalDateTime.parse(text, DATE_TIME);
        } catch (Exception e) {
            try {
                return LocalDate.parse(text, DateTimeFormatter.ofPattern("yyyy-MM-dd")).atStartOfDay();
            } catch (Exception ignored) {
                throw new BusinessException(4001, "时间格式不合法，应为 yyyy-MM-dd HH:mm:ss");
            }
        }
    }

    private int nz(Integer value) {
        return value == null ? 0 : value;
    }
}
