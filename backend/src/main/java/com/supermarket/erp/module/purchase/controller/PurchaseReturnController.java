package com.supermarket.erp.module.purchase.controller;

import com.supermarket.erp.common.annotation.LogOperation;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.purchase.dto.PurchaseReturnCreateDTO;
import com.supermarket.erp.module.purchase.dto.PurchaseReturnQueryDTO;
import com.supermarket.erp.module.purchase.service.IPurchaseReturnService;
import com.supermarket.erp.module.purchase.vo.PurchaseReturnVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "采购退货单")
@RestController
@RequestMapping("/api/v1/purchase-returns")
@RequiredArgsConstructor
public class PurchaseReturnController {

    private final IPurchaseReturnService purchaseReturnService;

    @Operation(summary = "分页查询采购退货单")
    @GetMapping
    public Result<PageResult<PurchaseReturnVO>> pageList(PurchaseReturnQueryDTO query) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(purchaseReturnService.pageList(query, tenantId));
    }

    @Operation(summary = "采购退货单详情")
    @GetMapping("/{id}")
    public Result<PurchaseReturnVO> detail(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(purchaseReturnService.getById(id, tenantId));
    }

    @Operation(summary = "新建采购退货单（可从采购订单带出可退明细）")
    @LogOperation(module = "采购管理", operation = "新建采购退货单")
    @PreAuthorize("@perm.check('pms:purchase:return:add')")
    @PostMapping
    public Result<Long> create(@RequestBody @Valid PurchaseReturnCreateDTO dto) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        return Result.success(purchaseReturnService.create(dto, tenantId, userId));
    }

    @Operation(summary = "编辑采购退货单（仅草稿）")
    @LogOperation(module = "采购管理", operation = "编辑采购退货单")
    @PreAuthorize("@perm.check('pms:purchase:return:edit')")
    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody @Valid PurchaseReturnCreateDTO dto) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        purchaseReturnService.update(id, dto, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "删除采购退货单（仅草稿）")
    @LogOperation(module = "采购管理", operation = "删除采购退货单")
    @PreAuthorize("@perm.check('pms:purchase:return:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        purchaseReturnService.delete(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "提交采购退货单审核")
    @LogOperation(module = "采购管理", operation = "提交采购退货单审核")
    @PreAuthorize("@perm.check('pms:purchase:return:edit')")
    @PutMapping("/{id}/submit")
    public Result<Void> submit(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        purchaseReturnService.submit(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "审核通过采购退货单")
    @LogOperation(module = "采购管理", operation = "审核采购退货单")
    @PreAuthorize("@perm.check('pms:purchase:return:edit')")
    @PutMapping("/{id}/review")
    public Result<Void> review(@PathVariable Long id,
                               @RequestBody(required = false) Map<String, String> body) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        String remark = body == null ? null : body.get("remark");
        purchaseReturnService.review(id, tenantId, userId, remark);
        return Result.success();
    }

    @Operation(summary = "确认退货（减库存并回写采购订单已退数量）")
    @LogOperation(module = "采购管理", operation = "确认采购退货")
    @PreAuthorize("@perm.check('pms:purchase:return:edit')")
    @PutMapping("/{id}/confirm")
    public Result<Void> confirm(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        purchaseReturnService.confirm(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "作废采购退货单（已退货的恢复库存）")
    @LogOperation(module = "采购管理", operation = "作废采购退货单")
    @PreAuthorize("@perm.check('pms:purchase:return:delete')")
    @PutMapping("/{id}/cancel")
    public Result<Void> cancel(@PathVariable Long id,
                               @RequestBody(required = false) Map<String, String> body) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        String reason = body == null ? null : body.get("reason");
        purchaseReturnService.cancel(id, tenantId, userId, reason);
        return Result.success();
    }
}
