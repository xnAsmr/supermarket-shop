package com.supermarket.erp.module.notify.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.notify.entity.PlatformAnnouncement;
import com.supermarket.erp.module.notify.vo.AnnouncementStatsVO;
import com.supermarket.erp.module.notify.vo.AnnouncementVO;
import com.supermarket.erp.module.notify.vo.NotifyOptionVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface PlatformAnnouncementMapper extends BaseMapper<PlatformAnnouncement> {

    /**
     * 用户侧可见公告（含当前用户已读/确认状态）
     * 可见性：已发布 + effective_at <= NOW()（查询时判断，定时发布无需任务扫描）
     *        + 未过期 + 命中定向范围（全部/按套餐/指定租户） + 命中定向用户类型（NULL=全部 / 2=仅系统管理员）
     */
    @Select("<script>" +
            "SELECT a.id, a.title, a.content, a.notice_type AS noticeType, a.require_ack AS requireAck, " +
            "a.target_user_type AS targetUserType, " +
            "a.effective_at AS effectiveAt, a.publisher_name AS publisherName, " +
            "r.read_at AS readAt, r.ack_at AS ackAt " +
            "FROM platform_announcement a " +
            "JOIN sys_user u ON u.id = #{userId} AND u.deleted = 0 " +
            "LEFT JOIN platform_announcement_read r ON r.announcement_id = a.id AND r.user_id = #{userId} " +
            "WHERE a.deleted = 0 AND a.status = 1 " +
            "AND a.effective_at &lt;= NOW() " +
            "AND (a.expire_at IS NULL OR a.expire_at &gt; NOW()) " +
            "AND (a.target_scope = 'ALL' " +
            "  OR (a.target_scope = 'PLAN' AND a.target_plan_type = (SELECT plan_type FROM sys_tenant WHERE id = #{tenantId})) " +
            "  OR (a.target_scope = 'ASSIGN' AND FIND_IN_SET(#{tenantId}, a.target_tenant_ids))) " +
            "AND (a.target_user_type IS NULL OR u.user_type = a.target_user_type) " +
            "ORDER BY a.effective_at DESC " +
            "LIMIT 100" +
            "</script>")
    List<AnnouncementVO> selectVisibleForUser(@Param("tenantId") Long tenantId, @Param("userId") Long userId);

    /**
     * 用户侧单条公告详情（详情页直链/刷新用）
     * 可见性口径与 selectVisibleForUser 完全一致，只是收窄到单条并去掉分页上限
     */
    @Select("<script>" +
            "SELECT a.id, a.title, a.content, a.notice_type AS noticeType, a.require_ack AS requireAck, " +
            "a.target_user_type AS targetUserType, " +
            "a.effective_at AS effectiveAt, a.publisher_name AS publisherName, " +
            "r.read_at AS readAt, r.ack_at AS ackAt " +
            "FROM platform_announcement a " +
            "JOIN sys_user u ON u.id = #{userId} AND u.deleted = 0 " +
            "LEFT JOIN platform_announcement_read r ON r.announcement_id = a.id AND r.user_id = #{userId} " +
            "WHERE a.id = #{announcementId} AND a.deleted = 0 AND a.status = 1 " +
            "AND a.effective_at &lt;= NOW() " +
            "AND (a.expire_at IS NULL OR a.expire_at &gt; NOW()) " +
            "AND (a.target_scope = 'ALL' " +
            "  OR (a.target_scope = 'PLAN' AND a.target_plan_type = (SELECT plan_type FROM sys_tenant WHERE id = #{tenantId})) " +
            "  OR (a.target_scope = 'ASSIGN' AND FIND_IN_SET(#{tenantId}, a.target_tenant_ids))) " +
            "AND (a.target_user_type IS NULL OR u.user_type = a.target_user_type)" +
            "</script>")
    AnnouncementVO selectVisibleDetail(@Param("announcementId") Long announcementId,
                                      @Param("tenantId") Long tenantId,
                                      @Param("userId") Long userId);

    /**
     * 当前用户是否可见指定公告（留言前的越权校验：与列表可见性口径完全一致）
     * 口径：已发布 + 生效/未过期 + 命中定向范围 + 命中定向用户类型
     */
    @Select("<script>" +
            "SELECT COUNT(1) FROM platform_announcement a " +
            "JOIN sys_user u ON u.id = #{userId} AND u.deleted = 0 " +
            "WHERE a.id = #{announcementId} AND a.deleted = 0 AND a.status = 1 " +
            "AND a.effective_at &lt;= NOW() " +
            "AND (a.expire_at IS NULL OR a.expire_at &gt; NOW()) " +
            "AND (a.target_scope = 'ALL' " +
            "  OR (a.target_scope = 'PLAN' AND a.target_plan_type = (SELECT plan_type FROM sys_tenant WHERE id = #{tenantId})) " +
            "  OR (a.target_scope = 'ASSIGN' AND FIND_IN_SET(#{tenantId}, a.target_tenant_ids))) " +
            "AND (a.target_user_type IS NULL OR u.user_type = a.target_user_type)" +
            "</script>")
    int countVisibleForUser(@Param("announcementId") Long announcementId,
                            @Param("tenantId") Long tenantId,
                            @Param("userId") Long userId);

    /** 公告已读统计：按目标租户聚合（应读=目标租户下启用用户，命中定向用户类型） */
    @Select("<script>" +
            "SELECT t.id AS tenantId, t.tenant_name AS tenantName, " +
            "COUNT(DISTINCT u.id) AS userCount, " +
            "COUNT(DISTINCT r.user_id) AS readCount, " +
            "COUNT(DISTINCT CASE WHEN r.ack_at IS NOT NULL THEN r.user_id END) AS ackCount " +
            "FROM platform_announcement a " +
            "JOIN sys_tenant t ON (a.target_scope = 'ALL' " +
            "  OR (a.target_scope = 'PLAN' AND a.target_plan_type = t.plan_type) " +
            "  OR (a.target_scope = 'ASSIGN' AND FIND_IN_SET(t.id, a.target_tenant_ids))) " +
            "JOIN sys_user u ON u.tenant_id = t.id AND u.deleted = 0 AND u.status = 1 " +
            "  AND (a.target_user_type IS NULL OR u.user_type = a.target_user_type) " +
            "LEFT JOIN platform_announcement_read r ON r.announcement_id = a.id AND r.user_id = u.id " +
            "WHERE a.id = #{announcementId} AND a.deleted = 0 " +
            "GROUP BY t.id, t.tenant_name " +
            "ORDER BY t.id" +
            "</script>")
    List<AnnouncementStatsVO.TenantStat> selectTenantStats(@Param("announcementId") Long announcementId);

    /** 租户选项（定向指定租户用） */
    @Select("SELECT id, tenant_name AS name, plan_type AS planType FROM sys_tenant WHERE deleted = 0 ORDER BY id")
    List<NotifyOptionVO> selectTenantOptions();
}
