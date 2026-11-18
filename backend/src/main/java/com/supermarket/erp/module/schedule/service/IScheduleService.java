package com.supermarket.erp.module.schedule.service;

import com.supermarket.erp.module.schedule.dto.*;
import com.supermarket.erp.module.schedule.vo.ScheduleVO;

import java.util.List;

/**
 * 排班模块服务：门店/员工/班次基础数据、周班表编排、冲突与时间段校验、
 * 调班审批与班表回写、我的排班。
 *
 * <p>租户、登录人、所属门店统一从 SecurityUtil 读取，不接受前端传入，避免越权。
 */
public interface IScheduleService {

    /* 基础数据 */

    List<ScheduleVO.StoreOptionVO> listStores();

    List<ScheduleVO.EmployeeOptionVO> listEmployees(String storeId);

    ScheduleVO.EmployeeOptionVO currentEmployee();

    List<ScheduleVO.ShiftVO> listShifts(String storeId);

    ScheduleVO.ShiftVO upsertShift(ShiftUpsertDTO dto);

    void toggleShift(String id);

    void deleteShift(String id);

    /* 周班表 */

    ScheduleVO.WeekScheduleVO getWeek(String storeId, String weekStart);

    ScheduleVO.ValidationVO validateWeek(String storeId, String weekStart);

    void saveWeek(WeekSaveDTO dto);

    ScheduleVO.ScheduleItemVO addItem(ScheduleItemDTO dto);

    void deleteItem(String id);

    ScheduleVO.WeekScheduleVO copyPrevWeek(CopyPrevWeekDTO dto);

    void publishWeek(WeekActionDTO dto);

    void revokeWeek(WeekActionDTO dto);

    /* 调班审批 */

    List<ScheduleVO.ChangeVO> listChanges();

    ScheduleVO.ChangeVO createChange(ChangeCreateDTO dto);

    ScheduleVO.ChangeVO reviewChange(String id, ChangeReviewDTO dto);

    void cancelChange(String id);

    /* 我的排班 */

    List<ScheduleVO.ScheduleItemVO> listMySchedule(String weekStart);
}
