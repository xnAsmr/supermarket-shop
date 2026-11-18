package com.supermarket.erp.common.schedule;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.supermarket.erp.module.system.entity.LoginLog;
import com.supermarket.erp.module.system.entity.OperationLog;
import com.supermarket.erp.module.system.mapper.LoginLogMapper;
import com.supermarket.erp.module.system.mapper.OperationLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 日志保留清理：每天凌晨 3:30 删除超过保留天数的登录日志/操作日志。
 * 保留天数通过 erp.log.retain-days 配置，默认 180 天。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LogCleanTask {

    private final OperationLogMapper operationLogMapper;
    private final LoginLogMapper loginLogMapper;

    @Value("${erp.log.retain-days:180}")
    private int retainDays;

    @Scheduled(cron = "0 30 3 * * ?")
    public void cleanExpiredLogs() {
        try {
            LocalDateTime deadline = LocalDate.now().minusDays(retainDays).atStartOfDay();

            int opDeleted = operationLogMapper.delete(
                    new LambdaQueryWrapper<OperationLog>()
                            .lt(OperationLog::getCreateTime, deadline));
            int loginDeleted = loginLogMapper.delete(
                    new LambdaQueryWrapper<LoginLog>()
                            .lt(LoginLog::getLoginTime, deadline));

            if (opDeleted > 0 || loginDeleted > 0) {
                log.info("日志清理完成：操作日志删除 {} 条，登录日志删除 {} 条（保留 {} 天）",
                        opDeleted, loginDeleted, retainDays);
            }
        } catch (Exception e) {
            log.error("日志清理任务失败", e);
        }
    }
}
