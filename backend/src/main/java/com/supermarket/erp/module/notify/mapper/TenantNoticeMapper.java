package com.supermarket.erp.module.notify.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.notify.entity.TenantNotice;
import com.supermarket.erp.module.notify.vo.NoticeAudienceRow;
import com.supermarket.erp.module.notify.vo.NoticeVO;
import com.supermarket.erp.module.notify.vo.NotifyOptionVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface TenantNoticeMapper extends BaseMapper<TenantNotice> {

    /**
     * 用户侧可见通知（含当前用户已读状态）
     * 可见性 = 租户内 + 门店约束（store_id 为空=全租户，否则仅该门店）
     *        + 定向范围（全员/指定门店/指定角色/指定人员）
     *        + 未撤回（status=0，撤回后对接收人不可见、不计未读）
     */
    @Select("<script>" +
            "SELECT n.id, n.title, n.content, n.notice_type AS noticeType, " +
            "n.sender_name AS senderName, n.send_time AS sendTime, " +
            "r.read_at AS readAt " +
            "FROM tenant_notice n " +
            "JOIN sys_user su ON su.id = #{userId} " +
            "LEFT JOIN tenant_notice_read r ON r.notice_id = n.id AND r.user_id = #{userId} " +
            "WHERE n.deleted = 0 AND n.tenant_id = #{tenantId} AND n.status = 0 " +
            "AND (n.store_id IS NULL OR n.store_id = su.store_id) " +
            "AND (n.target_scope = 'ALL' " +
            "  OR (n.target_scope = 'STORE' AND FIND_IN_SET(su.store_id, n.target_store_ids)) " +
            "  OR (n.target_scope = 'ROLE' AND EXISTS (SELECT 1 FROM sys_user_role ur WHERE ur.user_id = su.id " +
            "        AND FIND_IN_SET(ur.role_id, n.target_role_ids))) " +
            "  OR (n.target_scope = 'USER' AND FIND_IN_SET(su.id, n.target_user_ids))) " +
            "ORDER BY n.send_time DESC " +
            "LIMIT 100" +
            "</script>")
    List<NoticeVO> selectVisibleForUser(@Param("tenantId") Long tenantId, @Param("userId") Long userId);

    /**
     * 用户侧单条通知详情（详情页直链/刷新用）
     * 可见性口径与 selectVisibleForUser 完全一致，只是收窄到单条并去掉分页上限
     */
    @Select("<script>" +
            "SELECT n.id, n.title, n.content, n.notice_type AS noticeType, " +
            "n.sender_name AS senderName, n.send_time AS sendTime, " +
            "r.read_at AS readAt " +
            "FROM tenant_notice n " +
            "JOIN sys_user su ON su.id = #{userId} " +
            "LEFT JOIN tenant_notice_read r ON r.notice_id = n.id AND r.user_id = #{userId} " +
            "WHERE n.id = #{noticeId} AND n.deleted = 0 AND n.tenant_id = #{tenantId} AND n.status = 0 " +
            "AND (n.store_id IS NULL OR n.store_id = su.store_id) " +
            "AND (n.target_scope = 'ALL' " +
            "  OR (n.target_scope = 'STORE' AND FIND_IN_SET(su.store_id, n.target_store_ids)) " +
            "  OR (n.target_scope = 'ROLE' AND EXISTS (SELECT 1 FROM sys_user_role ur WHERE ur.user_id = su.id " +
            "        AND FIND_IN_SET(ur.role_id, n.target_role_ids))) " +
            "  OR (n.target_scope = 'USER' AND FIND_IN_SET(su.id, n.target_user_ids)))" +
            "</script>")
    NoticeVO selectVisibleDetail(@Param("noticeId") Long noticeId,
                                 @Param("tenantId") Long tenantId,
                                 @Param("userId") Long userId);

    /**
     * 当前用户是否可见指定通知（留言前的越权校验：与列表可见性口径完全一致）
     * 口径：本租户 + 未撤回 + 门店约束 + 定向范围
     */
    @Select("<script>" +
            "SELECT COUNT(1) FROM tenant_notice n " +
            "JOIN sys_user su ON su.id = #{userId} " +
            "WHERE n.id = #{noticeId} AND n.deleted = 0 AND n.tenant_id = #{tenantId} AND n.status = 0 " +
            "AND (n.store_id IS NULL OR n.store_id = su.store_id) " +
            "AND (n.target_scope = 'ALL' " +
            "  OR (n.target_scope = 'STORE' AND FIND_IN_SET(su.store_id, n.target_store_ids)) " +
            "  OR (n.target_scope = 'ROLE' AND EXISTS (SELECT 1 FROM sys_user_role ur WHERE ur.user_id = su.id " +
            "        AND FIND_IN_SET(ur.role_id, n.target_role_ids))) " +
            "  OR (n.target_scope = 'USER' AND FIND_IN_SET(su.id, n.target_user_ids)))" +
            "</script>")
    int countVisibleForUser(@Param("noticeId") Long noticeId,
                            @Param("tenantId") Long tenantId,
                            @Param("userId") Long userId);

    /**
     * 通知应读用户及其阅读状态（已读统计：谁没看、按门店聚合）
     */
    @Select("<script>" +
            "SELECT u.id AS userId, u.name AS userName, u.store_id AS storeId, s.store_name AS storeName, " +
            "r.read_at AS readAt " +
            "FROM tenant_notice n " +
            "JOIN sys_user u ON u.tenant_id = n.tenant_id AND u.deleted = 0 AND u.status = 1 " +
            "AND (n.store_id IS NULL OR u.store_id = n.store_id) " +
            "LEFT JOIN sys_store s ON s.id = u.store_id " +
            "LEFT JOIN tenant_notice_read r ON r.notice_id = n.id AND r.user_id = u.id " +
            "WHERE n.id = #{noticeId} AND n.deleted = 0 AND n.tenant_id = #{tenantId} " +
            "AND (n.target_scope = 'ALL' " +
            "  OR (n.target_scope = 'STORE' AND FIND_IN_SET(u.store_id, n.target_store_ids)) " +
            "  OR (n.target_scope = 'ROLE' AND EXISTS (SELECT 1 FROM sys_user_role ur WHERE ur.user_id = u.id " +
            "        AND FIND_IN_SET(ur.role_id, n.target_role_ids))) " +
            "  OR (n.target_scope = 'USER' AND FIND_IN_SET(u.id, n.target_user_ids)))" +
            "</script>")
    List<NoticeAudienceRow> selectAudience(@Param("noticeId") Long noticeId, @Param("tenantId") Long tenantId);

    /** 门店选项（租户内） */
    @Select("SELECT id, store_name AS name FROM sys_store WHERE tenant_id = #{tenantId} AND deleted = 0 ORDER BY sort, id")
    List<NotifyOptionVO> selectStoreOptions(@Param("tenantId") Long tenantId);

    /**
     * 角色选项（租户层通知可选范围）：
     * 本租户私有角色 + 平台共享角色（所有租户均可用）；
     * 排除其他租户的私有角色与平台内置角色（如系统管理员），避免越界。
     * 注意：按角色发送时接收人仍按「本租户持有该角色的用户」收敛，不会跨租户投递。
     */
    @Select("SELECT id, role_name AS name FROM sys_role "
            + "WHERE deleted = 0 AND status = 1 "
            + "AND (tenant_id = #{tenantId} OR role_scope = 2) "
            + "AND (role_scope IS NULL OR role_scope <> 3) "
            + "ORDER BY id")
    List<NotifyOptionVO> selectRoleOptions(@Param("tenantId") Long tenantId);

    /** 人员选项（租户内，可按门店过滤） */
    @Select("<script>" +
            "SELECT id, name FROM sys_user WHERE tenant_id = #{tenantId} AND deleted = 0 AND status = 1 " +
            "<if test='storeId != null'>AND store_id = #{storeId}</if> " +
            "ORDER BY store_id, id" +
            "</script>")
    List<NotifyOptionVO> selectUserOptions(@Param("tenantId") Long tenantId, @Param("storeId") Long storeId);
}
