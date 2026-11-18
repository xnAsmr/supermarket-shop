package com.supermarket.erp.module.schedule.controller;

import com.supermarket.erp.common.annotation.LogOperation;
import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.module.schedule.dto.ChangeCreateDTO;
import com.supermarket.erp.module.schedule.dto.ChangeReviewDTO;
import com.supermarket.erp.module.schedule.dto.CopyPrevWeekDTO;
import com.supermarket.erp.module.schedule.dto.ScheduleItemDTO;
import com.supermarket.erp.module.schedule.dto.ShiftUpsertDTO;
import com.supermarket.erp.module.schedule.dto.WeekActionDTO;
import com.supermarket.erp.module.schedule.dto.WeekSaveDTO;
import com.supermarket.erp.module.schedule.service.IScheduleService;
import com.supermarket.erp.module.schedule.vo.ScheduleVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 排班模块 REST 接口。
 *
 * <p>路径与 frontend/src/api/schedule.ts 中声明的 /api/v1/schedule/* 一一对应；
 * 所有出参为 Result&lt;T&gt;，字段结构与 Api.Schedule 类型契约一致（id 均为字符串）。
 */
@Tag(name = "排班管理")
@RestController
@RequestMapping("/api/v1/schedule")
@RequiredArgsConstructor
public class ScheduleController {

    private final IScheduleService scheduleService;

    /* ------------------------------ 基础数据 ------------------------------ */

    @Operation(summary = "可排班门店列表（按登录账号的租户/门店收敛）")
    @GetMapping("/stores")
    public Result<List<ScheduleVO.StoreOptionVO>> stores() {
        return Result.success(scheduleService.listStores());
    }

    @Operation(summary = "某门店在职员工（复用 sys_user）")
    @GetMapping("/employees")
    public Result<List<ScheduleVO.EmployeeOptionVO>> employees(@RequestParam("storeId") String storeId) {
        return Result.success(scheduleService.listEmployees(storeId));
    }

    @Operation(summary = "当前登录员工信息（我的排班页头部）")
    @GetMapping("/current-employee")
    public Result<ScheduleVO.EmployeeOptionVO> currentEmployee() {
        return Result.success(scheduleService.currentEmployee());
    }

    @Operation(summary = "班次模板列表（租户通用 + 指定门店专属）")
    @GetMapping("/shifts")
    public Result<List<ScheduleVO.ShiftVO>> shifts(
            @RequestParam(value = "storeId", required = false) String storeId) {
        return Result.success(scheduleService.listShifts(storeId));
    }

    @Operation(summary = "新增/编辑班次（带 id 为编辑）")
    @LogOperation(module = "排班管理", operation = "保存班次")
    @PreAuthorize("@perm.check('sch:shift:add')")
    @PostMapping("/shifts")
    public Result<ScheduleVO.ShiftVO> saveShift(@RequestBody @Valid ShiftUpsertDTO dto) {
        return Result.success(scheduleService.upsertShift(dto));
    }

    @Operation(summary = "编辑班次（REST 语义入口，与 POST /shifts 等价）")
    @LogOperation(module = "排班管理", operation = "编辑班次")
    @PreAuthorize("@perm.check('sch:shift:edit')")
    @PutMapping("/shifts")
    public Result<ScheduleVO.ShiftVO> updateShift(@RequestBody @Valid ShiftUpsertDTO dto) {
        return Result.success(scheduleService.upsertShift(dto));
    }

    @Operation(summary = "启用/停用班次")
    @LogOperation(module = "排班管理", operation = "启停班次")
    @PreAuthorize("@perm.check('sch:shift:edit')")
    @PutMapping("/shifts/{id}/toggle")
    public Result<Void> toggleShift(@PathVariable String id) {
        scheduleService.toggleShift(id);
        return Result.success();
    }

    @Operation(summary = "删除班次（已被排班引用时拒绝）")
    @LogOperation(module = "排班管理", operation = "删除班次")
    @PreAuthorize("@perm.check('sch:shift:delete')")
    @DeleteMapping("/shifts/{id}")
    public Result<Void> deleteShift(@PathVariable String id) {
        scheduleService.deleteShift(id);
        return Result.success();
    }

    /* ------------------------------ 周班表 ------------------------------ */

    @Operation(summary = "查询周班表（不存在则自动创建草稿/归档空班表）")
    @GetMapping("/week")
    public Result<ScheduleVO.WeekScheduleVO> week(
            @RequestParam("storeId") String storeId,
            @RequestParam("weekStart") String weekStart) {
        return Result.success(scheduleService.getWeek(storeId, weekStart));
    }

    @Operation(summary = "发布前校验报告（冲突为阻断项、缺员为提示项）")
    @GetMapping("/week/validate")
    public Result<ScheduleVO.ValidationVO> validateWeek(
            @RequestParam("storeId") String storeId,
            @RequestParam("weekStart") String weekStart) {
        return Result.success(scheduleService.validateWeek(storeId, weekStart));
    }

    @Operation(summary = "整周覆盖保存（事务内先清后写，含冲突校验）")
    @LogOperation(module = "排班管理", operation = "保存周排班")
    @PreAuthorize("@perm.check('sch:roster:save')")
    @PutMapping("/week")
    public Result<Void> saveWeek(@RequestBody @Valid WeekSaveDTO dto) {
        scheduleService.saveWeek(dto);
        return Result.success();
    }

    @Operation(summary = "复制上周班表（日期整体 +7 天，来源标记 copy）")
    @LogOperation(module = "排班管理", operation = "复制上周排班")
    @PreAuthorize("@perm.check('sch:roster:copy')")
    @PostMapping("/week/copy-prev")
    public Result<ScheduleVO.WeekScheduleVO> copyPrevWeek(@RequestBody @Valid CopyPrevWeekDTO dto) {
        return Result.success(scheduleService.copyPrevWeek(dto));
    }

    @Operation(summary = "发布班表（后端二次校验冲突，发布后只读）")
    @LogOperation(module = "排班管理", operation = "发布班表")
    @PreAuthorize("@perm.check('sch:roster:publish')")
    @PostMapping("/week/publish")
    public Result<Void> publishWeek(@RequestBody @Valid WeekActionDTO dto) {
        scheduleService.publishWeek(dto);
        return Result.success();
    }

    @Operation(summary = "撤回发布，恢复草稿可编辑")
    @LogOperation(module = "排班管理", operation = "撤回发布")
    @PreAuthorize("@perm.check('sch:roster:revoke')")
    @PostMapping("/week/revoke")
    public Result<Void> revokeWeek(@RequestBody @Valid WeekActionDTO dto) {
        scheduleService.revokeWeek(dto);
        return Result.success();
    }

    @Operation(summary = "单条排班明细新增（含冲突校验）")
    @LogOperation(module = "排班管理", operation = "新增排班明细")
    @PreAuthorize("@perm.check('sch:roster:save')")
    @PostMapping("/items")
    public Result<ScheduleVO.ScheduleItemVO> addItem(@RequestBody @Valid ScheduleItemDTO dto) {
        return Result.success(scheduleService.addItem(dto));
    }

    @Operation(summary = "单条排班明细删除")
    @LogOperation(module = "排班管理", operation = "删除排班明细")
    @PreAuthorize("@perm.check('sch:roster:save')")
    @DeleteMapping("/items/{id}")
    public Result<Void> deleteItem(@PathVariable String id) {
        scheduleService.deleteItem(id);
        return Result.success();
    }

    /* ------------------------------ 调班审批 ------------------------------ */

    @Operation(summary = "调班申请列表（待办优先）")
    @GetMapping("/changes")
    public Result<List<ScheduleVO.ChangeVO>> changes() {
        return Result.success(scheduleService.listChanges());
    }

    @Operation(summary = "发起调班申请（申请人取当前登录用户）")
    @LogOperation(module = "排班管理", operation = "发起调班")
    @PreAuthorize("@perm.check('sch:change:add')")
    @PostMapping("/changes")
    public Result<ScheduleVO.ChangeVO> createChange(@RequestBody @Valid ChangeCreateDTO dto) {
        return Result.success(scheduleService.createChange(dto));
    }

    @Operation(summary = "审批调班（通过后自动回写班表，source=change）")
    @LogOperation(module = "排班管理", operation = "审批调班")
    @PreAuthorize("@perm.check('sch:change:review')")
    @PutMapping("/changes/{id}/review")
    public Result<ScheduleVO.ChangeVO> reviewChange(@PathVariable String id,
                                                     @RequestBody @Valid ChangeReviewDTO dto) {
        return Result.success(scheduleService.reviewChange(id, dto));
    }

    @Operation(summary = "撤销待审批的调班申请")
    @LogOperation(module = "排班管理", operation = "撤销调班申请")
    @PreAuthorize("@perm.check('sch:change:add')")
    @DeleteMapping("/changes/{id}")
    public Result<Void> cancelChange(@PathVariable String id) {
        scheduleService.cancelChange(id);
        return Result.success();
    }

    /* ------------------------------ 我的排班 ------------------------------ */

    @Operation(summary = "当前登录员工在指定周的排班明细")
    @GetMapping("/mine")
    public Result<List<ScheduleVO.ScheduleItemVO>> mine(@RequestParam("weekStart") String weekStart) {
        return Result.success(scheduleService.listMySchedule(weekStart));
    }
}
