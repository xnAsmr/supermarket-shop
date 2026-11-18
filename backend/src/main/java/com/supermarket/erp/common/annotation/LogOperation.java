package com.supermarket.erp.common.annotation;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface LogOperation {

    String module() default "";

    String operation() default "";

    /**
     * 动态操作描述，支持 SpEL：可用方法参数名（如 #id、#username）与 #result（方法返回值）。
     * 例：模拟登录写 "#result.code == 200 ? '模拟登录用户「' + #result.data.userInfo.username + '」' : '模拟登录失败'"。
     * 为空或解析失败时不落库（前端回退展示 operation）。
     */
    String description() default "";
}
