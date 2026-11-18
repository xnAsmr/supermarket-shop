package com.supermarket.erp.module.system.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("sys_operation_log")
public class OperationLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long tenantId;

    private String module;

    private String operation;

    /** 动态操作描述（如：模拟登录用户「xxx」），由 @LogOperation#description SpEL 生成 */
    private String description;

    private String method;

    private String url;

    private String params;

    private String result;

    private Integer status;

    private String errorMsg;

    private String ip;

    private Long userId;

    private String username;

    private Long duration;

    private LocalDateTime createTime;
}
