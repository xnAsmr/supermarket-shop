package com.supermarket.erp.module.notify.dto;

import lombok.Data;

/**
 * 通知/公告分页查询 DTO
 */
@Data
public class NotifyPageDTO {

    private Integer page = 1;

    private Integer pageSize = 10;

    /** 关键字（标题模糊） */
    private String keyword;

    /** 状态过滤（平台公告：0草稿 1已发布 2已撤回） */
    private Integer status;
}
