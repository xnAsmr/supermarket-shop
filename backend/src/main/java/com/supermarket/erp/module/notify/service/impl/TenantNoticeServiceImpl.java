package com.supermarket.erp.module.notify.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.security.LoginUser;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.notify.dto.NoticeSendDTO;
import com.supermarket.erp.module.notify.dto.NotifyPageDTO;
import com.supermarket.erp.module.notify.entity.NotifyMessage;
import com.supermarket.erp.module.notify.entity.TenantNotice;
import com.supermarket.erp.module.notify.entity.TenantNoticeRead;
import com.supermarket.erp.module.notify.mapper.NotifyMessageMapper;
import com.supermarket.erp.module.notify.mapper.TenantNoticeMapper;
import com.supermarket.erp.module.notify.mapper.TenantNoticeReadMapper;
import com.supermarket.erp.module.notify.service.ITenantNoticeService;
import com.supermarket.erp.module.notify.vo.NoticeAudienceRow;
import com.supermarket.erp.module.notify.vo.NoticeStatsVO;
import com.supermarket.erp.module.notify.vo.NotifyOptionVO;
import com.supermarket.erp.module.notify.vo.TargetCountRow;
import com.supermarket.erp.module.notify.vo.TenantNoticeAdminVO;
import com.supermarket.erp.module.system.entity.Role;
import com.supermarket.erp.module.system.mapper.RoleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TenantNoticeServiceImpl implements ITenantNoticeService {

    /** 门店级角色编码（店长）：仅该角色会把通知范围收敛到本门店 */
    private static final String ROLE_CODE_STORE_MANAGER = "STORE_MANAGER";
    /** 租户管理员角色编码：持有者按总部口径，不做门店收敛 */
    private static final String ROLE_CODE_TENANT_ADMIN = "TENANT_ADMIN";

    private final TenantNoticeMapper noticeMapper;
    private final TenantNoticeReadMapper noticeReadMapper;
    private final NotifyMessageMapper messageMapper;
    private final RoleMapper roleMapper;

    @Override
    public PageResult<TenantNoticeAdminVO> page(NotifyPageDTO dto) {
        Long tenantId = SecurityUtil.getTenantId();
        int page = dto.getPage() == null || dto.getPage() < 1 ? 1 : dto.getPage();
        int size = dto.getPageSize() == null || dto.getPageSize() < 1 ? 10 : dto.getPageSize();
        LambdaQueryWrapper<TenantNotice> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(TenantNotice::getTenantId, tenantId)
               .like(StringUtils.hasText(dto.getKeyword()), TenantNotice::getTitle, dto.getKeyword())
               .orderByDesc(TenantNotice::getCreateTime);
        Page<TenantNotice> result = noticeMapper.selectPage(new Page<>(page, size), wrapper);

        Map<Long, Integer> commentCounts = loadCommentCounts(result.getRecords());
        List<TenantNoticeAdminVO> list = result.getRecords().stream()
                .map(notice -> toAdminVO(notice, commentCounts)).toList();
        return PageResult.of(list, result.getTotal(), page, size);
    }

    @Override
    public TenantNoticeAdminVO detail(Long noticeId) {
        // 复用 requireOwnNotice：本租户校验 + 店长仅本门店（与撤回/编辑同口径）
        TenantNotice notice = requireOwnNotice(noticeId);
        return toAdminVO(notice, loadCommentCounts(List.of(notice)));
    }

    @Override
    public void send(NoticeSendDTO dto) {
        Long tenantId = SecurityUtil.getTenantId();
        Long senderId = SecurityUtil.getUserId();
        Long senderStoreId = SecurityUtil.getStoreId();

        validateScope(dto);

        TenantNotice notice = new TenantNotice();
        notice.setTenantId(tenantId);
        notice.setTitle(dto.getTitle());
        notice.setContent(dto.getContent());
        notice.setNoticeType(normalizeType(dto.getNoticeType()));
        applyTargeting(notice, dto, senderStoreId);
        notice.setSenderId(senderId);
        notice.setSenderName(SecurityUtil.getName());
        notice.setSendTime(LocalDateTime.now());
        noticeMapper.insert(notice);
    }

    @Override
    public void update(Long noticeId, NoticeSendDTO dto) {
        validateScope(dto);
        TenantNotice notice = noticeMapper.selectById(noticeId);
        if (notice == null || !SecurityUtil.getTenantId().equals(notice.getTenantId())) {
            throw new BusinessException(4004, "通知不存在或无权操作");
        }
        // 店长只能改本门店通知（口径与 send() 的收敛一致）
        if (isStoreManagerSender() && !Objects.equals(notice.getStoreId(), SecurityUtil.getStoreId())) {
            throw new BusinessException(403, "店长只能编辑本门店的通知");
        }
        notice.setTitle(dto.getTitle());
        notice.setContent(dto.getContent());
        notice.setNoticeType(normalizeType(dto.getNoticeType()));
        // 定向范围可调整（扩大/缩小接收人），发送人与发送时间保持原值
        applyTargeting(notice, dto, SecurityUtil.getStoreId());
        noticeMapper.updateById(notice);
    }

    /**
     * 通知类型归一化：为空按「门店通知」(1) 处理；仅接受 1/2/3，
     * 其他值（含历史脏数据、异常入参）一律按 1 处理，避免列表标签出现未知类型
     */
    private int normalizeType(Integer noticeType) {
        if (noticeType == null) {
            return TenantNotice.TYPE_STORE;
        }
        return noticeType == TenantNotice.TYPE_STORE || noticeType == TenantNotice.TYPE_RULE
                || noticeType == TenantNotice.TYPE_EVENT
                ? noticeType
                : TenantNotice.TYPE_STORE;
    }

    @Override
    public void withdraw(Long noticeId) {
        TenantNotice notice = requireOwnNotice(noticeId);
        notice.setStatus(TenantNotice.STATUS_WITHDRAWN);
        noticeMapper.updateById(notice);
    }

    @Override
    public void publish(Long noticeId) {
        TenantNotice notice = requireOwnNotice(noticeId);
        notice.setStatus(TenantNotice.STATUS_SENT);
        // 重新发布 = 重新上线：刷新发送时间，立即可见、重新计入未读
        notice.setSendTime(LocalDateTime.now());
        noticeMapper.updateById(notice);
    }

    /**
     * 取通知并做权限校验（撤回/重新发布/删除共用）：
     * 仅本租户；店长（角色=STORE_MANAGER）只能操作本门店通知（口径与 update() 一致）
     */
    private TenantNotice requireOwnNotice(Long noticeId) {
        TenantNotice notice = noticeMapper.selectById(noticeId);
        if (notice == null || !SecurityUtil.getTenantId().equals(notice.getTenantId())) {
            throw new BusinessException(4004, "通知不存在或无权操作");
        }
        if (isStoreManagerSender() && !Objects.equals(notice.getStoreId(), SecurityUtil.getStoreId())) {
            throw new BusinessException(403, "店长只能操作本门店的通知");
        }
        return notice;
    }

    /** 发送/编辑共用的参数校验 */
    private void validateScope(NoticeSendDTO dto) {
        if (!StringUtils.hasText(dto.getTitle())) {
            throw new BusinessException(4001, "通知标题不能为空");
        }
        String scope = StringUtils.hasText(dto.getTargetScope()) ? dto.getTargetScope() : TenantNotice.SCOPE_ALL;
        if (!TenantNotice.SCOPE_ALL.equals(scope) && !TenantNotice.SCOPE_STORE.equals(scope)
                && !TenantNotice.SCOPE_ROLE.equals(scope) && !TenantNotice.SCOPE_USER.equals(scope)) {
            throw new BusinessException(4001, "定向范围不合法");
        }
        if (TenantNotice.SCOPE_STORE.equals(scope) && !StringUtils.hasText(dto.getTargetStoreIds())) {
            throw new BusinessException(4001, "按门店发送时必须选择门店");
        }
        if (TenantNotice.SCOPE_ROLE.equals(scope) && !StringUtils.hasText(dto.getTargetRoleIds())) {
            throw new BusinessException(4001, "按角色发送时必须选择角色");
        }
        if (TenantNotice.SCOPE_USER.equals(scope) && !StringUtils.hasText(dto.getTargetUserIds())) {
            throw new BusinessException(4001, "指定人员发送时必须选择人员");
        }
    }

    /**
     * 应用定向范围（发送/编辑共用）。
     * 店长（角色=STORE_MANAGER）只能发本门店；租户管理员/总部/超管(user_type=3)可发全租户或指定门店。
     * 注意：不能按“是否带门店归属”判定——租户管理员同样可能带 store_id（种子数据即如此），
     *       会被误降级为店长，导致人员列表只剩本门店、通知也被强制打上门店而发不出去
     */
    private void applyTargeting(TenantNotice notice, NoticeSendDTO dto, Long senderStoreId) {
        String scope = StringUtils.hasText(dto.getTargetScope()) ? dto.getTargetScope() : TenantNotice.SCOPE_ALL;
        notice.setTargetScope(scope);
        boolean storeScoped = isStoreManagerSender();
        if (storeScoped) {
            // 店长：只能发本门店（门店归属强制为本店，定向范围也收敛在本店内）
            notice.setStoreId(senderStoreId);
            notice.setTargetStoreIds(TenantNotice.SCOPE_STORE.equals(scope)
                    ? String.valueOf(senderStoreId) : dto.getTargetStoreIds());
        } else {
            // 老板/总部/超管：可发全租户或指定门店
            notice.setStoreId(null);
            notice.setTargetStoreIds(dto.getTargetStoreIds());
        }
        notice.setTargetRoleIds(dto.getTargetRoleIds());
        notice.setTargetUserIds(dto.getTargetUserIds());
    }

    @Override
    public NoticeStatsVO stats(Long noticeId) {
        Long tenantId = SecurityUtil.getTenantId();
        TenantNotice notice = noticeMapper.selectById(noticeId);
        if (notice == null || !tenantId.equals(notice.getTenantId())) {
            throw new BusinessException(4004, "通知不存在或无权查看");
        }
        List<NoticeAudienceRow> audience = noticeMapper.selectAudience(noticeId, tenantId);

        NoticeStatsVO vo = new NoticeStatsVO();
        vo.setNoticeId(noticeId);
        vo.setTitle(notice.getTitle());
        vo.setAudienceCount(audience.size());

        List<NoticeStatsVO.UnreadUser> unreadUsers = new ArrayList<>();
        // 按门店聚合（保持出现顺序）：storeId -> stat
        Map<Long, NoticeStatsVO.StoreStat> storeMap = new LinkedHashMap<>();
        int readCount = 0;
        for (NoticeAudienceRow row : audience) {
            if (row.getReadAt() != null) {
                readCount++;
            } else {
                NoticeStatsVO.UnreadUser user = new NoticeStatsVO.UnreadUser();
                user.setUserId(row.getUserId());
                user.setUserName(row.getUserName());
                user.setStoreName(row.getStoreName());
                unreadUsers.add(user);
            }
            Long storeId = row.getStoreId() == null ? -1L : row.getStoreId();
            NoticeStatsVO.StoreStat stat = storeMap.computeIfAbsent(storeId, k -> {
                NoticeStatsVO.StoreStat s = new NoticeStatsVO.StoreStat();
                s.setStoreId(storeId);
                s.setStoreName(row.getStoreName() == null ? "未分配门店" : row.getStoreName());
                s.setUserCount(0);
                s.setReadCount(0);
                return s;
            });
            stat.setUserCount(stat.getUserCount() + 1);
            if (row.getReadAt() != null) {
                stat.setReadCount(stat.getReadCount() + 1);
            }
        }
        vo.setReadCount(readCount);
        vo.setUnreadCount(unreadUsers.size());
        vo.setUnreadUsers(unreadUsers);
        vo.setStores(new ArrayList<>(storeMap.values()));
        return vo;
    }

    @Override
    public void delete(Long noticeId) {
        noticeMapper.deleteById(requireOwnNotice(noticeId).getId());
    }

    @Override
    public void hideComment(Long commentId) {
        NotifyMessage message = requireManageableComment(commentId);
        message.setStatus(NotifyMessage.STATUS_HIDDEN);
        // 屏蔽同时取消置顶，不占用置顶名额
        message.setPinned(0);
        messageMapper.updateById(message);
    }

    @Override
    public void pinComment(Long commentId, boolean pinned) {
        NotifyMessage message = requireManageableComment(commentId);
        if (message.getParentId() != null && message.getParentId() != 0) {
            throw new BusinessException(4001, "只能置顶顶层留言");
        }
        if (message.getStatus() != null && message.getStatus() != NotifyMessage.STATUS_NORMAL) {
            throw new BusinessException(4001, "该留言已被屏蔽或撤回，无法置顶");
        }
        boolean currentlyPinned = message.getPinned() != null && message.getPinned() == 1;
        if (pinned && !currentlyPinned) {
            int pinnedCount = messageMapper.countPinned(NotifyMessage.TARGET_NOTICE, message.getTargetId());
            if (pinnedCount >= NotifyMessage.MAX_PINNED_PER_TARGET) {
                throw new BusinessException(4001, "单条通知最多置顶 "
                        + NotifyMessage.MAX_PINNED_PER_TARGET + " 条留言，请先取消旧置顶");
            }
        }
        message.setPinned(pinned ? 1 : 0);
        messageMapper.updateById(message);
    }

    /**
     * 取可管理的公开留言并校验管理权（屏蔽/置顶共用）：
     * 仅本租户租户通知下的 AUDIENCE 留言；店长只能管本门店通知
     */
    private NotifyMessage requireManageableComment(Long commentId) {
        NotifyMessage message = commentId == null ? null : messageMapper.selectById(commentId);
        if (message == null
                || !NotifyMessage.TARGET_NOTICE.equals(message.getTargetType())
                || !NotifyMessage.SCOPE_AUDIENCE.equals(message.getScope())) {
            throw new BusinessException(4004, "留言不存在");
        }
        TenantNotice notice = noticeMapper.selectById(message.getTargetId());
        if (notice == null || !SecurityUtil.getTenantId().equals(notice.getTenantId())) {
            throw new BusinessException(4004, "留言不存在或无权操作");
        }
        if (isStoreManagerSender() && !Objects.equals(notice.getStoreId(), SecurityUtil.getStoreId())) {
            throw new BusinessException(403, "店长只能管理本门店通知的留言");
        }
        return message;
    }

    @Override
    public List<NotifyOptionVO> storeOptions() {
        Long tenantId = SecurityUtil.getTenantId();
        Long senderStoreId = SecurityUtil.getStoreId();
        List<NotifyOptionVO> options = noticeMapper.selectStoreOptions(tenantId);
        // 店长仅本门店；租户管理员/总部/超管可见全租户门店（口径与 send() 一致，按角色判定）
        boolean storeScoped = isStoreManagerSender();
        if (storeScoped) {
            options = options.stream().filter(o -> senderStoreId.equals(o.getId())).toList();
        }
        return options;
    }

    @Override
    public List<NotifyOptionVO> roleOptions() {
        return noticeMapper.selectRoleOptions(SecurityUtil.getTenantId());
    }

    @Override
    public List<NotifyOptionVO> userOptions() {
        Long tenantId = SecurityUtil.getTenantId();
        Long senderStoreId = SecurityUtil.getStoreId();
        // 店长仅限本门店人员；租户管理员/总部/超管可见全租户人员（含总部人员，口径与 send() 一致，按角色判定）
        boolean storeScoped = isStoreManagerSender();
        return noticeMapper.selectUserOptions(tenantId, storeScoped ? senderStoreId : null);
    }

    /**
     * 发送者是否为「店长」——按角色判定，而非按是否有门店归属：
     * 租户管理员等账号同样可能带 store_id（种子数据即如此），不能因此被降级为店长。
     * 判定 = 持有店长角色(STORE_MANAGER) 且 不持有租户管理员角色(TENANT_ADMIN) 且 非超级管理员。
     */
    private boolean isStoreManagerSender() {
        if (SecurityUtil.isSuperAdmin()) {
            return false;
        }
        LoginUser loginUser = SecurityUtil.getLoginUser();
        List<Long> roleIds = loginUser == null ? null : loginUser.getRoleIds();
        if (roleIds == null || roleIds.isEmpty()) {
            return false;
        }
        List<Role> roles = roleMapper.selectBatchIds(roleIds);
        boolean storeManager = roles.stream()
                .anyMatch(r -> ROLE_CODE_STORE_MANAGER.equals(r.getRoleCode()));
        boolean tenantAdmin = roles.stream()
                .anyMatch(r -> ROLE_CODE_TENANT_ADMIN.equals(r.getRoleCode()));
        return storeManager && !tenantAdmin;
    }

    /* ------------------------------ 私有方法 ------------------------------ */

    private TenantNoticeAdminVO toAdminVO(TenantNotice entity, Map<Long, Integer> commentCounts) {
        TenantNoticeAdminVO vo = new TenantNoticeAdminVO();
        vo.setId(entity.getId());
        vo.setTitle(entity.getTitle());
        vo.setContent(entity.getContent());
        vo.setNoticeType(normalizeType(entity.getNoticeType()));
        vo.setTargetScope(entity.getTargetScope());
        vo.setTargetStoreIds(entity.getTargetStoreIds());
        vo.setTargetRoleIds(entity.getTargetRoleIds());
        vo.setTargetUserIds(entity.getTargetUserIds());
        vo.setStoreId(entity.getStoreId());
        vo.setSenderName(entity.getSenderName());
        vo.setSendTime(entity.getSendTime());
        vo.setStatus(entity.getStatus() == null ? TenantNotice.STATUS_SENT : entity.getStatus());
        vo.setCreateTime(entity.getCreateTime());
        // 应读/已读人数（应读=按定向范围匹配的启用用户）
        List<NoticeAudienceRow> audience = noticeMapper.selectAudience(entity.getId(), entity.getTenantId());
        vo.setAudienceCount(audience.size());
        vo.setReadCount((int) audience.stream().filter(r -> r.getReadAt() != null).count());
        // 公告内留言数（顶层留言数，不含回复）
        vo.setCommentCount(commentCounts.getOrDefault(entity.getId(), 0));
        return vo;
    }

    /** 列表页批量统计留言数（避免逐行查询） */
    private Map<Long, Integer> loadCommentCounts(List<TenantNotice> notices) {
        List<Long> ids = notices.stream().map(TenantNotice::getId).filter(Objects::nonNull).toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        return messageMapper.countThreadsByTargets(NotifyMessage.TARGET_NOTICE, ids).stream()
                .collect(Collectors.toMap(TargetCountRow::getTargetId,
                        row -> row.getTotal() == null ? 0 : row.getTotal(), (a, b) -> a));
    }
}
