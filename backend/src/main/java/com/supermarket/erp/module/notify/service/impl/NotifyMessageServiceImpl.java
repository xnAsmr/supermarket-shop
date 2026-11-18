package com.supermarket.erp.module.notify.service.impl;

import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.notify.dto.MessageCreateDTO;
import com.supermarket.erp.module.notify.entity.NotifyMessage;
import com.supermarket.erp.module.notify.entity.PlatformAnnouncement;
import com.supermarket.erp.module.notify.entity.TenantNotice;
import com.supermarket.erp.module.notify.mapper.NotifyMessageMapper;
import com.supermarket.erp.module.notify.mapper.NotifyMessageReadMapper;
import com.supermarket.erp.module.notify.mapper.PlatformAnnouncementMapper;
import com.supermarket.erp.module.notify.mapper.TenantNoticeMapper;
import com.supermarket.erp.module.notify.service.INotifyEventService;
import com.supermarket.erp.module.notify.service.INotifyMessageService;
import com.supermarket.erp.module.notify.vo.FeedbackThreadVO;
import com.supermarket.erp.module.notify.vo.NoticeAudienceRow;
import com.supermarket.erp.module.notify.vo.NotifyMessageVO;
import com.supermarket.erp.module.notify.vo.NotifyOptionVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 公告/通知留言实现
 *
 * 权限与可见性红线：
 * - tenant_id / user_id / author_type 全部取自会话，绝不接受前端传参
 * - 读留言前必须先校验「能否看到公告/通知」，校验 SQL 与列表可见性完全一致（复用 Mapper）
 * - 私密反馈只查「本人发起的工单」，平台侧才允许按 target 全量查看
 */
@Service
@RequiredArgsConstructor
public class NotifyMessageServiceImpl implements INotifyMessageService {

    private static final int MAX_CONTENT_LENGTH = 1000;
    /** 事件类型：平台公告收到新反馈 */
    private static final String EVENT_FEEDBACK_CREATED = "ANNOUNCEMENT_FEEDBACK";
    /** 事件类型：平台已回复反馈 */
    private static final String EVENT_FEEDBACK_REPLIED = "ANNOUNCEMENT_FEEDBACK_REPLY";
    private static final String BIZ_FEEDBACK = "ANNOUNCEMENT_FEEDBACK";
    /** 事件类型：租户通知留言中有人被 @ */
    private static final String EVENT_NOTICE_MENTION = "NOTICE_COMMENT_MENTION";
    private static final String BIZ_NOTICE_COMMENT = "NOTICE_COMMENT";
    /** 事件提醒正文的最大长度（消息中心列表只展示一行） */
    private static final int EVENT_BRIEF_LENGTH = 120;

    private final NotifyMessageMapper messageMapper;
    private final NotifyMessageReadMapper messageReadMapper;
    private final PlatformAnnouncementMapper announcementMapper;
    private final TenantNoticeMapper noticeMapper;
    private final INotifyEventService eventService;

    @Override
    public List<NotifyMessageVO> list(String targetType, Long targetId) {
        String type = normalizeTargetType(targetType);
        if (targetId == null) {
            throw new BusinessException(4001, "留言对象不能为空");
        }
        Long userId = SecurityUtil.getUserId();
        requireVisible(type, targetId, SecurityUtil.getTenantId(), userId);

        List<NotifyMessage> raw;
        if (NotifyMessage.TARGET_ANNOUNCEMENT.equals(type)) {
            raw = messageMapper.selectPrivateMessagesOfUser(type, targetId, userId);
        } else {
            raw = messageMapper.selectAudienceMessages(type, targetId);
        }
        return toVOList(raw, userId, NotifyMessage.TARGET_NOTICE.equals(type));
    }

    @Override
    public void create(MessageCreateDTO dto) {
        String type = normalizeTargetType(dto.getTargetType());
        if (dto.getTargetId() == null) {
            throw new BusinessException(4001, "留言对象不能为空");
        }
        String content = normalizeContent(dto.getContent());
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        requireVisible(type, dto.getTargetId(), tenantId, userId);

        NotifyMessage message = new NotifyMessage();
        message.setTargetType(type);
        message.setTargetId(dto.getTargetId());
        message.setTenantId(tenantId);
        message.setStoreId(SecurityUtil.getStoreId());
        message.setUserId(userId);
        message.setUserName(SecurityUtil.getName());
        message.setAuthorType(NotifyMessage.AUTHOR_TENANT_USER);
        message.setContent(content);
        message.setStatus(NotifyMessage.STATUS_NORMAL);

        if (NotifyMessage.TARGET_ANNOUNCEMENT.equals(type)) {
            // 平台公告：一条顶层留言 = 一个私密工单，不支持用户侧嵌套回复
            message.setScope(NotifyMessage.SCOPE_PRIVATE);
            message.setParentId(0L);
            message.setThreadStatus(NotifyMessage.THREAD_PENDING);
            message.setPinned(0);
            messageMapper.insert(message);
            notifyPlatformNewFeedback(message);
            return;
        }

        // 租户通知：公告内公开留言，最多一层回复（回复统一挂到顶层留言）
        message.setScope(NotifyMessage.SCOPE_AUDIENCE);
        message.setParentId(resolveAudienceParent(dto, type));
        message.setPinned(0);
        applyMentions(message, dto.getMentionedUserIds(), tenantId, userId);
        messageMapper.insert(message);
        notifyMentionedUsers(message);
    }

    @Override
    public List<NotifyOptionVO> mentionCandidates(Long noticeId) {
        if (noticeId == null) {
            throw new BusinessException(4001, "通知不能为空");
        }
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        requireVisible(NotifyMessage.TARGET_NOTICE, noticeId, tenantId, userId);
        // 候选范围 = 这条通知的应读用户（复用定向范围 SQL），排除自己
        return noticeMapper.selectAudience(noticeId, tenantId).stream()
                .filter(row -> row.getUserId() != null && !row.getUserId().equals(userId))
                .map(row -> {
                    NotifyOptionVO option = new NotifyOptionVO();
                    option.setId(row.getUserId());
                    String name = row.getUserName() == null ? "同事" : row.getUserName();
                    // 重名时靠门店区分，否则选人时无法分辨
                    option.setName(StringUtils.hasText(row.getStoreName())
                            ? name + "（" + row.getStoreName() + "）" : name);
                    return option;
                })
                .toList();
    }

    @Override
    public void markRead(String targetType, Long targetId) {
        String type = normalizeTargetType(targetType);
        if (targetId == null) {
            throw new BusinessException(4001, "留言对象不能为空");
        }
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        requireVisible(type, targetId, tenantId, userId);
        Long maxId = NotifyMessage.TARGET_ANNOUNCEMENT.equals(type)
                ? messageMapper.selectMaxPrivateMessageIdOfUser(type, targetId, userId)
                : messageMapper.selectMaxAudienceMessageId(type, targetId);
        messageReadMapper.upsertRead(type, targetId, tenantId, userId,
                maxId == null ? 0L : maxId, LocalDateTime.now());
    }

    @Override
    public void withdraw(Long messageId) {
        NotifyMessage message = messageMapper.selectById(messageId);
        if (message == null) {
            throw new BusinessException(4004, "留言不存在");
        }
        if (!Objects.equals(message.getUserId(), SecurityUtil.getUserId())
                || !Objects.equals(message.getAuthorType(), NotifyMessage.AUTHOR_TENANT_USER)) {
            throw new BusinessException(403, "只能撤回自己的留言");
        }
        if (nzStatus(message.getStatus()) != NotifyMessage.STATUS_NORMAL) {
            throw new BusinessException(4001, "该留言已不可撤回");
        }
        if (message.getCreateTime() == null
                || message.getCreateTime().isBefore(LocalDateTime.now().minusSeconds(
                NotifyMessage.WITHDRAW_WINDOW_MILLIS / 1000))) {
            throw new BusinessException(4001, "超过 5 分钟的留言无法撤回，请联系管理员处理");
        }
        message.setStatus(NotifyMessage.STATUS_WITHDRAWN);
        messageMapper.updateById(message);
    }

    @Override
    public List<FeedbackThreadVO> threads(Long announcementId) {
        requireAnnouncement(announcementId);
        return messageMapper.selectFeedbackThreads(NotifyMessage.TARGET_ANNOUNCEMENT, announcementId);
    }

    @Override
    public FeedbackThreadVO threadDetail(Long threadId) {
        NotifyMessage thread = requirePrivateThread(threadId);
        List<NotifyMessage> messages = messageMapper.selectThreadMessages(thread.getId());
        FeedbackThreadVO vo = messageMapper
                .selectFeedbackThreads(NotifyMessage.TARGET_ANNOUNCEMENT, thread.getTargetId())
                .stream()
                .filter(item -> Objects.equals(item.getId(), thread.getId()))
                .findFirst()
                .orElseGet(() -> {
                    FeedbackThreadVO fallback = new FeedbackThreadVO();
                    fallback.setId(thread.getId());
                    fallback.setTenantId(thread.getTenantId());
                    fallback.setUserId(thread.getUserId());
                    fallback.setUserName(thread.getUserName());
                    fallback.setContent(thread.getContent());
                    fallback.setThreadStatus(thread.getThreadStatus());
                    fallback.setCreateTime(thread.getCreateTime());
                    return fallback;
                });
        vo.setMessages(toVOList(messages, SecurityUtil.getUserId(), false));
        return vo;
    }

    @Override
    public void reply(Long threadId, String content) {
        String text = normalizeContent(content);
        NotifyMessage thread = requirePrivateThread(threadId);
        if (NotifyMessage.THREAD_CLOSED.equals(thread.getThreadStatus())) {
            throw new BusinessException(4001, "工单已关闭，无法继续回复");
        }

        NotifyMessage reply = new NotifyMessage();
        reply.setTargetType(thread.getTargetType());
        reply.setTargetId(thread.getTargetId());
        // 平台回复沿用提问方租户：用户侧定向查询（tenant_id + user_id）才查得到
        reply.setTenantId(thread.getTenantId());
        reply.setStoreId(thread.getStoreId());
        reply.setUserId(SecurityUtil.getUserId());
        reply.setUserName(SecurityUtil.getName());
        reply.setAuthorType(NotifyMessage.AUTHOR_PLATFORM);
        reply.setScope(NotifyMessage.SCOPE_PRIVATE);
        reply.setParentId(thread.getId());
        reply.setContent(text);
        reply.setStatus(NotifyMessage.STATUS_NORMAL);
        messageMapper.insert(reply);

        thread.setThreadStatus(NotifyMessage.THREAD_REPLIED);
        thread.setReplyBy(SecurityUtil.getUserId());
        thread.setReplyByName(SecurityUtil.getName());
        thread.setReplyAt(LocalDateTime.now());
        messageMapper.updateById(thread);

        eventService.publishToUsers(thread.getTenantId(), thread.getStoreId(), List.of(thread.getUserId()),
                EVENT_FEEDBACK_REPLIED, "平台已回复你的反馈", text, BIZ_FEEDBACK, thread.getId());
    }

    @Override
    public void close(Long threadId) {
        NotifyMessage thread = requirePrivateThread(threadId);
        if (NotifyMessage.THREAD_CLOSED.equals(thread.getThreadStatus())) {
            return;
        }
        thread.setThreadStatus(NotifyMessage.THREAD_CLOSED);
        messageMapper.updateById(thread);
    }

    /* ------------------------------ 私有方法 ------------------------------ */

    /** 租户通知的回复：只允许回复本通知下、正常状态的顶层留言，并统一挂到顶层 */
    private Long resolveAudienceParent(MessageCreateDTO dto, String type) {
        if (dto.getParentId() == null || dto.getParentId() <= 0) {
            return 0L;
        }
        NotifyMessage parent = messageMapper.selectById(dto.getParentId());
        if (parent == null
                || !type.equals(parent.getTargetType())
                || !Objects.equals(dto.getTargetId(), parent.getTargetId())
                || !NotifyMessage.SCOPE_AUDIENCE.equals(parent.getScope())
                || nzStatus(parent.getStatus()) != NotifyMessage.STATUS_NORMAL) {
            throw new BusinessException(4004, "被回复的留言不存在");
        }
        return parent.getParentId() == null || parent.getParentId() == 0 ? parent.getId() : parent.getParentId();
    }

    /**
     * 应用 @ 提醒：只保留「这条通知的应读用户」中的合法对象。
     * 越权/失效的 ID 静默丢弃（例如通知定向范围在提交前被调整），不阻断留言本身。
     */
    private void applyMentions(NotifyMessage message, List<Long> rawIds, Long tenantId, Long userId) {
        if (rawIds == null || rawIds.isEmpty()) {
            return;
        }
        Map<Long, String> audience = noticeMapper.selectAudience(message.getTargetId(), tenantId).stream()
                .filter(row -> row.getUserId() != null)
                .collect(Collectors.toMap(NoticeAudienceRow::getUserId,
                        row -> row.getUserName() == null ? "同事" : row.getUserName(), (a, b) -> a));
        List<Long> valid = rawIds.stream()
                .filter(id -> id != null && id > 0 && !id.equals(userId))
                .distinct()
                .filter(audience::containsKey)
                .toList();
        if (valid.isEmpty()) {
            return;
        }
        message.setMentionedUserIds(valid.stream().map(String::valueOf).collect(Collectors.joining(",")));
        message.setMentionedNames(valid.stream().map(audience::get).collect(Collectors.joining(",")));
    }

    /** 被 @ 的人收到事件提醒（bizId = 该条留言，点击可回到对应通知） */
    private void notifyMentionedUsers(NotifyMessage message) {
        List<Long> ids = parseIds(message.getMentionedUserIds());
        if (ids.isEmpty()) {
            return;
        }
        TenantNotice notice = noticeMapper.selectById(message.getTargetId());
        String brief = abbreviate(message.getContent());
        String title = (StringUtils.hasText(message.getUserName()) ? message.getUserName() : "有同事")
                + " 在通知中 @ 了你";
        String content = notice == null ? brief : "《" + notice.getTitle() + "》" + brief;
        eventService.publishToUsers(message.getTenantId(), notice == null ? null : notice.getStoreId(),
                ids, EVENT_NOTICE_MENTION, title, content, BIZ_NOTICE_COMMENT, message.getId());
    }

    /** 新反馈提醒平台超管（超管自己提的反馈不提醒自己所在的平台侧） */
    private void notifyPlatformNewFeedback(NotifyMessage message) {
        if (SecurityUtil.isSuperAdmin()) {
            return;
        }
        PlatformAnnouncement announcement = announcementMapper.selectById(message.getTargetId());
        String title = announcement == null ? "公告" : "《" + announcement.getTitle() + "》";
        eventService.publishToPlatformAdmins(EVENT_FEEDBACK_CREATED, "收到新的公告反馈",
                title + "收到一条新的反馈，请及时处理", BIZ_FEEDBACK, message.getId());
    }

    /**
     * 可见性校验：必须能看见公告/通知，才能查看或参与留言
     * 校验 SQL 与用户侧列表可见性完全一致（已发布/未撤回 + 定向范围 + 门店约束）
     */
    private void requireVisible(String type, Long targetId, Long tenantId, Long userId) {
        int count = NotifyMessage.TARGET_ANNOUNCEMENT.equals(type)
                ? announcementMapper.countVisibleForUser(targetId, tenantId, userId)
                : noticeMapper.countVisibleForUser(targetId, tenantId, userId);
        if (count <= 0) {
            throw new BusinessException(403, "无权查看或参与该留言");
        }
    }

    private void requireAnnouncement(Long announcementId) {
        if (announcementId == null || announcementMapper.selectById(announcementId) == null) {
            throw new BusinessException(4004, "公告不存在");
        }
    }

    private NotifyMessage requirePrivateThread(Long threadId) {
        NotifyMessage thread = threadId == null ? null : messageMapper.selectById(threadId);
        if (thread == null
                || !NotifyMessage.SCOPE_PRIVATE.equals(thread.getScope())
                || thread.getParentId() == null
                || thread.getParentId() != 0
                || nzStatus(thread.getStatus()) != NotifyMessage.STATUS_NORMAL) {
            throw new BusinessException(4004, "反馈工单不存在");
        }
        return thread;
    }

    private String normalizeTargetType(String targetType) {
        String type = StringUtils.hasText(targetType) ? targetType.trim().toUpperCase() : "";
        if (!NotifyMessage.TARGET_ANNOUNCEMENT.equals(type) && !NotifyMessage.TARGET_NOTICE.equals(type)) {
            throw new BusinessException(4001, "留言对象类型不合法");
        }
        return type;
    }

    private String normalizeContent(String content) {
        String text = content == null ? "" : content.trim();
        if (!StringUtils.hasText(text)) {
            throw new BusinessException(4001, "留言内容不能为空");
        }
        if (text.length() > MAX_CONTENT_LENGTH) {
            throw new BusinessException(4001, "留言内容不能超过 " + MAX_CONTENT_LENGTH + " 字");
        }
        return text;
    }

    /**
     * 转 VO 并做一层孤儿过滤：AUDIENCE 顶层留言被撤回/屏蔽后，其回复不再展示
     */
    private List<NotifyMessageVO> toVOList(List<NotifyMessage> raw, Long currentUserId, boolean filterOrphan) {
        List<NotifyMessage> list = raw;
        if (filterOrphan) {
            Set<Long> rootIds = raw.stream()
                    .filter(item -> item.getParentId() == null || item.getParentId() == 0)
                    .map(NotifyMessage::getId)
                    .collect(Collectors.toSet());
            list = raw.stream()
                    .filter(item -> item.getParentId() == null || item.getParentId() == 0
                            || rootIds.contains(item.getParentId()))
                    .toList();
        }
        return list.stream().map(item -> toVO(item, currentUserId)).toList();
    }

    private NotifyMessageVO toVO(NotifyMessage entity, Long currentUserId) {
        NotifyMessageVO vo = new NotifyMessageVO();
        vo.setId(entity.getId());
        vo.setTargetType(entity.getTargetType());
        vo.setTargetId(entity.getTargetId());
        vo.setTenantId(entity.getTenantId());
        vo.setUserId(entity.getUserId());
        vo.setUserName(entity.getUserName());
        vo.setAuthorType(entity.getAuthorType());
        vo.setScope(entity.getScope());
        vo.setParentId(entity.getParentId());
        vo.setThreadStatus(entity.getThreadStatus());
        vo.setReplyByName(entity.getReplyByName());
        vo.setReplyAt(entity.getReplyAt());
        vo.setContent(entity.getContent());
        vo.setPinned(entity.getPinned() != null && entity.getPinned() == 1);
        vo.setMentionedNames(parseNames(entity.getMentionedNames()));
        vo.setStatus(entity.getStatus());
        vo.setCreateTime(entity.getCreateTime());
        boolean mine = Objects.equals(entity.getUserId(), currentUserId)
                && Objects.equals(entity.getAuthorType(), NotifyMessage.AUTHOR_TENANT_USER);
        vo.setMine(mine);
        vo.setCanWithdraw(mine
                && nzStatus(entity.getStatus()) == NotifyMessage.STATUS_NORMAL
                && entity.getCreateTime() != null
                && entity.getCreateTime().isAfter(LocalDateTime.now().minusMinutes(
                NotifyMessage.WITHDRAW_WINDOW_MILLIS / 1000)));
        return vo;
    }

    private int nzStatus(Integer status) {
        return status == null ? NotifyMessage.STATUS_NORMAL : status;
    }

    /** 逗号分隔的 ID 字符串 → ID 列表（去重、忽略空项） */
    private List<Long> parseIds(String joined) {
        if (!StringUtils.hasText(joined)) {
            return List.of();
        }
        return Arrays.stream(joined.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .map(Long::valueOf)
                .distinct()
                .toList();
    }

    /** 逗号分隔的姓名快照 → 姓名列表 */
    private List<String> parseNames(String joined) {
        if (!StringUtils.hasText(joined)) {
            return List.of();
        }
        return Arrays.stream(joined.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .toList();
    }

    /** 事件提醒正文只展示一行，超长截断 */
    private String abbreviate(String text) {
        String value = text == null ? "" : text;
        return value.length() <= EVENT_BRIEF_LENGTH
                ? value : value.substring(0, EVENT_BRIEF_LENGTH) + "…";
    }
}
