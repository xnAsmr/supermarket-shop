package com.supermarket.erp.module.notify.service;

import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.module.notify.dto.NoticeSendDTO;
import com.supermarket.erp.module.notify.dto.NotifyPageDTO;
import com.supermarket.erp.module.notify.vo.NoticeStatsVO;
import com.supermarket.erp.module.notify.vo.NotifyOptionVO;
import com.supermarket.erp.module.notify.vo.TenantNoticeAdminVO;

import java.util.List;

/**
 * 租户通知服务（租户层，管理员权限）：按门店/角色/指定人发送 + 已读统计
 * 发送权限：店长（角色=STORE_MANAGER）只能发本门店；租户管理员/老板/总部可发全租户
 */
public interface ITenantNoticeService {

    /** 通知分页（当前租户，含应读/已读人数） */
    PageResult<TenantNoticeAdminVO> page(NotifyPageDTO dto);

    /**
     * 单条通知详情（管理侧详情页用，含应读/已读与留言数）
     * 权限口径同撤回/编辑：仅本租户；店长仅本门店通知
     */
    TenantNoticeAdminVO detail(Long noticeId);

    /** 发送通知（sender 从后端会话取） */
    void send(NoticeSendDTO dto);

    /**
     * 编辑通知：标题/正文/定向范围原地更新（发送人与发送时间保持不变）
     * 权限同 delete：仅本租户；店长（角色=STORE_MANAGER）只能改本门店通知
     */
    void update(Long noticeId, NoticeSendDTO dto);

    /**
     * 撤回通知：已发送 → 已撤回。
     * 撤回后接收人不可见（消息中心/未读数/滚动条均不再出现），已读记录保留，可重新发布。
     * 权限同 delete：仅本租户；店长（角色=STORE_MANAGER）只能操作本门店通知
     */
    void withdraw(Long noticeId);

    /**
     * 重新发布通知：已撤回 → 已发送，发送时间刷新为当前时间（重新上线立即生效）。
     * 权限同 delete：仅本租户；店长（角色=STORE_MANAGER）只能操作本门店通知
     */
    void publish(Long noticeId);

    /** 已读统计（谁没看、按门店已读率） */
    NoticeStatsVO stats(Long noticeId);

    /** 删除通知 */
    void delete(Long noticeId);

    /**
     * 屏蔽通知下的公开留言（管理权口径与撤回/编辑一致：租户管理员可管全租户，店长仅本门店通知）
     */
    void hideComment(Long commentId);

    /**
     * 置顶/取消置顶通知下的公开留言。
     * 仅允许置顶顶层公开留言，单条通知最多置顶 3 条；管理权口径同 hideComment。
     */
    void pinComment(Long commentId, boolean pinned);

    /** 门店选项（店长仅本门店） */
    List<NotifyOptionVO> storeOptions();

    /** 角色选项（当前租户） */
    List<NotifyOptionVO> roleOptions();

    /** 人员选项（店长仅本门店） */
    List<NotifyOptionVO> userOptions();
}
