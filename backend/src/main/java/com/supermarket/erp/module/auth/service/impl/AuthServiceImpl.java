package com.supermarket.erp.module.auth.service.impl;

import com.supermarket.erp.common.enums.ResultCodeEnum;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.security.JwtTokenProvider;
import com.supermarket.erp.common.security.LoginUser;
import com.supermarket.erp.module.auth.dto.LoginDTO;
import com.supermarket.erp.module.auth.dto.LoginVO;
import com.supermarket.erp.module.auth.entity.User;
import com.supermarket.erp.module.auth.mapper.UserMapper;
import com.supermarket.erp.module.auth.service.IAuthService;
import com.supermarket.erp.module.system.entity.LoginLog;
import com.supermarket.erp.module.system.mapper.LoginLogMapper;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements IAuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final LoginLogMapper loginLogMapper;

    @Override
    public LoginVO login(LoginDTO dto) {
        LoginUser loginUser;
        try {
            // 验证用户名密码
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(dto.getUsername(), dto.getPassword())
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
            loginUser = (LoginUser) authentication.getPrincipal();
        } catch (AuthenticationException e) {
            // 登录失败同样记录日志（用户名/密码错误、账号禁用等）
            recordLoginLog(dto.getUsername(), null, null, 0, e.getMessage());
            throw e;
        }

        // 生成 Token
        String token = jwtTokenProvider.generateToken(
                loginUser.getId(),
                loginUser.getUsername(),
                loginUser.getTenantId(),
                loginUser.getStoreId()
        );

        // 更新登录信息
        User user = new User();
        user.setId(loginUser.getId());
        user.setLastLoginTime(LocalDateTime.now());
        user.setLoginCount(loginUser.getLoginCount() == null ? 1 : loginUser.getLoginCount() + 1);
        user.setUpdateTime(LocalDateTime.now());
        user.setUpdateBy(loginUser.getId());
        userMapper.updateById(user);

        // 构建返回结果
        LoginVO vo = new LoginVO();
        vo.setToken(token);
        vo.setRefreshToken(token); // 简化处理，实际应生成不同的 refreshToken
        vo.setExpiresIn(7200L);

        LoginVO.UserInfoVO userInfoVO = new LoginVO.UserInfoVO();
        userInfoVO.setId(loginUser.getId());
        userInfoVO.setUsername(loginUser.getUsername());
        userInfoVO.setRealName(loginUser.getName());
        userInfoVO.setRole(loginUser.getUserType() == 3 ? "system_admin" : "admin");
        userInfoVO.setAvatar(loginUser.getAvatar());
        userInfoVO.setPhone(loginUser.getPhone());
        userInfoVO.setEmail(loginUser.getEmail());
        userInfoVO.setPermissions(loginUser.getPermissions() != null
                ? new ArrayList<>(loginUser.getPermissions())
                : List.of());
        vo.setUserInfo(userInfoVO);

        recordLoginLog(loginUser.getUsername(), loginUser.getId(), loginUser.getTenantId(),
                1, "登录成功");

        return vo;
    }

    @Override
    @Transactional
    public void logout(String token) {
        // JWT 无状态，服务端无需额外处理
        // 如果使用 Redis 存储 token，此处应删除
    }

    /** 记录登录日志（失败也不影响主流程） */
    private void recordLoginLog(String username, Long userId, Long tenantId,
                                Integer status, String msg) {
        try {
            LoginLog loginLog = new LoginLog();
            loginLog.setTenantId(tenantId != null ? tenantId : 0L);
            loginLog.setUserId(userId);
            loginLog.setUsername(username != null ? username : "");
            loginLog.setLoginType(1);
            loginLog.setStatus(status);
            loginLog.setMsg(truncate(msg, 200));
            loginLog.setLoginTime(LocalDateTime.now());

            HttpServletRequest request = currentRequest();
            if (request != null) {
                loginLog.setLoginIp(getClientIp(request));
                String ua = request.getHeader("User-Agent");
                loginLog.setBrowser(parseBrowser(ua));
                loginLog.setOs(parseOs(ua));
            }
            loginLogMapper.insert(loginLog);
        } catch (Exception e) {
            log.error("记录登录日志失败", e);
        }
    }

    private HttpServletRequest currentRequest() {
        try {
            ServletRequestAttributes attrs =
                    (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            return attrs != null ? attrs.getRequest() : null;
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

    private String parseBrowser(String ua) {
        if (ua == null || ua.isBlank()) {
            return "未知";
        }
        if (ua.contains("Edg/")) {
            return "Edge";
        }
        if (ua.contains("OPR/") || ua.contains("Opera")) {
            return "Opera";
        }
        if (ua.contains("Firefox/")) {
            return "Firefox";
        }
        if (ua.contains("Chrome/")) {
            return "Chrome";
        }
        if (ua.contains("Safari/")) {
            return "Safari";
        }
        return "其他";
    }

    private String parseOs(String ua) {
        if (ua == null || ua.isBlank()) {
            return "未知";
        }
        if (ua.contains("Windows")) {
            return "Windows";
        }
        if (ua.contains("Android")) {
            return "Android";
        }
        if (ua.contains("iPhone") || ua.contains("iPad") || ua.contains("iOS")) {
            return "iOS";
        }
        if (ua.contains("Mac OS X") || ua.contains("Macintosh")) {
            return "macOS";
        }
        if (ua.contains("Linux")) {
            return "Linux";
        }
        return "其他";
    }

    private String truncate(String text, int maxLength) {
        if (text == null) {
            return null;
        }
        return text.length() > maxLength ? text.substring(0, maxLength) : text;
    }
}
