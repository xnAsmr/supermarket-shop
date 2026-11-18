package com.supermarket.erp.module.stock.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.module.auth.entity.User;
import com.supermarket.erp.module.auth.mapper.UserMapper;
import com.supermarket.erp.module.product.entity.Product;
import com.supermarket.erp.module.product.mapper.ProductMapper;
import com.supermarket.erp.module.stock.dto.ShelfUpCreateDTO;
import com.supermarket.erp.module.stock.dto.ShelfUpQueryDTO;
import com.supermarket.erp.module.stock.entity.ShelfUp;
import com.supermarket.erp.module.stock.entity.ShelfUpItem;
import com.supermarket.erp.module.stock.entity.Stock;
import com.supermarket.erp.module.stock.entity.StockLog;
import com.supermarket.erp.module.stock.mapper.ShelfUpItemMapper;
import com.supermarket.erp.module.stock.mapper.ShelfUpMapper;
import com.supermarket.erp.module.stock.mapper.StockLogMapper;
import com.supermarket.erp.module.stock.mapper.StockMapper;
import com.supermarket.erp.module.stock.service.IShelfUpService;
import com.supermarket.erp.module.stock.vo.ShelfUpVO;
import com.supermarket.erp.module.tenant.entity.Store;
import com.supermarket.erp.module.tenant.mapper.StoreMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ShelfUpServiceImpl implements IShelfUpService {

    /** 库存日志类型：7-上架（仓库→货架） */
    public static final int STOCK_LOG_SHELF_UP = 7;
    /** 库存日志类型：8-上架撤销（货架→仓库） */
    public static final int STOCK_LOG_SHELF_UP_ROLLBACK = 8;

    private static final DateTimeFormatter NO_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final AtomicLong SEQ = new AtomicLong(0);

    private final ShelfUpMapper shelfUpMapper;
    private final ShelfUpItemMapper shelfUpItemMapper;
    private final StockMapper stockMapper;
    private final StockLogMapper stockLogMapper;
    private final ProductMapper productMapper;
    private final StoreMapper storeMapper;
    private final UserMapper userMapper;

    @Override
    public PageResult<ShelfUpVO> pageList(ShelfUpQueryDTO query, Long tenantId) {
        LambdaQueryWrapper<ShelfUp> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ShelfUp::getTenantId, tenantId);
        wrapper.eq(ShelfUp::getDeleted, 0);

        String keyword = query.getKeyword() != null && !query.getKeyword().isEmpty()
                ? query.getKeyword().trim()
                : (query.getShelfUpNo() != null ? query.getShelfUpNo().trim() : null);
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.like(ShelfUp::getShelfUpNo, keyword);
        }
        if (query.getStoreId() != null) {
            wrapper.eq(ShelfUp::getStoreId, query.getStoreId());
        }
        if (query.getStatus() != null) {
            wrapper.eq(ShelfUp::getStatus, query.getStatus());
        }
        if (query.getStartDate() != null) {
            wrapper.ge(ShelfUp::getCreateTime, query.getStartDate());
        }
        if (query.getEndDate() != null) {
            wrapper.le(ShelfUp::getCreateTime, query.getEndDate());
        }
        wrapper.orderByDesc(ShelfUp::getCreateTime);

        Page<ShelfUp> result = shelfUpMapper.selectPage(
                new Page<>(query.getPage(), query.getPageSize()), wrapper);
        List<ShelfUpVO> list = result.getRecords().stream()
                .map(this::toVO)
                .collect(Collectors.toList());
        return PageResult.of(list, result.getTotal(), query.getPage(), query.getPageSize());
    }

    @Override
    public ShelfUpVO getById(Long id, Long tenantId) {
        return toVO(requireShelfUp(id, tenantId));
    }

    @Override
    @Transactional
    public Long create(ShelfUpCreateDTO dto, Long tenantId, Long userId) {
        ShelfUp shelfUp = new ShelfUp();
        shelfUp.setTenantId(tenantId);
        shelfUp.setShelfUpNo(generateNo());
        shelfUp.setStoreId(dto.getStoreId());
        shelfUp.setStatus(0);
        shelfUp.setOperatorId(userId);
        shelfUp.setRemark(dto.getRemark());
        shelfUpMapper.insert(shelfUp);

        saveItems(shelfUp, dto.getItems(), tenantId);
        refreshTotals(shelfUp);
        return shelfUp.getId();
    }

    @Override
    @Transactional
    public void update(Long id, ShelfUpCreateDTO dto, Long tenantId, Long userId) {
        ShelfUp shelfUp = requireShelfUp(id, tenantId);
        if (shelfUp.getStatus() != 0) {
            throw new BusinessException(3406, "只有草稿状态的上架单可以编辑");
        }
        shelfUp.setStoreId(dto.getStoreId());
        shelfUp.setRemark(dto.getRemark());
        shelfUp.setUpdateBy(userId);
        shelfUpMapper.updateById(shelfUp);

        shelfUpItemMapper.hardDeleteByShelfUpId(id);
        saveItems(shelfUp, dto.getItems(), tenantId);
        refreshTotals(shelfUp);
    }

    @Override
    @Transactional
    public void delete(Long id, Long tenantId, Long userId) {
        ShelfUp shelfUp = requireShelfUp(id, tenantId);
        if (shelfUp.getStatus() != 0) {
            throw new BusinessException(3406, "只有草稿状态的上架单可以删除");
        }
        shelfUpItemMapper.hardDeleteByShelfUpId(id);
        shelfUpMapper.deleteById(id);
    }

    @Override
    @Transactional
    public void confirm(Long id, Long tenantId, Long userId) {
        ShelfUp shelfUp = requireShelfUp(id, tenantId);
        if (shelfUp.getStatus() == 1) {
            throw new BusinessException(3406, "该上架单已确认上架，请勿重复操作");
        }
        if (shelfUp.getStatus() != 0) {
            throw new BusinessException(3406, "只有草稿状态的上架单可以确认上架");
        }

        List<ShelfUpItem> items = shelfUpItemMapper.selectByShelfUpId(id);
        if (items.isEmpty()) {
            throw new BusinessException(3406, "上架单没有明细，无法确认");
        }

        // 先整体校验仓库库存是否够搬，避免部分成功
        for (ShelfUpItem item : items) {
            Stock stock = stockMapper.selectByProduct(tenantId, shelfUp.getStoreId(), item.getProductId());
            BigDecimal warehouse = stock != null && stock.getWarehouseQuantity() != null
                    ? stock.getWarehouseQuantity() : BigDecimal.ZERO;
            if (warehouse.compareTo(nz(item.getQuantity())) < 0) {
                throw new BusinessException(3407, "仓库库存不足：" + item.getProductName()
                        + "（仓库 " + warehouse.stripTrailingZeros().toPlainString()
                        + "，需上架 " + nz(item.getQuantity()).stripTrailingZeros().toPlainString() + "）");
            }
        }

        for (ShelfUpItem item : items) {
            applyMovement(shelfUp, item, tenantId, userId, true);
        }

        shelfUp.setStatus(1);
        shelfUp.setShelfUpUserId(userId);
        shelfUp.setShelfUpTime(LocalDateTime.now());
        shelfUp.setUpdateBy(userId);
        shelfUpMapper.updateById(shelfUp);
    }

    @Override
    @Transactional
    public void rollback(Long id, Long tenantId, Long userId) {
        ShelfUp shelfUp = requireShelfUp(id, tenantId);
        if (shelfUp.getStatus() == 0) {
            throw new BusinessException(3406, "草稿状态的上架单无需撤销");
        }
        if (shelfUp.getStatus() == 2) {
            throw new BusinessException(3406, "该上架单已撤销，请勿重复操作");
        }

        List<ShelfUpItem> items = shelfUpItemMapper.selectByShelfUpId(id);

        // 先校验货架库存是否够回退
        for (ShelfUpItem item : items) {
            Stock stock = stockMapper.selectByProduct(tenantId, shelfUp.getStoreId(), item.getProductId());
            BigDecimal shelf = stock != null && stock.getShelfQuantity() != null
                    ? stock.getShelfQuantity() : BigDecimal.ZERO;
            if (shelf.compareTo(nz(item.getQuantity())) < 0) {
                throw new BusinessException(3407, "货架库存不足，无法撤销：" + item.getProductName()
                        + "（货架 " + shelf.stripTrailingZeros().toPlainString()
                        + "，需回退 " + nz(item.getQuantity()).stripTrailingZeros().toPlainString()
                        + "，可能已部分售出）");
            }
        }

        for (ShelfUpItem item : items) {
            applyMovement(shelfUp, item, tenantId, userId, false);
        }

        shelfUp.setStatus(2);
        shelfUp.setUpdateBy(userId);
        shelfUpMapper.updateById(shelfUp);
    }

    /* ============================ 内部 ============================ */

    /**
     * 执行库存移动。
     *
     * @param toShelf true=上架（仓库→货架），false=撤销（货架→仓库）
     */
    private void applyMovement(ShelfUp shelfUp, ShelfUpItem item, Long tenantId, Long userId, boolean toShelf) {
        BigDecimal qty = nz(item.getQuantity());
        if (qty.compareTo(BigDecimal.ZERO) <= 0) return;

        Stock stock = stockMapper.selectByProduct(tenantId, shelfUp.getStoreId(), item.getProductId());
        if (stock == null) {
            throw new BusinessException(3408, "库存记录不存在：" + item.getProductName());
        }

        BigDecimal warehouseBefore = nz(stock.getWarehouseQuantity());
        BigDecimal shelfBefore = nz(stock.getShelfQuantity());

        BigDecimal warehouseAfter;
        BigDecimal shelfAfter;
        if (toShelf) {
            warehouseAfter = warehouseBefore.subtract(qty);
            shelfAfter = shelfBefore.add(qty);
        } else {
            warehouseAfter = warehouseBefore.add(qty);
            shelfAfter = shelfBefore.subtract(qty);
        }

        stock.setWarehouseQuantity(warehouseAfter);
        stock.setShelfQuantity(shelfAfter);
        stockMapper.updateById(stock);

        StockLog stockLog = new StockLog();
        stockLog.setTenantId(tenantId);
        stockLog.setStoreId(shelfUp.getStoreId());
        stockLog.setProductId(item.getProductId());
        stockLog.setLogType(toShelf ? STOCK_LOG_SHELF_UP : STOCK_LOG_SHELF_UP_ROLLBACK);
        stockLog.setQuantity(qty);
        stockLog.setBeforeStock(warehouseBefore);
        stockLog.setAfterStock(warehouseAfter);
        stockLog.setRelatedNo(shelfUp.getShelfUpNo());
        stockLog.setRelatedId(shelfUp.getId());
        stockLog.setOperatorId(userId);
        stockLog.setRemark((toShelf ? "上架 仓库→货架 " : "撤销上架 货架→仓库 ") + shelfUp.getShelfUpNo()
                + "（货架 " + shelfBefore.stripTrailingZeros().toPlainString()
                + " → " + shelfAfter.stripTrailingZeros().toPlainString() + "）");
        stockLogMapper.insert(stockLog);
    }

    private ShelfUp requireShelfUp(Long id, Long tenantId) {
        ShelfUp shelfUp = shelfUpMapper.selectOne(
                new LambdaQueryWrapper<ShelfUp>()
                        .eq(ShelfUp::getId, id)
                        .eq(ShelfUp::getTenantId, tenantId)
                        .eq(ShelfUp::getDeleted, 0)
        );
        if (shelfUp == null) {
            throw new BusinessException(3401, "上架单不存在或已删除");
        }
        return shelfUp;
    }

    private void saveItems(ShelfUp shelfUp, List<ShelfUpCreateDTO.Item> items, Long tenantId) {
        if (items == null || items.isEmpty()) {
            throw new BusinessException(3406, "请至少添加一条上架明细");
        }
        for (ShelfUpCreateDTO.Item dto : items) {
            BigDecimal qty = nz(dto.getQuantity());
            if (qty.compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException(3406, "上架数量必须大于 0");
            }
            Product product = productMapper.selectById(dto.getProductId());
            if (product == null) {
                throw new BusinessException(3406, "商品不存在（ID：" + dto.getProductId() + "）");
            }
            ShelfUpItem item = new ShelfUpItem();
            item.setTenantId(tenantId);
            item.setShelfUpId(shelfUp.getId());
            item.setProductId(dto.getProductId());
            item.setProductName(product.getName());
            item.setBarcode(product.getBarcode());
            item.setSpec(product.getSpec());
            item.setUnit(product.getUnit());
            item.setQuantity(qty);
            item.setRemark(dto.getRemark());
            shelfUpItemMapper.insert(item);
        }
    }

    private void refreshTotals(ShelfUp shelfUp) {
        BigDecimal total = BigDecimal.ZERO;
        for (ShelfUpItem item : shelfUpItemMapper.selectByShelfUpId(shelfUp.getId())) {
            total = total.add(nz(item.getQuantity()));
        }
        shelfUp.setTotalQuantity(total);
        shelfUpMapper.updateById(shelfUp);
    }

    private ShelfUpVO toVO(ShelfUp shelfUp) {
        ShelfUpVO vo = new ShelfUpVO();
        BeanUtils.copyProperties(shelfUp, vo);

        if (shelfUp.getStoreId() != null) {
            Store store = storeMapper.selectById(shelfUp.getStoreId());
            if (store != null) vo.setStoreName(store.getStoreName());
        }
        if (shelfUp.getOperatorId() != null) {
            User operator = userMapper.selectById(shelfUp.getOperatorId());
            if (operator != null) {
                vo.setOperatorName(nameOf(operator));
            }
        }
        if (shelfUp.getShelfUpUserId() != null) {
            User user = userMapper.selectById(shelfUp.getShelfUpUserId());
            if (user != null) {
                vo.setShelfUpUserName(nameOf(user));
            }
        }

        List<ShelfUpVO.ShelfUpItemVO> items = new ArrayList<>();
        for (ShelfUpItem item : shelfUpItemMapper.selectByShelfUpId(shelfUp.getId())) {
            ShelfUpVO.ShelfUpItemVO itemVO = new ShelfUpVO.ShelfUpItemVO();
            BeanUtils.copyProperties(item, itemVO);
            Stock stock = stockMapper.selectByProduct(shelfUp.getTenantId(), shelfUp.getStoreId(), item.getProductId());
            if (stock != null) {
                itemVO.setWarehouseQuantity(nz(stock.getWarehouseQuantity()));
                itemVO.setShelfQuantity(nz(stock.getShelfQuantity()));
            }
            items.add(itemVO);
        }
        vo.setItems(items);
        return vo;
    }

    private static String nameOf(User user) {
        return user.getName() != null ? user.getName() : user.getUsername();
    }

    private static BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    /** 生成上架单号：SJ + 时间戳 + 4 位序号 */
    private String generateNo() {
        return "SJ" + LocalDateTime.now().format(NO_FORMAT)
                + String.format("%04d", SEQ.incrementAndGet() % 10000);
    }
}
