package com.supermarket.erp.module.system.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.supermarket.erp.common.annotation.LogOperation;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.system.entity.OperationLog;
import com.supermarket.erp.module.system.mapper.OperationLogMapper;
import com.supermarket.erp.module.tenant.entity.Tenant;
import com.supermarket.erp.module.tenant.mapper.TenantMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Tag(name = "操作日志")
@RestController
@RequestMapping("/api/v1/operation-logs")
@RequiredArgsConstructor
public class OperationLogController {

    /** 平台租户（租户ID=1）：其系统管理员（userType=3）可跨租户查看全部日志 */
    private static final Long PLATFORM_TENANT_ID = 1L;

    private final OperationLogMapper operationLogMapper;
    private final TenantMapper tenantMapper;

    @Operation(summary = "操作日志分页列表")
    @GetMapping
    public Result<PageResult<Map<String, Object>>> list(
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) Long tenantId,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer pageSize) {

        Integer userType = SecurityUtil.getLoginUser().getUserType();
        Long tenantIdNow = SecurityUtil.getTenantId();
        // 数据隔离：仅平台租户(1)的系统管理员(userType=3)可跨租户；其余一律只能看本租户
        boolean isPlatformAdmin = userType != null && userType == 3
                && tenantIdNow != null && PLATFORM_TENANT_ID.equals(tenantIdNow);

        LambdaQueryWrapper<OperationLog> wrapper = new LambdaQueryWrapper<>();
        if (isPlatformAdmin) {
            if (tenantId != null) {
                wrapper.eq(OperationLog::getTenantId, tenantId);
            }
        } else {
            wrapper.eq(OperationLog::getTenantId, tenantIdNow);
        }
        if (StringUtils.hasText(module)) {
            wrapper.like(OperationLog::getModule, module);
        }
        if (StringUtils.hasText(username)) {
            wrapper.like(OperationLog::getUsername, username);
        }
        if (status != null) {
            wrapper.eq(OperationLog::getStatus, status);
        }
        if (StringUtils.hasText(startDate)) {
            wrapper.ge(OperationLog::getCreateTime, startDate + " 00:00:00");
        }
        if (StringUtils.hasText(endDate)) {
            wrapper.le(OperationLog::getCreateTime, endDate + " 23:59:59");
        }
        wrapper.orderByDesc(OperationLog::getCreateTime);

        Page<OperationLog> pageResult = operationLogMapper.selectPage(new Page<>(page, pageSize), wrapper);

        // 统一补充租户名称（跨租户与本租户视角都需要展示）
        Map<Long, String> tenantNameMap = new java.util.HashMap<>();
        {
            Set<Long> tenantIds = pageResult.getRecords().stream()
                    .map(OperationLog::getTenantId)
                    .filter(java.util.Objects::nonNull)
                    .collect(Collectors.toSet());
            if (!tenantIds.isEmpty()) {
                List<Tenant> tenants = tenantMapper.selectBatchIds(tenantIds);
                tenantNameMap = tenants.stream()
                        .collect(Collectors.toMap(Tenant::getId, Tenant::getTenantName));
            }
        }

        final Map<Long, String> nameMap = tenantNameMap;
        List<Map<String, Object>> voList = pageResult.getRecords().stream().map(log -> {
            Map<String, Object> vo = new LinkedHashMap<>();
            vo.put("id", log.getId());
            vo.put("tenantId", log.getTenantId());
            vo.put("tenantName", nameMap.getOrDefault(log.getTenantId(), null));
            vo.put("module", log.getModule());
            vo.put("operation", log.getOperation());
            vo.put("description", log.getDescription());
            vo.put("method", log.getMethod());
            vo.put("url", log.getUrl());
            vo.put("status", log.getStatus());
            vo.put("errorMsg", log.getErrorMsg());
            vo.put("params", truncate(log.getParams(), 4000));
            vo.put("result", truncate(log.getResult(), 4000));
            vo.put("ip", log.getIp());
            vo.put("userId", log.getUserId());
            vo.put("username", log.getUsername());
            vo.put("duration", log.getDuration());
            vo.put("createTime", log.getCreateTime());
            return vo;
        }).collect(Collectors.toList());

        return Result.success(new PageResult<>(voList, pageResult.getTotal(), page, pageSize));
    }

    /**
     * 清理操作日志：beforeDate 为空表示清空全部，否则只删该日期之前的记录。
     * 每日定时任务 {@link com.supermarket.erp.common.schedule.LogCleanTask} 仍按配置保留天数自动兜底，
     * 这个接口用于压测/批量导入刷出大量日志后立即回收体积的应急场景。
     */
    @Operation(summary = "清理操作日志（仅平台超级管理员）")
    @DeleteMapping
    @PreAuthorize("@perm.check('sys:operation:clean')")
    @LogOperation(module = "操作日志", operation = "清理操作日志")
    public Result<Integer> clean(@RequestParam(required = false) String beforeDate) {
        requirePlatformAdmin();

        LambdaQueryWrapper<OperationLog> wrapper = new LambdaQueryWrapper<>();
        // 无条件删除会被 BlockAttackInnerInterceptor 拦截，这里用主键范围显式声明删除范围
        wrapper.ge(OperationLog::getId, 1L);
        if (StringUtils.hasText(beforeDate)) {
            wrapper.lt(OperationLog::getCreateTime, parseDeadline(beforeDate));
        }
        return Result.success(operationLogMapper.delete(wrapper));
    }

    /** 仅平台租户(1)的超级管理员(userType=3)可清理；租户管理员只可查看 */
    private static void requirePlatformAdmin() {
        Integer userType = SecurityUtil.getUserType();
        Long tenantId = SecurityUtil.getTenantId();
        if (userType == null || userType != 3 || !PLATFORM_TENANT_ID.equals(tenantId)) {
            throw new BusinessException(403, "仅平台超级管理员可清理日志");
        }
    }

    /** yyyy-MM-dd → 当天 0 点（早于该时间点的记录被删除） */
    private static LocalDateTime parseDeadline(String beforeDate) {
        try {
            return LocalDate.parse(beforeDate.trim()).atStartOfDay();
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, "日期格式应为 yyyy-MM-dd");
        }
    }

    private static String truncate(String text, int maxLength) {
        if (text == null) {
            return null;
        }
        return text.length() > maxLength ? text.substring(0, maxLength) + "..." : text;
    }
}
