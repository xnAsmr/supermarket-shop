package com.supermarket.erp.module.schedule.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 整周排班覆盖保存入参。对应前端 Api.Schedule.WeekSavePayload。
 * items 允许为空数组（表示清空整周），服务层在一个事务内先删后插。
 */
@Data
public class WeekSaveDTO {

    @NotBlank(message = "门店不能为空")
    private String storeId;

    @NotBlank(message = "周起始日期不能为空")
    private String weekStart;

    @Valid
    @NotNull(message = "排班明细列表不能为空")
    private List<Item> items;

    @Data
    public static class Item {

        /** 前端本地生成的临时 id，后端落库时忽略 */
        private String id;

        private String scheduleId;

        @NotBlank(message = "排班日期不能为空")
        private String date;

        @NotBlank(message = "班次不能为空")
        private String shiftId;

        @NotBlank(message = "员工不能为空")
        private String userId;

        @Size(max = 50, message = "岗位快照不能超过 50 个字符")
        private String roleCode;

        /** manual / copy / change */
        private String source;
    }
}
