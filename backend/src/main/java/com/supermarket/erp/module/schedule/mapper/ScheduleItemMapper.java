package com.supermarket.erp.module.schedule.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.supermarket.erp.module.schedule.entity.ScheduleItem;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;
import java.util.List;

@Mapper
public interface ScheduleItemMapper extends BaseMapper<ScheduleItem> {

    /**
     * 整周覆盖保存：物理删除旧明细。
     * 不能用 BaseMapper.delete（@TableLogic 会转成逻辑删除，导致历史行不断堆积）。
     */
    @Delete("DELETE FROM sch_schedule_item WHERE schedule_id = #{scheduleId}")
    int hardDeleteByScheduleId(@Param("scheduleId") Long scheduleId);

    /** 单条明细删除（带租户条件，防止越权） */
    @Delete("DELETE FROM sch_schedule_item WHERE id = #{id} AND tenant_id = #{tenantId}")
    int hardDeleteById(@Param("id") Long id, @Param("tenantId") Long tenantId);

    /** 调班审批通过时移除申请人在某格的原排班 */
    @Delete("DELETE FROM sch_schedule_item WHERE schedule_id = #{scheduleId} AND work_date = #{workDate} " +
            "AND shift_id = #{shiftId} AND user_id = #{userId}")
    int hardDeleteByCell(@Param("scheduleId") Long scheduleId,
                         @Param("workDate") java.time.LocalDate workDate,
                         @Param("shiftId") Long shiftId,
                         @Param("userId") Long userId);

    /**
     * 真实时间段重叠检索（半开区间 [start, end)）：
     * existing.start &lt; rangeEnd AND existing.end &gt; rangeStart。
     * 覆盖跨夜班、跨门店、跨周班表的冲突判断。
     */
    @Select("SELECT * FROM sch_schedule_item " +
            "WHERE tenant_id = #{tenantId} AND deleted = 0 " +
            "AND shift_start_at < #{rangeEnd} AND shift_end_at > #{rangeStart} " +
            "ORDER BY shift_start_at")
    List<ScheduleItem> selectOverlapped(@Param("tenantId") Long tenantId,
                                        @Param("rangeStart") LocalDateTime rangeStart,
                                        @Param("rangeEnd") LocalDateTime rangeEnd);

    /** 该班次是否已被排班引用（删除班次前的保护校验） */
    @Select("SELECT COUNT(1) FROM sch_schedule_item WHERE shift_id = #{shiftId} AND deleted = 0")
    int countByShiftId(@Param("shiftId") Long shiftId);
}
