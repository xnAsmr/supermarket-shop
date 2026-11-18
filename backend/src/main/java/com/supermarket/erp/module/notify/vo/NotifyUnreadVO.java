package com.supermarket.erp.module.notify.vo;

import lombok.Data;

/**
 * 消息中心 - 未读数汇总（顶栏铃铛角标）
 */
@Data
public class NotifyUnreadVO {

    /** 未读系统公告数 */
    private Integer announcements;

    /** 未读租户通知数 */
    private Integer notices;

    /** 未读事件提醒数 */
    private Integer events;
}
