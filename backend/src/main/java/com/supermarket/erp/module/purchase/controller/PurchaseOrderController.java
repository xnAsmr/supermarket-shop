package com.supermarket.erp.module.purchase.controller;

import com.supermarket.erp.common.annotation.LogOperation;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.purchase.dto.PurchaseOrderCreateDTO;
import com.supermarket.erp.module.purchase.dto.PurchaseOrderQueryDTO;
import com.supermarket.erp.module.purchase.dto.PurchaseReceiveDTO;
import com.supermarket.erp.module.purchase.service.IPurchaseOrderService;
import com.supermarket.erp.module.purchase.vo.PurchaseOrderVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "采购订单")
@RestController
@RequestMapping("/api/v1/purchase-orders")
@RequiredArgsConstructor
public class PurchaseOrderController {

    private final IPurchaseOrderService purchaseOrderService;

    @Operation(summary = "分页查询采购订单")
    @GetMapping
    public Result<PageResult<PurchaseOrderVO>> pageList(PurchaseOrderQueryDTO query) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(purchaseOrderService.pageList(query, tenantId));
    }

    @Operation(summary = "采购订单详情")
    @GetMapping("/{id}")
    public Result<PurchaseOrderVO> detail(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(purchaseOrderService.getById(id, tenantId));
    }

    @Operation(summary = "新建采购订单（草稿）")
    @LogOperation(module = "采购管理", operation = "新建采购订单")
    @PreAuthorize("@perm.check('pms:purchase:add')")
    @PostMapping
    public Result<Long> create(@RequestBody @Valid PurchaseOrderCreateDTO dto) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        return Result.success(purchaseOrderService.create(dto, tenantId, userId));
    }

    @Operation(summary = "编辑采购订单（仅草稿）")
    @LogOperation(module = "采购管理", operation = "编辑采购订单")
    @PreAuthorize("@perm.check('pms:purchase:edit')")
    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody @Valid PurchaseOrderCreateDTO dto) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        purchaseOrderService.update(id, dto, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "删除采购订单（仅草稿）")
    @LogOperation(module = "采购管理", operation = "删除采购订单")
    @PreAuthorize("@perm.check('pms:purchase:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        purchaseOrderService.delete(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "提交采购订单审核")
    @LogOperation(module = "采购管理", operation = "提交采购订单审核")
    @PreAuthorize("@perm.check('pms:purchase:edit')")
    @PutMapping("/{id}/submit")
    public Result<Void> submit(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        purchaseOrderService.submit(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "审核通过采购订单")
    @LogOperation(module = "采购管理", operation = "审核采购订单")
    @PreAuthorize("@perm.check('pms:purchase:edit')")
    @PutMapping("/{id}/review")
    public Result<Void> review(@PathVariable Long id,
                               @RequestBody(required = false) Map<String, String> body) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        String remark = body == null ? null : body.get("remark");
        purchaseOrderService.review(id, tenantId, userId, remark);
        return Result.success();
    }

    @Operation(summary = "撤销采购订单审核")
    @LogOperation(module = "采购管理", operation = "撤销采购订单审核")
    @PreAuthorize("@perm.check('pms:purchase:edit')")
    @PutMapping("/{id}/revoke-review")
    public Result<Void> revokeReview(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        purchaseOrderService.revokeReview(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "取消采购订单")
    @LogOperation(module = "采购管理", operation = "取消采购订单")
    @PreAuthorize("@perm.check('pms:purchase:delete')")
    @PutMapping("/{id}/cancel")
    public Result<Void> cancel(@PathVariable Long id,
                               @RequestBody(required = false) Map<String, String> body) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        String reason = body == null ? null : body.get("reason");
        purchaseOrderService.cancel(id, tenantId, userId, reason);
        return Result.success();
    }

    @Operation(summary = "可收货明细（订购数量大于已收数量）")
    @GetMapping("/{id}/receivable-items")
    public Result<List<PurchaseOrderVO.PurchaseOrderItemVO>> receivableItems(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(purchaseOrderService.receivableItems(id, tenantId));
    }

    @Operation(summary = "收货入库（确认本次收货数量，直接加库存并生成入库单）")
    @LogOperation(module = "采购管理", operation = "采购收货入库")
    @PreAuthorize("@perm.check('pms:purchase:edit')")
    @PostMapping("/{id}/receive")
    public Result<Long> receive(@PathVariable Long id, @RequestBody @Valid PurchaseReceiveDTO dto) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        return Result.success(purchaseOrderService.receive(id, dto, tenantId, userId));
    }

    @Operation(summary = "可退明细（已收数量大于已退数量）")
    @GetMapping("/{id}/returnable-items")
    public Result<List<PurchaseOrderVO.PurchaseOrderItemVO>> returnableItems(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(purchaseOrderService.returnableItems(id, tenantId));
    }
}
