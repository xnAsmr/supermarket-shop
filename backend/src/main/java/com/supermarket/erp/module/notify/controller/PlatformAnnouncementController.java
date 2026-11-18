package com.supermarket.erp.module.notify.controller;

import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.module.notify.dto.AnnouncementSaveDTO;
import com.supermarket.erp.module.notify.dto.FeedbackReplyDTO;
import com.supermarket.erp.module.notify.dto.NotifyPageDTO;
import com.supermarket.erp.module.notify.service.INotifyMessageService;
import com.supermarket.erp.module.notify.service.IPlatformAnnouncementService;
import com.supermarket.erp.module.notify.vo.AnnouncementAdminVO;
import com.supermarket.erp.module.notify.vo.AnnouncementStatsVO;
import com.supermarket.erp.module.notify.vo.FeedbackThreadVO;
import com.supermarket.erp.module.notify.vo.NotifyOptionVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 平台公告管理（平台层，超管权限）
 */
@Tag(name = "平台公告管理")
@RestController
@RequestMapping("/api/v1/platform/announcements")
@RequiredArgsConstructor
public class PlatformAnnouncementController {

    private final IPlatformAnnouncementService announcementService;
    private final INotifyMessageService messageService;

    @Operation(summary = "公告分页")
    @PreAuthorize("@perm.check('platform:announcement:manage')")
    @GetMapping
    public Result<PageResult<AnnouncementAdminVO>> page(NotifyPageDTO dto) {
        return Result.success(announcementService.page(dto));
    }

    @Operation(summary = "公告详情（管理侧详情页用）")
    @PreAuthorize("@perm.check('platform:announcement:manage')")
    @GetMapping("/{id}")
    public Result<AnnouncementAdminVO> detail(@PathVariable Long id) {
        return Result.success(announcementService.detail(id));
    }

    @Operation(summary = "创建/更新公告（publishNow=true 直接发布，否则存草稿）")
    @PreAuthorize("@perm.check('platform:announcement:manage')")
    @PostMapping
    public Result<Void> save(@RequestBody AnnouncementSaveDTO dto) {
        announcementService.save(dto);
        return Result.success();
    }

    @Operation(summary = "发布公告")
    @PreAuthorize("@perm.check('platform:announcement:manage')")
    @PutMapping("/{id}/publish")
    public Result<Void> publish(@PathVariable Long id) {
        announcementService.publish(id);
        return Result.success();
    }

    @Operation(summary = "撤回公告")
    @PreAuthorize("@perm.check('platform:announcement:manage')")
    @PutMapping("/{id}/withdraw")
    public Result<Void> withdraw(@PathVariable Long id) {
        announcementService.withdraw(id);
        return Result.success();
    }

    @Operation(summary = "删除公告")
    @PreAuthorize("@perm.check('platform:announcement:manage')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        announcementService.delete(id);
        return Result.success();
    }

    @Operation(summary = "已读统计（按租户维度）")
    @PreAuthorize("@perm.check('platform:announcement:manage')")
    @GetMapping("/{id}/stats")
    public Result<AnnouncementStatsVO> stats(@PathVariable Long id) {
        return Result.success(announcementService.stats(id));
    }

    @Operation(summary = "租户选项（定向指定租户用）")
    @PreAuthorize("@perm.check('platform:announcement:manage')")
    @GetMapping("/options/tenants")
    public Result<List<NotifyOptionVO>> tenantOptions() {
        return Result.success(announcementService.tenantOptions());
    }

    /* ------------------------------ 私密反馈（租户 → 平台） ------------------------------ */

    @Operation(summary = "反馈工单列表（待处理优先）")
    @PreAuthorize("@perm.check('platform:announcement:feedback:manage')")
    @GetMapping("/{id}/feedbacks")
    public Result<List<FeedbackThreadVO>> feedbacks(@PathVariable Long id) {
        return Result.success(messageService.threads(id));
    }

    @Operation(summary = "反馈工单详情（含全部往来留言）")
    @PreAuthorize("@perm.check('platform:announcement:feedback:manage')")
    @GetMapping("/{id}/feedbacks/{threadId}")
    public Result<FeedbackThreadVO> feedbackDetail(@PathVariable Long id,
                                                   @PathVariable Long threadId) {
        return Result.success(messageService.threadDetail(threadId));
    }

    @Operation(summary = "回复反馈工单（同时向提问人推送事件提醒）")
    @PreAuthorize("@perm.check('platform:announcement:feedback:manage')")
    @PostMapping("/{id}/feedbacks/{threadId}/reply")
    public Result<Void> replyFeedback(@PathVariable Long id,
                                      @PathVariable Long threadId,
                                      @RequestBody FeedbackReplyDTO dto) {
        messageService.reply(threadId, dto.getContent());
        return Result.success();
    }

    @Operation(summary = "关闭反馈工单")
    @PreAuthorize("@perm.check('platform:announcement:feedback:manage')")
    @PutMapping("/{id}/feedbacks/{threadId}/close")
    public Result<Void> closeFeedback(@PathVariable Long id, @PathVariable Long threadId) {
        messageService.close(threadId);
        return Result.success();
    }
}
