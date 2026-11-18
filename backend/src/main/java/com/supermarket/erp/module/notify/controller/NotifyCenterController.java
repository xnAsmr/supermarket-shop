package com.supermarket.erp.module.notify.controller;

import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.module.notify.service.INotifyCenterService;
import com.supermarket.erp.module.notify.vo.AnnouncementVO;
import com.supermarket.erp.module.notify.vo.EventVO;
import com.supermarket.erp.module.notify.vo.NoticeVO;
import com.supermarket.erp.module.notify.vo.NotifyUnreadVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 消息中心（用户侧统一入口）
 * Tab1 系统公告（平台层，只读+确认） / Tab2 我的通知（租户层） / Tab3 事件提醒
 */
@Tag(name = "消息中心")
@RestController
@RequestMapping("/api/v1/notify")
@RequiredArgsConstructor
public class NotifyCenterController {

    private final INotifyCenterService notifyCenterService;

    @Operation(summary = "系统公告列表（当前用户可见，含已读/确认状态）")
    @GetMapping("/announcements")
    public Result<List<AnnouncementVO>> announcements() {
        return Result.success(notifyCenterService.announcements());
    }

    @Operation(summary = "系统公告详情（详情页用，可见性口径与列表一致）")
    @GetMapping("/announcements/{id}")
    public Result<AnnouncementVO> announcement(@PathVariable Long id) {
        return Result.success(notifyCenterService.announcement(id));
    }

    @Operation(summary = "我的通知列表（当前用户可见，含已读状态）")
    @GetMapping("/notices")
    public Result<List<NoticeVO>> notices() {
        return Result.success(notifyCenterService.notices());
    }

    @Operation(summary = "我的通知详情（详情页用，可见性口径与列表一致）")
    @GetMapping("/notices/{id}")
    public Result<NoticeVO> notice(@PathVariable Long id) {
        return Result.success(notifyCenterService.notice(id));
    }

    @Operation(summary = "事件提醒列表（最近 50 条）")
    @GetMapping("/events")
    public Result<List<EventVO>> events() {
        return Result.success(notifyCenterService.events());
    }

    @Operation(summary = "事件提醒详情（仅本人可见）")
    @GetMapping("/events/{id}")
    public Result<EventVO> event(@PathVariable Long id) {
        return Result.success(notifyCenterService.event(id));
    }

    @Operation(summary = "未读数汇总（顶栏铃铛角标）")
    @GetMapping("/unread-count")
    public Result<NotifyUnreadVO> unreadCount() {
        return Result.success(notifyCenterService.unreadCount());
    }

    @Operation(summary = "公告标记已读")
    @PostMapping("/announcements/{id}/read")
    public Result<Void> readAnnouncement(@PathVariable Long id) {
        notifyCenterService.readAnnouncement(id);
        return Result.success();
    }

    @Operation(summary = "公告确认（我已知晓）")
    @PostMapping("/announcements/{id}/ack")
    public Result<Void> ackAnnouncement(@PathVariable Long id) {
        notifyCenterService.ackAnnouncement(id);
        return Result.success();
    }

    @Operation(summary = "通知标记已读")
    @PostMapping("/notices/{id}/read")
    public Result<Void> readNotice(@PathVariable Long id) {
        notifyCenterService.readNotice(id);
        return Result.success();
    }

    @Operation(summary = "事件标记已读")
    @PostMapping("/events/{id}/read")
    public Result<Void> readEvent(@PathVariable Long id) {
        notifyCenterService.readEvent(id);
        return Result.success();
    }

    @Operation(summary = "全部事件标记已读")
    @PostMapping("/events/read-all")
    public Result<Void> readAllEvents() {
        notifyCenterService.readAllEvents();
        return Result.success();
    }
}
