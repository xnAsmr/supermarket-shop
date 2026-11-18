package com.supermarket.erp.module.notify.dto;

import lombok.Data;

/**
 * 留言已读上报参数（POST body）
 *
 * 注意：前端 http 封装会把 POST/PUT 的 params 转成 JSON body，
 * 且项目内 POST/PUT 一律用 body 传参，故这里用 @RequestBody 收，不用 @RequestParam。
 */
@Data
public class MessageReadDTO {

    /** ANNOUNCEMENT=平台公告 NOTICE=租户通知 */
    private String targetType;

    private Long targetId;
}
