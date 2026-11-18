package com.supermarket.erp.module.system.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sys_login_log")
public class LoginLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private Long userId;

    private String username;

    /** 登录类型：1-后台登录 2-POS登录 */
    private Integer loginType;

    private String loginIp;

    private String loginLocation;

    private String browser;

    private String os;

    /** 登录状态：0-失败 1-成功 */
    private Integer status;

    private String msg;

    private LocalDateTime loginTime;
}
