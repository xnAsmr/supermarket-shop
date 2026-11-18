package com.supermarket.erp.module.purchase.service;

import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.module.purchase.dto.PurchaseOrderCreateDTO;
import com.supermarket.erp.module.purchase.dto.PurchaseOrderQueryDTO;
import com.supermarket.erp.module.purchase.dto.PurchaseReceiveDTO;
import com.supermarket.erp.module.purchase.vo.PurchaseOrderVO;

import java.util.List;

/**
 * 采购订单服务。
 */
public interface IPurchaseOrderService {

    PageResult<PurchaseOrderVO> pageList(PurchaseOrderQueryDTO query, Long tenantId);

    PurchaseOrderVO getById(Long id, Long tenantId);

    Long create(PurchaseOrderCreateDTO dto, Long tenantId, Long userId);

    void update(Long id, PurchaseOrderCreateDTO dto, Long tenantId, Long userId);

    void delete(Long id, Long tenantId, Long userId);

    /** 提交审核（草稿 → 待审核） */
    void submit(Long id, Long tenantId, Long userId);

    /** 审核通过（待审核 → 已审核） */
    void review(Long id, Long tenantId, Long userId, String remark);

    /** 撤销审核（待审核 → 草稿） */
    void revokeReview(Long id, Long tenantId, Long userId);

    /** 取消订单 */
    void cancel(Long id, Long tenantId, Long userId, String reason);

    /** 可收货明细（订购数量 > 已收数量 的行） */
    List<PurchaseOrderVO.PurchaseOrderItemVO> receivableItems(Long id, Long tenantId);

    /**
     * 收货入库（收货即入库）：校验本次收货数量 → 生成采购入库单（wms_purchase_in）→
     * 加库存 → 回写已收数量 → 重算采购订单状态。支持部分收货。
     *
     * @return 采购入库单ID
     */
    Long receive(Long id, PurchaseReceiveDTO dto, Long tenantId, Long userId);

    /** 可退明细（已收数量 > 已退数量 的行） */
    List<PurchaseOrderVO.PurchaseOrderItemVO> returnableItems(Long id, Long tenantId);
}
