package com.supermarket.erp.module.report.service;

import com.supermarket.erp.module.report.vo.CashierRankVO;
import com.supermarket.erp.module.report.vo.DailyReportVO;
import com.supermarket.erp.module.report.vo.DashboardVO;
import com.supermarket.erp.module.report.vo.MemberReportVO;
import com.supermarket.erp.module.report.vo.MonthlyReportVO;
import com.supermarket.erp.module.report.vo.SalesTrendVO;
import com.supermarket.erp.module.report.vo.StockCategoryReportVO;

import java.time.LocalDate;
import java.util.List;

public interface IReportService {

    DailyReportVO getDailyReport(Long tenantId, Long storeId, LocalDate date);

    MonthlyReportVO getMonthlyReport(Long tenantId, Long storeId, Integer year, Integer month);

    DashboardVO getDashboard(Long tenantId, Long storeId);

    List<StockCategoryReportVO> getStockCategoryReport(Long tenantId);

    MemberReportVO getMemberReport(Long tenantId, Integer year, Integer month);

    List<CashierRankVO> getCashierRank(Long tenantId, Long storeId, LocalDate startDate, LocalDate endDate, Integer limit);

    /**
     * 销售总览趋势（经营驾驶舱「销售总览」）
     * @param range day=近14天按日 / week=近12周按周 / month=近12月按月 / year=近5年按年
     */
    List<SalesTrendVO> getSalesTrend(Long tenantId, Long storeId, String range);
}
