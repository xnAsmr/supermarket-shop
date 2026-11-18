package com.supermarket.erp.module.notify.controller;

import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.module.notify.dto.CommentPinDTO;
import com.supermarket.erp.module.notify.dto.NoticeSendDTO;
import com.supermarket.erp.module.notify.dto.NotifyPageDTO;
import com.supermarket.erp.module.notify.service.ITenantNoticeService;
import com.supermarket.erp.module.notify.vo.NoticeStatsVO;
import com.supermarket.erp.module.notify.vo.NotifyOptionVO;
import com.supermarket.erp.module.notify.vo.TenantNoticeAdminVO;
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
 * 租户通知管理（租户层，管理员权限）：发送 + 已读统计
 * 发送权限校验在服务层：店长只能发本门店，老板可发全租户
 */
@Tag(name = "租户通知管理")
@RestController
@RequestMapping("/api/v1/tenant/notices")
@RequiredArgsConstructor
public class TenantNoticeController {

    private final ITenantNoticeService noticeService;

    @Operation(summary = "通知分页（当前租户）")
    @PreAuthorize("@perm.check('notify:notice:manage')")
    @GetMapping
    public Result<PageResult<TenantNoticeAdminVO>> page(NotifyPageDTO dto) {
        return Result.success(noticeService.page(dto));
    }

    @Operation(summary = "通知详情（管理侧详情页用，店长仅本门店）")
    @PreAuthorize("@perm.check('notify:notice:manage')")
    @GetMapping("/{id}")
    public Result<TenantNoticeAdminVO> detail(@PathVariable Long id) {
        return Result.success(noticeService.detail(id));
    }

    @Operation(summary = "发送通知（sender 从后端会话取，不收前端传参）")
    @PreAuthorize("@perm.check('notify:notice:manage')")
    @PostMapping
    public Result<Void> send(@RequestBody NoticeSendDTO dto) {
        noticeService.send(dto);
        return Result.success();
    }

    @Operation(summary = "编辑通知（标题/正文/定向范围，发送人与发送时间不变）")
    @PreAuthorize("@perm.check('notify:notice:manage')")
    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody NoticeSendDTO dto) {
        noticeService.update(id, dto);
        return Result.success();
    }

    @Operation(summary = "撤回通知（接收人不可见、不计未读，可重新发布）")
    @PreAuthorize("@perm.check('notify:notice:manage')")
    @PutMapping("/{id}/withdraw")
    public Result<Void> withdraw(@PathVariable Long id) {
        noticeService.withdraw(id);
        return Result.success();
    }

    @Operation(summary = "重新发布通知（刷新发送时间，立即可见并重新计入未读）")
    @PreAuthorize("@perm.check('notify:notice:manage')")
    @PutMapping("/{id}/publish")
    public Result<Void> publish(@PathVariable Long id) {
        noticeService.publish(id);
        return Result.success();
    }

    @Operation(summary = "已读统计（谁没看、按门店已读率）")
    @PreAuthorize("@perm.check('notify:notice:manage')")
    @GetMapping("/{id}/stats")
    public Result<NoticeStatsVO> stats(@PathVariable Long id) {
        return Result.success(noticeService.stats(id));
    }

    @Operation(summary = "删除通知")
    @PreAuthorize("@perm.check('notify:notice:manage')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        noticeService.delete(id);
        return Result.success();
    }

    @Operation(summary = "屏蔽通知下的公开留言（租户管理员/店长，店长仅本门店通知）")
    @PreAuthorize("@perm.check('notify:notice:comment:manage')")
    @DeleteMapping("/comments/{id}")
    public Result<Void> hideComment(@PathVariable Long id) {
        noticeService.hideComment(id);
        return Result.success();
    }

    @Operation(summary = "置顶/取消置顶通知下的公开留言（最多置顶 3 条）")
    @PreAuthorize("@perm.check('notify:notice:comment:manage')")
    @PutMapping("/comments/{id}/pin")
    public Result<Void> pinComment(@PathVariable Long id, @RequestBody CommentPinDTO dto) {
        // pinned 未传按置顶处理，避免前端漏传时把置顶意外取消
        noticeService.pinComment(id, dto.getPinned() == null || dto.getPinned());
        return Result.success();
    }

    @Operation(summary = "门店选项（店长仅本门店）")
    @PreAuthorize("@perm.check('notify:notice:manage')")
    @GetMapping("/options/stores")
    public Result<List<NotifyOptionVO>> storeOptions() {
        return Result.success(noticeService.storeOptions());
    }

    @Operation(summary = "角色选项（当前租户）")
    @PreAuthorize("@perm.check('notify:notice:manage')")
    @GetMapping("/options/roles")
    public Result<List<NotifyOptionVO>> roleOptions() {
        return Result.success(noticeService.roleOptions());
    }

    @Operation(summary = "人员选项（店长仅本门店）")
    @PreAuthorize("@perm.check('notify:notice:manage')")
    @GetMapping("/options/users")
    public Result<List<NotifyOptionVO>> userOptions() {
        return Result.success(noticeService.userOptions());
    }
}
