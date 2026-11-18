package com.supermarket.erp.common.aspect;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.supermarket.erp.common.annotation.LogOperation;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.system.entity.OperationLog;
import com.supermarket.erp.module.system.mapper.OperationLogMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class OperationLogAspect {

    /** 敏感字段脱敏（JSON 序列化后的键值对） */
    private static final Pattern SENSITIVE_PATTERN = Pattern.compile(
            "(\"(?i)(password|oldPassword|newPassword|confirmPassword|token|accessToken)\"\\s*:\\s*\")([^\"]*)(\")");

    private static final ExpressionParser SPEL_PARSER = new SpelExpressionParser();

    private final OperationLogMapper operationLogMapper;
    private final ObjectMapper objectMapper;

    /** 日志异步写入线程池：核心 1 / 最大 2 / 队列 1000，满则丢弃，避免拖慢业务 */
    private final ExecutorService logExecutor = new ThreadPoolExecutor(
            1, 2, 60L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(1000),
            runnable -> {
                Thread thread = new Thread(runnable, "operation-log-writer");
                thread.setDaemon(true);
                return thread;
            },
            (r, e) -> log.warn("操作日志队列已满，丢弃一条日志记录"));

    @Around("@annotation(logOperation)")
    public Object around(ProceedingJoinPoint joinPoint, LogOperation logOperation) throws Throwable {
        long startTime = System.currentTimeMillis();
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        OperationLog record = new OperationLog();
        record.setModule(logOperation.module());
        record.setOperation(logOperation.operation());
        record.setMethod(joinPoint.getSignature().toShortString());

        HttpServletRequest request = null;
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                request = attrs.getRequest();
                record.setUrl(request.getRequestURI());
                record.setIp(getClientIp(request));
            }
        } catch (Exception e) {
            // ignore
        }

        try {
            record.setUserId(SecurityUtil.getUserId());
            record.setUsername(SecurityUtil.getUsername());
            record.setTenantId(SecurityUtil.getTenantId());
        } catch (Exception e) {
            // not authenticated, e.g. login request
        }

        try {
            Object[] args = joinPoint.getArgs();
            record.setParams(serializeArgs(args));
        } catch (Exception e) {
            record.setParams("[序列化失败]");
        }

        Object result = null;
        try {
            result = joinPoint.proceed();
            record.setStatus(1);
            try {
                record.setResult(objectMapper.writeValueAsString(result));
            } catch (Exception e) {
                // ignore
            }
            return result;
        } catch (Throwable t) {
            record.setStatus(0);
            record.setErrorMsg(t.getMessage());
            throw t;
        } finally {
            record.setDescription(resolveDescription(logOperation, joinPoint.getArgs(), signature, result));
            record.setDuration(System.currentTimeMillis() - startTime);
            record.setCreateTime(LocalDateTime.now());
            // 异步落库，日志写入不阻塞业务请求
            logExecutor.execute(() -> {
                try {
                    operationLogMapper.insert(record);
                } catch (Exception e) {
                    log.error("记录操作日志失败", e);
                }
            });
        }
    }

    /** 解析 @LogOperation#description SpEL（变量：方法参数名 + #result），失败返回 null */
    private String resolveDescription(LogOperation logOperation, Object[] args,
                                      MethodSignature signature, Object result) {
        String expression = logOperation.description();
        if (expression == null || expression.isBlank()) {
            return null;
        }
        try {
            StandardEvaluationContext context = new StandardEvaluationContext();
            String[] paramNames = signature.getParameterNames();
            if (paramNames != null) {
                for (int i = 0; i < paramNames.length; i++) {
                    context.setVariable(paramNames[i], args[i]);
                }
            }
            context.setVariable("result", result);
            Object value = SPEL_PARSER.parseExpression(expression).getValue(context);
            return value != null ? value.toString() : null;
        } catch (Exception e) {
            log.warn("解析操作日志 description SpEL 失败: {}", expression, e);
            return null;
        }
    }

    private String serializeArgs(Object[] args) {
        if (args == null || args.length == 0) {
            return null;
        }
        try {
            String json = objectMapper.writeValueAsString(Arrays.stream(args)
                    .filter(a -> !(a instanceof HttpServletRequest))
                    .filter(a -> {
                        if (a instanceof String s) {
                            return !s.startsWith("Bearer ");
                        }
                        return true;
                    })
                    .limit(3)
                    .toList());
            // 敏感字段脱敏
            return SENSITIVE_PATTERN.matcher(json).replaceAll("$1******$4");
        } catch (Exception e) {
            return null;
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("X-Real-IP");
        }
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }
}
