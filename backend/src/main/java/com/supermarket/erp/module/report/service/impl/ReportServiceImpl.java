package com.supermarket.erp.module.report.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.supermarket.erp.module.report.mapper.ReportMapper;
import com.supermarket.erp.module.report.service.IReportService;
import com.supermarket.erp.module.report.vo.CashierRankVO;
import com.supermarket.erp.module.report.vo.DailyReportVO;
import com.supermarket.erp.module.report.vo.DashboardVO;
import com.supermarket.erp.module.report.vo.MemberReportVO;
import com.supermarket.erp.module.report.vo.MonthlyReportVO;
import com.supermarket.erp.module.report.vo.SalesTrendVO;
import com.supermarket.erp.module.report.vo.StockCategoryReportVO;
import com.supermarket.erp.module.stock.entity.Stock;
import com.supermarket.erp.module.stock.mapper.StockMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportServiceImpl implements IReportService {

    private final ReportMapper reportMapper;
    private final StockMapper stockMapper;

    @Override
    public DailyReportVO getDailyReport(Long tenantId, Long storeId, LocalDate date) {
        return reportMapper.selectDailyReport(tenantId, storeId, date);
    }

    @Override
    public MonthlyReportVO getMonthlyReport(Long tenantId, Long storeId, Integer year, Integer month) {
        return reportMapper.selectMonthlyReport(tenantId, storeId, year, month);
    }

    @Override
    public DashboardVO getDashboard(Long tenantId, Long storeId) {
        DashboardVO vo = new DashboardVO();
        LocalDate today = LocalDate.now();

        DailyReportVO daily = reportMapper.selectDailyReport(tenantId, storeId, today);
        if (daily != null) {
            vo.setTodaySalesAmount(daily.getPayAmount());
            vo.setTodayOrderCount(daily.getOrderCount());
            vo.setTodayMemberCount(daily.getMemberCount());
        } else {
            vo.setTodaySalesAmount(BigDecimal.ZERO);
            vo.setTodayOrderCount(0);
            vo.setTodayMemberCount(0);
        }

        MonthlyReportVO monthly = reportMapper.selectMonthlyReport(tenantId, storeId, today.getYear(), today.getMonthValue());
        if (monthly != null) {
            vo.setMonthSalesAmount(monthly.getPayAmount());
            vo.setMonthOrderCount(monthly.getOrderCount());
            vo.setMonthProfitAmount(monthly.getProfitAmount());
        } else {
            vo.setMonthSalesAmount(BigDecimal.ZERO);
            vo.setMonthOrderCount(0);
            vo.setMonthProfitAmount(BigDecimal.ZERO);
        }

        // 低库存预警数（货架库存 < 10 视为低库存）
        LambdaQueryWrapper<Stock> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Stock::getTenantId, tenantId)
               .apply("shelf_quantity < 10");
        if (storeId != null) {
            wrapper.eq(Stock::getStoreId, storeId);
        }
        Long lowStockCount = stockMapper.selectCount(wrapper);
        vo.setLowStockCount(lowStockCount.intValue());

        return vo;
    }

    @Override
    public List<StockCategoryReportVO> getStockCategoryReport(Long tenantId) {
        return reportMapper.selectStockCategoryReport(tenantId);
    }

    @Override
    public MemberReportVO getMemberReport(Long tenantId, Integer year, Integer month) {
        return reportMapper.selectMemberReport(tenantId, year, month);
    }

    @Override
    public List<CashierRankVO> getCashierRank(Long tenantId, Long storeId, LocalDate startDate, LocalDate endDate, Integer limit) {
        return reportMapper.selectCashierRank(tenantId, storeId, startDate, endDate, limit);
    }

    @Override
    public List<SalesTrendVO> getSalesTrend(Long tenantId, Long storeId, String range) {
        LocalDate today = LocalDate.now();
        LocalDate startDate;
        String format;
        switch (range == null ? "day" : range) {
            case "year":
                // 近 5 年，按年聚合
                startDate = today.withDayOfYear(1).minusYears(4);
                format = "%Y";
                break;
            case "month":
                // 近 12 个月，按月聚合
                startDate = today.withDayOfMonth(1).minusMonths(11);
                format = "%Y-%m";
                break;
            case "week":
                // 近 12 周，后端按日返回，前端按周聚合
                startDate = today.with(DayOfWeek.MONDAY).minusWeeks(11);
                format = "%Y-%m-%d";
                break;
            case "day":
            default:
                // 近 14 天，按日聚合
                startDate = today.minusDays(13);
                format = "%Y-%m-%d";
                break;
        }
        // 右开区间：包含今天全天
        return reportMapper.selectSalesTrend(tenantId, storeId, startDate, today.plusDays(1), format);
    }
}
