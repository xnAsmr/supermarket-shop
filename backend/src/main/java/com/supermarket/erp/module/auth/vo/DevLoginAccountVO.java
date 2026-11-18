package com.supermarket.erp.module.auth.vo;

import lombok.Data;

/**
 * 开发环境调试账号项：供登录页下拉展示，便于快速切换不同租户/门店/角色的账号。
 *
 * <p>刻意不包含密码、手机号等敏感字段；生产环境由 @Profile("dev") 保证此接口不存在。
 */
@Data
public class DevLoginAccountVO {

    private String username;

    private String realName;

    private String tenantId;

    private String tenantName;

    private String storeId;

    private String storeName;

    /** 1普通员工 2系统管理员 3超级管理员 */
    private Integer userType;
}
