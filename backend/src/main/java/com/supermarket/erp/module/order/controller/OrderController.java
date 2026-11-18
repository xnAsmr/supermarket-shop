package com.supermarket.erp.module.order.controller;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.supermarket.erp.common.annotation.LogOperation;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.order.dto.OrderQueryDTO;
import com.supermarket.erp.module.order.dto.PaymentFlowQueryDTO;
import com.supermarket.erp.module.order.dto.PaymentRecordQueryDTO;
import com.supermarket.erp.module.order.mapper.OrderPaymentMapper;
import com.supermarket.erp.module.order.service.IOrderService;
import com.supermarket.erp.module.order.vo.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "订单管理")
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final IOrderService orderService;
    private final OrderPaymentMapper orderPaymentMapper;

    @Operation(summary = "分页查询订单列表")
    @GetMapping
    public Result<PageResult<OrderVO>> pageList(OrderQueryDTO query) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(orderService.pageList(query, tenantId));
    }

    @Operation(summary = "订单详情")
    @GetMapping("/{id}")
    public Result<OrderVO> detail(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(orderService.getById(id, tenantId));
    }

    @Operation(summary = "支付方式余额统计")
    @GetMapping("/payment-method-stats")
    public Result<List<PaymentMethodStatVO>> paymentMethodStats() {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(orderPaymentMapper.selectPaymentMethodStats(tenantId));
    }

    @Operation(summary = "每日支付流水趋势")
    @GetMapping("/daily-payment-flow")
    public Result<List<DailyPaymentFlowVO>> dailyPaymentFlow(PaymentFlowQueryDTO query) {
        Long tenantId = SecurityUtil.getTenantId();
        // 日期为空时传 null（SQL 动态省略该边界），避免空串绑定 DATETIME 报 Incorrect value
        String startDate = StringUtils.hasText(query.getStartDate())
                ? query.getStartDate() + " 00:00:00" : null;
        String endDate = StringUtils.hasText(query.getEndDate())
                ? query.getEndDate() + " 23:59:59" : null;
        return Result.success(orderPaymentMapper.selectDailyPaymentFlow(tenantId, startDate, endDate));
    }

    @Operation(summary = "财务日结（按支付方式汇总）")
    @GetMapping("/daily-settlement")
    public Result<List<DailyPaymentFlowVO>> dailySettlement(
            @RequestParam String date) {
        if (!StringUtils.hasText(date)) {
            return Result.fail("date 不能为空");
        }
        Long tenantId = SecurityUtil.getTenantId();
        String startDate = date + " 00:00:00";
        String endDate = date + " 23:59:59";
        return Result.success(orderPaymentMapper.selectDailyPaymentFlow(tenantId, startDate, endDate));
    }

    @Operation(summary = "收支流水（逐笔支付明细，含关联订单号与操作人）")
    @GetMapping("/payment-records")
    public Result<PageResult<PaymentRecordVO>> paymentRecords(PaymentRecordQueryDTO query) {
        Long tenantId = SecurityUtil.getTenantId();
        Page<PaymentRecordVO> page = new Page<>(query.getPage(), query.getPageSize());
        IPage<PaymentRecordVO> result = orderPaymentMapper.selectPaymentRecords(
                page,
                tenantId,
                query.getStartDate() != null ? query.getStartDate() + " 00:00:00" : null,
                query.getEndDate() != null ? query.getEndDate() + " 23:59:59" : null,
                query.getOrderNo(),
                query.getType(),
                query.getPaymentMethod()
        );
        return Result.success(PageResult.of(
                result.getRecords(), result.getTotal(), (int) result.getCurrent(), (int) result.getSize()));
    }

    @Operation(summary = "支付流水明细统计")
    @GetMapping("/payment-flow")
    public Result<List<PaymentFlowVO>> paymentFlow(PaymentFlowQueryDTO query) {
        Long tenantId = SecurityUtil.getTenantId();
        // 日期为空时传 null（SQL 动态省略该边界），避免空串绑定 DATETIME 报 Incorrect value
        String startDate = StringUtils.hasText(query.getStartDate())
                ? query.getStartDate() + " 00:00:00" : null;
        String endDate = StringUtils.hasText(query.getEndDate())
                ? query.getEndDate() + " 23:59:59" : null;
        return Result.success(orderPaymentMapper.selectPaymentFlow(
                tenantId, startDate, endDate, query.getStoreId(), query.getPaymentMethod()));
    }

    @Operation(summary = "取消订单（逻辑取消，可恢复）")
    @LogOperation(module = "订单管理", operation = "取消订单")
    @PreAuthorize("@perm.check('oms:order:cancel')")
    @PutMapping("/{id}/cancel")
    public Result<Void> cancel(@PathVariable Long id,
                               @RequestBody(required = false) Map<String, String> body) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        String reason = body == null ? null : body.get("reason");
        orderService.cancel(id, tenantId, userId, reason);
        return Result.success();
    }

    @Operation(summary = "恢复已取消的订单")
    @LogOperation(module = "订单管理", operation = "恢复订单")
    @PreAuthorize("@perm.check('oms:order:cancel')")
    @PutMapping("/{id}/restore")
    public Result<Void> restore(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        orderService.restore(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "完成订单")
    @LogOperation(module = "订单管理", operation = "完成订单")
    @PreAuthorize("@perm.check('oms:order:complete')")
    @PutMapping("/{id}/complete")
    public Result<Void> complete(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        orderService.complete(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "整单退款")
    @LogOperation(module = "订单管理", operation = "订单退款")
    @PreAuthorize("@perm.check('oms:order:refund')")
    @PutMapping("/{id}/refund")
    public Result<Void> refund(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        orderService.refund(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "删除订单（仅限已取消订单）")
    @LogOperation(module = "订单管理", operation = "删除订单")
    @PreAuthorize("@perm.check('oms:order:cancel')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        orderService.delete(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "修改订单备注")
    @LogOperation(module = "订单管理", operation = "修改订单备注")
    @PutMapping("/{id}/remark")
    public Result<Void> updateRemark(@PathVariable Long id, @RequestBody java.util.Map<String, String> body) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        orderService.updateRemark(id, tenantId, body.get("remark"), userId);
        return Result.success();
    }
}
