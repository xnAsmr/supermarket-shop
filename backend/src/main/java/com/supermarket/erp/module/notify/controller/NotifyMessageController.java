package com.supermarket.erp.module.notify.controller;

import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.module.notify.dto.MessageCreateDTO;
import com.supermarket.erp.module.notify.dto.MessageReadDTO;
import com.supermarket.erp.module.notify.service.INotifyMessageService;
import com.supermarket.erp.module.notify.vo.NotifyMessageVO;
import com.supermarket.erp.module.notify.vo.NotifyOptionVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 留言（用户侧）
 *
 * 不设按钮权限：能看见公告/通知即可查看与参与留言（与消息中心「全员通用」口径一致）。
 * 越权由服务层复用公告/通知的可见性 SQL 兜底，tenant_id / user_id 一律取自会话。
 */
@Tag(name = "留言")
@RestController
@RequestMapping("/api/v1/notify/messages")
@RequiredArgsConstructor
public class NotifyMessageController {

    private final INotifyMessageService messageService;

    @Operation(summary = "留言列表（平台公告=本人私密反馈；租户通知=公告内公开留言）")
    @GetMapping
    public Result<List<NotifyMessageVO>> list(@RequestParam String targetType,
                                              @RequestParam Long targetId) {
        return Result.success(messageService.list(targetType, targetId));
    }

    @Operation(summary = "发表留言（parentId 为空=新留言，非空=回复租户通知下的顶层留言）")
    @PostMapping
    public Result<Void> create(@RequestBody MessageCreateDTO dto) {
        messageService.create(dto);
        return Result.success();
    }

    @Operation(summary = "撤回本人留言（仅 5 分钟内）")
    @DeleteMapping("/{id}")
    public Result<Void> withdraw(@PathVariable Long id) {
        messageService.withdraw(id);
        return Result.success();
    }

    @Operation(summary = "可 @ 的候选人员（该通知的应读用户，排除自己）")
    @GetMapping("/mentions")
    public Result<List<NotifyOptionVO>> mentions(@RequestParam Long noticeId) {
        return Result.success(messageService.mentionCandidates(noticeId));
    }

    @Operation(summary = "标记留言已读（推进已读水位，列表红点用）")
    @PostMapping("/read")
    public Result<Void> markRead(@RequestBody MessageReadDTO dto) {
        messageService.markRead(dto.getTargetType(), dto.getTargetId());
        return Result.success();
    }
}
