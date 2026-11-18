package com.supermarket.erp.module.order.controller;

import com.supermarket.erp.common.annotation.LogOperation;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.order.dto.RefundCreateDTO;
import com.supermarket.erp.module.order.dto.RefundQueryDTO;
import com.supermarket.erp.module.order.service.IOrderService;
import com.supermarket.erp.module.order.vo.RefundVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "退货退款")
@RestController
@RequestMapping("/api/v1/refunds")
@RequiredArgsConstructor
public class RefundController {

    private final IOrderService orderService;

    @Operation(summary = "分页查询退货单")
    @GetMapping
    public Result<PageResult<RefundVO>> pageList(RefundQueryDTO query) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(orderService.pageRefunds(query, tenantId));
    }

    @Operation(summary = "退货单详情")
    @GetMapping("/{id}")
    public Result<RefundVO> detail(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(orderService.getRefund(id, tenantId));
    }

    @Operation(summary = "发起退货（支持按商品部分退货）")
    @LogOperation(module = "退货退款", operation = "发起退货")
    @PreAuthorize("@perm.check('oms:order:return:add')")
    @PostMapping
    public Result<RefundVO> create(@RequestBody @Valid RefundCreateDTO dto) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        return Result.success(orderService.createRefund(dto, tenantId, userId));
    }

    @Operation(summary = "作废退货单（取消退货，恢复原订单）")
    @LogOperation(module = "退货退款", operation = "作废退货单")
    @PreAuthorize("@perm.check('oms:order:return:add')")
    @PutMapping("/{id}/cancel")
    public Result<Void> cancel(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        orderService.cancelRefund(id, tenantId, userId);
        return Result.success();
    }
}
