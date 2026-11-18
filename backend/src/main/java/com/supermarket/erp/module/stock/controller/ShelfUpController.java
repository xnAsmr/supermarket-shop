package com.supermarket.erp.module.stock.controller;

import com.supermarket.erp.common.annotation.LogOperation;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.stock.dto.ShelfUpCreateDTO;
import com.supermarket.erp.module.stock.dto.ShelfUpQueryDTO;
import com.supermarket.erp.module.stock.service.IShelfUpService;
import com.supermarket.erp.module.stock.vo.ShelfUpVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@Tag(name = "上架单")
@RestController
@RequestMapping("/api/v1/stock/shelf-ups")
@RequiredArgsConstructor
public class ShelfUpController {

    private final IShelfUpService shelfUpService;

    @Operation(summary = "分页查询上架单")
    @GetMapping
    public Result<PageResult<ShelfUpVO>> pageList(ShelfUpQueryDTO query) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(shelfUpService.pageList(query, tenantId));
    }

    @Operation(summary = "上架单详情")
    @GetMapping("/{id}")
    public Result<ShelfUpVO> detail(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        return Result.success(shelfUpService.getById(id, tenantId));
    }

    @Operation(summary = "新建上架单（草稿）")
    @LogOperation(module = "仓库管理", operation = "新建上架单")
    @PreAuthorize("@perm.check('wms:stock:shelf-up:add')")
    @PostMapping
    public Result<Long> create(@RequestBody @Valid ShelfUpCreateDTO dto) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        return Result.success(shelfUpService.create(dto, tenantId, userId));
    }

    @Operation(summary = "编辑上架单（仅草稿）")
    @LogOperation(module = "仓库管理", operation = "编辑上架单")
    @PreAuthorize("@perm.check('wms:stock:shelf-up:add')")
    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody @Valid ShelfUpCreateDTO dto) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        shelfUpService.update(id, dto, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "删除上架单（仅草稿）")
    @LogOperation(module = "仓库管理", operation = "删除上架单")
    @PreAuthorize("@perm.check('wms:stock:shelf-up:delete')")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        shelfUpService.delete(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "确认上架（仓库减少、货架增加）")
    @LogOperation(module = "仓库管理", operation = "确认上架")
    @PreAuthorize("@perm.check('wms:stock:shelf-up:edit')")
    @PutMapping("/{id}/confirm")
    public Result<Void> confirm(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        shelfUpService.confirm(id, tenantId, userId);
        return Result.success();
    }

    @Operation(summary = "撤销上架（货架减少、仓库恢复）")
    @LogOperation(module = "仓库管理", operation = "撤销上架")
    @PreAuthorize("@perm.check('wms:stock:shelf-up:delete')")
    @PutMapping("/{id}/rollback")
    public Result<Void> rollback(@PathVariable Long id) {
        Long tenantId = SecurityUtil.getTenantId();
        Long userId = SecurityUtil.getUserId();
        shelfUpService.rollback(id, tenantId, userId);
        return Result.success();
    }
}
