package com.supermarket.erp.module.notify.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.notify.entity.NotifyMessage;
import com.supermarket.erp.module.notify.vo.FeedbackThreadVO;
import com.supermarket.erp.module.notify.vo.TargetCountRow;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 留言 Mapper
 *
 * 可见性统一口径：
 * - 正常状态（status=0）+ 未删除
 * - AUDIENCE：调用方必须先命中间接对象（通知）的可见性，再按 target 取数
 * - PRIVATE ：仅「留言人自己的工单（含平台回复）」或平台侧全量，绝不按 target 裸查返回给用户
 */
@Mapper
public interface NotifyMessageMapper extends BaseMapper<NotifyMessage> {

    /** 公告内公开留言（调用方已校验通知可见性；置顶留言优先展示） */
    @Select("SELECT * FROM notify_message " +
            "WHERE target_type = #{targetType} AND target_id = #{targetId} " +
            "AND scope = 'AUDIENCE' AND status = 0 AND deleted = 0 " +
            "ORDER BY pinned DESC, create_time ASC, id ASC")
    List<NotifyMessage> selectAudienceMessages(@Param("targetType") String targetType,
                                               @Param("targetId") Long targetId);

    /**
     * 当前用户在某个平台公告下的私密工单（含平台回复）
     * 只返回「本人发起的工单」及其回复，其他租户用户的工单连查都查不到
     */
    @Select("SELECT m.* FROM notify_message m " +
            "WHERE m.target_type = #{targetType} AND m.target_id = #{targetId} " +
            "AND m.scope = 'PRIVATE' AND m.status = 0 AND m.deleted = 0 " +
            "AND (m.user_id = #{userId} OR m.parent_id IN (" +
            "  SELECT t.id FROM notify_message t WHERE t.target_type = #{targetType} " +
            "  AND t.target_id = #{targetId} AND t.scope = 'PRIVATE' AND t.parent_id = 0 " +
            "  AND t.user_id = #{userId} AND t.deleted = 0)) " +
            "ORDER BY CASE WHEN m.parent_id = 0 THEN m.id ELSE m.parent_id END ASC, m.id ASC")
    List<NotifyMessage> selectPrivateMessagesOfUser(@Param("targetType") String targetType,
                                                    @Param("targetId") Long targetId,
                                                    @Param("userId") Long userId);

    /** 平台侧：某个公告下的全部私密留言（含所有租户用户与平台回复） */
    @Select("SELECT * FROM notify_message " +
            "WHERE target_type = #{targetType} AND target_id = #{targetId} " +
            "AND scope = 'PRIVATE' AND status = 0 AND deleted = 0 " +
            "ORDER BY CASE WHEN parent_id = 0 THEN id ELSE parent_id END ASC, id ASC")
    List<NotifyMessage> selectPrivateMessagesOfTarget(@Param("targetType") String targetType,
                                                      @Param("targetId") Long targetId);

    /** 某个工单下的全部留言（顶层 + 回复） */
    @Select("SELECT * FROM notify_message " +
            "WHERE (id = #{threadId} OR parent_id = #{threadId}) " +
            "AND scope = 'PRIVATE' AND status = 0 AND deleted = 0 " +
            "ORDER BY id ASC")
    List<NotifyMessage> selectThreadMessages(@Param("threadId") Long threadId);

    /**
     * 平台侧工单列表（一条顶层私密留言 = 一个工单）
     * 待处理的排前面，便于平台先消化积压
     */
    @Select("SELECT m.id, m.tenant_id AS tenantId, t.tenant_name AS tenantName, m.store_id AS storeId, " +
            "m.user_id AS userId, m.user_name AS userName, m.content, m.thread_status AS threadStatus, " +
            "m.create_time AS createTime, m.reply_by_name AS replyByName, m.reply_at AS replyAt, " +
            "(SELECT COUNT(*) FROM notify_message c WHERE c.parent_id = m.id AND c.status = 0 AND c.deleted = 0) + 1 AS messageCount " +
            "FROM notify_message m " +
            "LEFT JOIN sys_tenant t ON t.id = m.tenant_id " +
            "WHERE m.target_type = #{targetType} AND m.target_id = #{targetId} " +
            "AND m.scope = 'PRIVATE' AND m.parent_id = 0 AND m.status = 0 AND m.deleted = 0 " +
            "ORDER BY (m.thread_status = 'PENDING') DESC, m.create_time DESC")
    List<FeedbackThreadVO> selectFeedbackThreads(@Param("targetType") String targetType,
                                                 @Param("targetId") Long targetId);

    /** 按留言对象批量统计顶层留言数 / 待处理数（列表页用，避免 N+1） */
    @Select("<script>" +
            "SELECT target_id AS targetId, COUNT(*) AS total, " +
            "SUM(CASE WHEN thread_status = 'PENDING' THEN 1 ELSE 0 END) AS pending " +
            "FROM notify_message " +
            "WHERE target_type = #{targetType} AND parent_id = 0 AND status = 0 AND deleted = 0 " +
            "AND target_id IN " +
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach> " +
            "GROUP BY target_id" +
            "</script>")
    List<TargetCountRow> countThreadsByTargets(@Param("targetType") String targetType,
                                               @Param("ids") List<Long> ids);

    /** 当前通知下已置顶的留言数（置顶上限校验用） */
    @Select("SELECT COUNT(*) FROM notify_message " +
            "WHERE target_type = #{targetType} AND target_id = #{targetId} " +
            "AND scope = 'AUDIENCE' AND parent_id = 0 AND pinned = 1 AND status = 0 AND deleted = 0")
    int countPinned(@Param("targetType") String targetType, @Param("targetId") Long targetId);

    /* ------------------------------ 未读水位 ------------------------------ */

    /** 公告内公开留言的最大 ID（含自己发的，作为已读水位） */
    @Select("SELECT COALESCE(MAX(id), 0) FROM notify_message " +
            "WHERE target_type = #{targetType} AND target_id = #{targetId} " +
            "AND scope = 'AUDIENCE' AND status = 0 AND deleted = 0")
    Long selectMaxAudienceMessageId(@Param("targetType") String targetType,
                                    @Param("targetId") Long targetId);

    /** 本人在某个平台公告下的私密工单（含平台回复）的最大 ID（作为已读水位） */
    @Select("SELECT COALESCE(MAX(m.id), 0) FROM notify_message m " +
            "WHERE m.target_type = #{targetType} AND m.target_id = #{targetId} " +
            "AND m.scope = 'PRIVATE' AND m.status = 0 AND m.deleted = 0 " +
            "AND (m.user_id = #{userId} OR m.parent_id IN (" +
            "  SELECT t.id FROM notify_message t WHERE t.target_type = #{targetType} " +
            "  AND t.target_id = #{targetId} AND t.scope = 'PRIVATE' AND t.parent_id = 0 " +
            "  AND t.user_id = #{userId} AND t.deleted = 0))")
    Long selectMaxPrivateMessageIdOfUser(@Param("targetType") String targetType,
                                         @Param("targetId") Long targetId,
                                         @Param("userId") Long userId);

    /**
     * 批量统计「租户通知」的未读公开留言数（total = 未读数）
     * 只算别人发的：自己发的留言不构成自己的红点
     */
    @Select("<script>" +
            "SELECT m.target_id AS targetId, COUNT(*) AS total " +
            "FROM notify_message m " +
            "LEFT JOIN notify_message_read r ON r.target_type = m.target_type " +
            "  AND r.target_id = m.target_id AND r.user_id = #{userId} " +
            "WHERE m.target_type = #{targetType} AND m.scope = 'AUDIENCE' " +
            "AND m.status = 0 AND m.deleted = 0 AND m.user_id &lt;&gt; #{userId} " +
            "AND m.id &gt; COALESCE(r.last_read_id, 0) " +
            "AND m.target_id IN " +
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach> " +
            "GROUP BY m.target_id" +
            "</script>")
    List<TargetCountRow> countUnreadAudienceByTargets(@Param("targetType") String targetType,
                                                      @Param("userId") Long userId,
                                                      @Param("ids") List<Long> ids);

    /**
     * 批量统计「平台公告」的未读回复数（total = 未读数）
     * 只算平台对我方工单的回复：同一租户下别人的工单不能算到我头上
     */
    @Select("<script>" +
            "SELECT m.target_id AS targetId, COUNT(*) AS total " +
            "FROM notify_message m " +
            "LEFT JOIN notify_message_read r ON r.target_type = m.target_type " +
            "  AND r.target_id = m.target_id AND r.user_id = #{userId} " +
            "WHERE m.target_type = #{targetType} AND m.scope = 'PRIVATE' " +
            "AND m.status = 0 AND m.deleted = 0 AND m.author_type = 2 AND m.tenant_id = #{tenantId} " +
            "AND m.id &gt; COALESCE(r.last_read_id, 0) " +
            "AND m.parent_id IN (" +
            "  SELECT t.id FROM notify_message t WHERE t.target_type = #{targetType} " +
            "  AND t.scope = 'PRIVATE' AND t.parent_id = 0 AND t.user_id = #{userId} AND t.deleted = 0) " +
            "AND m.target_id IN " +
            "<foreach collection='ids' item='id' open='(' separator=',' close=')'>#{id}</foreach> " +
            "GROUP BY m.target_id" +
            "</script>")
    List<TargetCountRow> countUnreadPrivateByTargets(@Param("targetType") String targetType,
                                                     @Param("tenantId") Long tenantId,
                                                     @Param("userId") Long userId,
                                                     @Param("ids") List<Long> ids);
}
