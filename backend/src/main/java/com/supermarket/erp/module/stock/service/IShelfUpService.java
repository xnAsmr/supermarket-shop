package com.supermarket.erp.module.stock.service;

import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.module.stock.dto.ShelfUpCreateDTO;
import com.supermarket.erp.module.stock.dto.ShelfUpQueryDTO;
import com.supermarket.erp.module.stock.vo.ShelfUpVO;

/**
 * 上架单服务（仓库 → 货架，无审核）。
 */
public interface IShelfUpService {

    PageResult<ShelfUpVO> pageList(ShelfUpQueryDTO query, Long tenantId);

    ShelfUpVO getById(Long id, Long tenantId);

    Long create(ShelfUpCreateDTO dto, Long tenantId, Long userId);

    void update(Long id, ShelfUpCreateDTO dto, Long tenantId, Long userId);

    void delete(Long id, Long tenantId, Long userId);

    /** 确认上架：仓库减少、货架增加 */
    void confirm(Long id, Long tenantId, Long userId);

    /** 撤销上架：货架减少、仓库恢复 */
    void rollback(Long id, Long tenantId, Long userId);
}
