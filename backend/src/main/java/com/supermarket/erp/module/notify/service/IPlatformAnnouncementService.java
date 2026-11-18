package com.supermarket.erp.module.notify.service;

import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.module.notify.dto.AnnouncementSaveDTO;
import com.supermarket.erp.module.notify.dto.NotifyPageDTO;
import com.supermarket.erp.module.notify.vo.AnnouncementAdminVO;
import com.supermarket.erp.module.notify.vo.AnnouncementStatsVO;
import com.supermarket.erp.module.notify.vo.NotifyOptionVO;

import java.util.List;

/**
 * 平台公告服务（平台层，超管权限）：功能更新公告 + 强制已读确认 + 定向租户筛选
 */
public interface IPlatformAnnouncementService {

    /** 公告分页（含已读/确认人数） */
    PageResult<AnnouncementAdminVO> page(NotifyPageDTO dto);

    /** 单条公告详情（管理侧详情页用，含已读/确认人数与反馈工单数） */
    AnnouncementAdminVO detail(Long id);

    /** 创建或更新（publishNow=true 直接发布，否则存草稿） */
    void save(AnnouncementSaveDTO dto);

    /** 发布 */
    void publish(Long id);

    /** 撤回 */
    void withdraw(Long id);

    /** 删除 */
    void delete(Long id);

    /** 已读统计（按租户维度） */
    AnnouncementStatsVO stats(Long id);

    /** 租户选项（定向指定租户用） */
    List<NotifyOptionVO> tenantOptions();
}
