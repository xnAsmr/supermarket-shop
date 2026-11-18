package com.supermarket.erp.module.purchase.service;

import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.module.purchase.dto.PurchaseReturnCreateDTO;
import com.supermarket.erp.module.purchase.dto.PurchaseReturnQueryDTO;
import com.supermarket.erp.module.purchase.vo.PurchaseReturnVO;

/**
 * 采购退货单服务。
 */
public interface IPurchaseReturnService {

    PageResult<PurchaseReturnVO> pageList(PurchaseReturnQueryDTO query, Long tenantId);

    PurchaseReturnVO getById(Long id, Long tenantId);

    Long create(PurchaseReturnCreateDTO dto, Long tenantId, Long userId);

    void update(Long id, PurchaseReturnCreateDTO dto, Long tenantId, Long userId);

    void delete(Long id, Long tenantId, Long userId);

    /** 提交审核 */
    void submit(Long id, Long tenantId, Long userId);

    /** 审核通过 */
    void review(Long id, Long tenantId, Long userId, String remark);

    /** 退货生效：减库存、回写采购明细已退数量、重算采购单状态 */
    void confirm(Long id, Long tenantId, Long userId);

    /** 作废：恢复库存与已退数量 */
    void cancel(Long id, Long tenantId, Long userId, String reason);
}
