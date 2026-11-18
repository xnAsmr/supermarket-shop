package com.supermarket.erp.module.auth.controller;

import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.module.auth.mapper.DevLoginAccountMapper;
import com.supermarket.erp.module.auth.vo.DevLoginAccountVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 开发环境调试账号列表。
 *
 * <p>安全边界：整个 Controller 仅在 dev profile 下注册，生产/预发环境不会暴露此接口；
 * 且只返回用户名、姓名、租户名、门店名，不返回密码哈希等任何凭据。
 * 登录仍然走正常的 /api/v1/auth/login 校验流程，这里不做任何免密签发 token 的后门。
 */
@Tag(name = "开发环境调试")
@RestController
@RequestMapping("/api/v1/auth/dev")
@Profile("dev")
@RequiredArgsConstructor
public class DevLoginAccountController {

    private final DevLoginAccountMapper devLoginAccountMapper;

    @Operation(summary = "调试账号列表（仅 dev 生效，含归属租户/门店）")
    @GetMapping("/accounts")
    public Result<List<DevLoginAccountVO>> accounts() {
        return Result.success(devLoginAccountMapper.selectAccounts());
    }
}
