package com.supermarket.erp.module.system.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.result.Result;
import com.supermarket.erp.common.annotation.LogOperation;
import com.supermarket.erp.common.security.JwtTokenProvider;
import com.supermarket.erp.common.security.LoginUser;
import com.supermarket.erp.module.auth.dto.LoginVO;
import com.supermarket.erp.module.auth.entity.User;
import com.supermarket.erp.module.auth.mapper.UserMapper;
import com.supermarket.erp.module.system.entity.Role;
import com.supermarket.erp.module.system.entity.UserRole;
import com.supermarket.erp.module.system.mapper.RoleMapper;
import com.supermarket.erp.module.system.mapper.UserRoleMapper;
import com.supermarket.erp.module.tenant.entity.Tenant;
import com.supermarket.erp.module.tenant.mapper.TenantMapper;
import com.supermarket.erp.common.util.SecurityUtil;
import io.swagger.v3.oas.annotations.Operation;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/system/users")
@RequiredArgsConstructor
public class UserController {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final TenantMapper tenantMapper;
    private final JwtTokenProvider jwtTokenProvider;
    private final UserDetailsService userDetailsService;

    private static final Integer SYSTEM_ADMIN_TYPE = 3;

    /**
     * 分配角色前置校验（role_scope 语义）：
     *   1=租户私有：仅角色所属租户可分配；
     *   2=平台共享：所有租户均可分配给本租户用户（平台提供、租户使用）；
     *   3=平台内置：仅超级管理员可分配（如系统管理员，携带平台级权限，防提权）。
     */
    private void validateRoleAssignable(Long roleId) {
        if (roleId == null) {
            return;
        }
        Role role = roleMapper.selectById(roleId);
        if (role == null) {
            throw new BusinessException(404, "角色不存在");
        }
        Integer scope = role.getRoleScope() == null ? Role.SCOPE_TENANT : role.getRoleScope();
        boolean isSuper = SYSTEM_ADMIN_TYPE.equals(SecurityUtil.getUserType());
        // 平台内置角色仅超级管理员可分配
        if (scope >= Role.SCOPE_BUILTIN && !isSuper) {
            throw new BusinessException(403, "平台内置角色仅超级管理员可分配");
        }
        // 租户私有角色仅本租户可分配；平台共享角色所有租户均可分配
        if (!isSuper && scope < Role.SCOPE_PLATFORM
                && !Objects.equals(role.getTenantId(), SecurityUtil.getTenantId())) {
            throw new BusinessException(403, "无权分配其他租户的角色");
        }
    }

    /** 解析目标用户类型：非超管或非法值一律回落为普通用户(1) */
    private static Integer resolveUserType(boolean isSuper, Integer userType) {
        if (isSuper && userType != null && userType >= 1 && userType <= 3) {
            return userType;
        }
        return 1;
    }

    @GetMapping
    public Result<PageResult<Map<String, Object>>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer userType,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) Long tenantId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "20") Integer pageSize) {

        Long currentTenantId = SecurityUtil.getTenantId();
        Integer currentUserType = SecurityUtil.getLoginUser().getUserType();
        // 超级管理员(userType=3)或平台租户(id=1)可查看所有租户用户，其余租户仅看本租户
        boolean canViewAll = SYSTEM_ADMIN_TYPE.equals(currentUserType) || Long.valueOf(1L).equals(currentTenantId);

        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();

        if (canViewAll) {
            if (tenantId != null) {
                wrapper.eq(User::getTenantId, tenantId);
            }
        } else {
            wrapper.eq(User::getTenantId, currentTenantId);
        }

        if (StringUtils.hasText(keyword)) {
            wrapper.and(w -> w
                    .like(User::getUsername, keyword)
                    .or().like(User::getName, keyword)
                    .or().like(User::getPhone, keyword));
        }
        if (userType != null) {
            wrapper.eq(User::getUserType, userType);
        }
        if (status != null) {
            wrapper.eq(User::getStatus, status);
        }
        wrapper.orderByDesc(User::getCreateTime);

        Page<User> pageResult = userMapper.selectPage(new Page<>(page, pageSize), wrapper);

        List<Long> userIds = pageResult.getRecords().stream().map(User::getId).collect(Collectors.toList());
        Map<Long, Long> userRoleMap = new HashMap<>();
        Map<Long, String> roleNameMap = new HashMap<>();
        if (!userIds.isEmpty()) {
            LambdaQueryWrapper<UserRole> urWrapper = new LambdaQueryWrapper<>();
            urWrapper.in(UserRole::getUserId, userIds);
            List<UserRole> userRoles = userRoleMapper.selectList(urWrapper);
            Set<Long> roleIds = new HashSet<>();
            for (UserRole ur : userRoles) {
                userRoleMap.put(ur.getUserId(), ur.getRoleId());
                roleIds.add(ur.getRoleId());
            }
            if (!roleIds.isEmpty()) {
                List<Role> roles = roleMapper.selectBatchIds(roleIds);
                for (Role r : roles) {
                    roleNameMap.put(r.getId(), r.getRoleName());
                }
            }
        }

        List<Map<String, Object>> voList = pageResult.getRecords().stream().map(u -> {
            Map<String, Object> vo = new LinkedHashMap<>();
            vo.put("id", u.getId());
            vo.put("tenantId", u.getTenantId());
            vo.put("username", u.getUsername());
            vo.put("name", u.getName());
            vo.put("phone", u.getPhone());
            vo.put("email", u.getEmail());
            vo.put("storeId", u.getStoreId());
            vo.put("userType", u.getUserType());
            vo.put("status", u.getStatus());
            vo.put("lastLoginTime", u.getLastLoginTime());
            vo.put("lastLoginIp", u.getLastLoginIp());
            vo.put("loginCount", u.getLoginCount());
            vo.put("remark", u.getRemark());
            vo.put("createTime", u.getCreateTime());
            vo.put("updateTime", u.getUpdateTime());
            Long roleId = userRoleMap.get(u.getId());
            vo.put("roleId", roleId);
            vo.put("roleName", roleId != null ? roleNameMap.get(roleId) : null);
            return vo;
        }).collect(Collectors.toList());

        // 统一补充租户名称（跨租户与本租户视角都需要展示）
        if (!voList.isEmpty()) {
            Set<Long> tenantIds = voList.stream()
                    .map(m -> (Long) m.get("tenantId"))
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());
            if (!tenantIds.isEmpty()) {
                Map<Long, String> tenantNameMap = new HashMap<>();
                List<Tenant> tenants = tenantMapper.selectBatchIds(tenantIds);
                for (Tenant t : tenants) {
                    tenantNameMap.put(t.getId(), t.getTenantName());
                }
                for (Map<String, Object> vo : voList) {
                    Long tid = (Long) vo.get("tenantId");
                    vo.put("tenantName", tid != null ? tenantNameMap.get(tid) : null);
                }
            }
        }

        PageResult<Map<String, Object>> result = new PageResult<>();
        result.setList(voList);
        result.setTotal(pageResult.getTotal());
        result.setPage(page);
        result.setPageSize(pageSize);
        return Result.success(result);
    }

    @GetMapping("/{id}")
    public Result<Map<String, Object>> getById(@PathVariable Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            return Result.fail("用户不存在");
        }
        user.setPassword(null);

        Map<String, Object> vo = new LinkedHashMap<>();
        vo.put("id", user.getId());
        vo.put("tenantId", user.getTenantId());
        vo.put("username", user.getUsername());
        vo.put("name", user.getName());
        vo.put("phone", user.getPhone());
        vo.put("email", user.getEmail());
        vo.put("storeId", user.getStoreId());
        vo.put("userType", user.getUserType());
        vo.put("status", user.getStatus());
        vo.put("lastLoginTime", user.getLastLoginTime());
        vo.put("lastLoginIp", user.getLastLoginIp());
        vo.put("loginCount", user.getLoginCount());
        vo.put("remark", user.getRemark());
        vo.put("createTime", user.getCreateTime());
        vo.put("updateTime", user.getUpdateTime());

        List<UserRole> userRoles = userRoleMapper.selectByUserId(id);
        if (!userRoles.isEmpty()) {
            vo.put("roleId", userRoles.get(0).getRoleId());
            Role role = roleMapper.selectById(userRoles.get(0).getRoleId());
            vo.put("roleName", role != null ? role.getRoleName() : null);
        } else {
            vo.put("roleId", null);
            vo.put("roleName", null);
        }

        return Result.success(vo);
    }

    @PostMapping
    @LogOperation(module = "用户管理", operation = "新增用户")
    @PreAuthorize("@perm.check('sys:user:add')")
    public Result<Long> create(@RequestBody UserCreateDTO dto) {
        // 检查用户名唯一
        LambdaQueryWrapper<User> checkWrapper = new LambdaQueryWrapper<>();
        checkWrapper.eq(User::getUsername, dto.getUsername());
        if (userMapper.selectCount(checkWrapper) > 0) {
            return Result.fail("用户名已存在");
        }

        Long currentTenantId = SecurityUtil.getTenantId();

        User user = new User();
        user.setUsername(dto.getUsername());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setName(dto.getName());
        user.setPhone(dto.getPhone());
        user.setEmail(dto.getEmail());
        // 用户类型：仅超级管理员(userType=3)可指定（1-普通 2-系统管理员 3-超级管理员），其余一律创建为普通用户
        boolean isSuper = SYSTEM_ADMIN_TYPE.equals(SecurityUtil.getLoginUser().getUserType());
        user.setUserType(resolveUserType(isSuper, dto.getUserType()));
        user.setTenantId(dto.getTenantId() != null ? dto.getTenantId() : currentTenantId);
        user.setStoreId(dto.getStoreId());
        user.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        user.setCreateTime(LocalDateTime.now());
        user.setUpdateTime(LocalDateTime.now());
        userMapper.insert(user);

        if (dto.getRoleId() != null) {
            validateRoleAssignable(dto.getRoleId());
            UserRole userRole = new UserRole();
            userRole.setUserId(user.getId());
            userRole.setRoleId(dto.getRoleId());
            userRoleMapper.insert(userRole);
        }

        return Result.success(user.getId());
    }

    @PutMapping("/{id}")
    @LogOperation(module = "用户管理", operation = "修改用户")
    @PreAuthorize("@perm.check('sys:user:edit')")
    public Result<Void> update(@PathVariable Long id, @RequestBody UserUpdateDTO dto) {
        User user = userMapper.selectById(id);
        if (user == null) {
            return Result.fail("用户不存在");
        }

        if (StringUtils.hasText(dto.getName())) user.setName(dto.getName());
        if (dto.getPhone() != null) user.setPhone(dto.getPhone());
        if (dto.getEmail() != null) user.setEmail(dto.getEmail());
        // 用户类型仅超级管理员可修改，防止普通管理员通过接口提权
        if (dto.getUserType() != null) {
            boolean isSuper = SYSTEM_ADMIN_TYPE.equals(SecurityUtil.getLoginUser().getUserType());
            if (isSuper) {
                user.setUserType(resolveUserType(true, dto.getUserType()));
            }
        }
        if (dto.getTenantId() != null) user.setTenantId(dto.getTenantId());
        if (dto.getStoreId() != null) user.setStoreId(dto.getStoreId());
        if (dto.getStatus() != null) user.setStatus(dto.getStatus());
        user.setUpdateTime(LocalDateTime.now());
        userMapper.updateById(user);

        if (dto.getRoleId() != null) {
            validateRoleAssignable(dto.getRoleId());
            userRoleMapper.deleteByUserId(id);
            UserRole userRole = new UserRole();
            userRole.setUserId(id);
            userRole.setRoleId(dto.getRoleId());
            userRoleMapper.insert(userRole);
        }

        return Result.success();
    }

    @DeleteMapping("/{id}")
    @LogOperation(module = "用户管理", operation = "删除用户")
    @PreAuthorize("@perm.check('sys:user:delete')")
    public Result<Void> delete(@PathVariable Long id) {
        userMapper.deleteById(id);
        return Result.success();
    }

    @PutMapping("/{id}/reset-password")
    @LogOperation(module = "用户管理", operation = "重置密码")
    @PreAuthorize("@perm.check('sys:user:resetpwd')")
    public Result<Void> resetPassword(@PathVariable Long id) {
        User user = userMapper.selectById(id);
        if (user == null) {
            return Result.fail("用户不存在");
        }

        // 仅系统管理员可重置系统管理员账号密码
        LoginUser current = SecurityUtil.getLoginUser();
        if (SYSTEM_ADMIN_TYPE.equals(user.getUserType())
                && (current == null || !SYSTEM_ADMIN_TYPE.equals(current.getUserType()))) {
            return Result.fail(403, "无权限重置系统管理员密码");
        }
        // 非系统管理员仅能重置本租户用户密码
        if (current != null && !SYSTEM_ADMIN_TYPE.equals(current.getUserType())
                && !Objects.equals(current.getTenantId(), user.getTenantId())) {
            return Result.fail(403, "无权限重置其他租户用户的密码");
        }

        user.setPassword(passwordEncoder.encode("123456"));
        user.setUpdateTime(LocalDateTime.now());
        userMapper.updateById(user);
        return Result.success();
    }

    @Operation(summary = "模拟登录（切换为目标用户身份）")
    @GetMapping("/impersonate/{id}")
    @LogOperation(module = "用户管理", operation = "模拟登录",
            description = "#result?.code == 200 ? '模拟登录用户「' + #result.data.userInfo.username + '」(ID:' + #result.data.userInfo.id + ')' : '模拟登录失败'")
    @PreAuthorize("@perm.check('sys:user:impersonate')")
    public Result<LoginVO> impersonate(@PathVariable Long id) {
        // 仅系统管理员（userType=3）允许模拟登录任意用户；其他角色无此权限（@perm.check 已拦截）
        LoginUser current = SecurityUtil.getLoginUser();
        if (current == null || !SYSTEM_ADMIN_TYPE.equals(current.getUserType())) {
            return Result.fail(403, "无权限访问");
        }

        User user = userMapper.selectById(id);
        if (user == null) {
            return Result.fail("用户不存在");
        }
        if (user.getStatus() != null && user.getStatus() == 0) {
            return Result.fail("该用户已被停用，无法模拟登录");
        }

        // 按目标用户名加载其完整权限（userType=3 拥有全部权限，其余按角色权限）
        UserDetails userDetails = userDetailsService.loadUserByUsername(user.getUsername());
        LoginUser target = (LoginUser) userDetails;

        String token = jwtTokenProvider.generateToken(
                target.getId(),
                target.getUsername(),
                target.getTenantId(),
                target.getStoreId()
        );

        LoginVO vo = new LoginVO();
        vo.setToken(token);
        vo.setRefreshToken(token); // 简化处理，与普通登录保持一致
        vo.setExpiresIn(7200L);

        LoginVO.UserInfoVO userInfoVO = new LoginVO.UserInfoVO();
        userInfoVO.setId(target.getId());
        userInfoVO.setUsername(target.getUsername());
        userInfoVO.setRealName(target.getName());
        userInfoVO.setRole(SYSTEM_ADMIN_TYPE.equals(target.getUserType()) ? "system_admin" : "admin");
        userInfoVO.setAvatar(target.getAvatar());
        userInfoVO.setPhone(target.getPhone());
        userInfoVO.setEmail(target.getEmail());
        userInfoVO.setPermissions(target.getPermissions() != null
                ? new ArrayList<>(target.getPermissions())
                : List.of());
        vo.setUserInfo(userInfoVO);

        return Result.success(vo);
    }

    @GetMapping("/profile")
    public Result<Map<String, Object>> getProfile() {
        Long userId = SecurityUtil.getUserId();
        User user = userMapper.selectById(userId);
        if (user == null) {
            return Result.fail("用户不存在");
        }
        user.setPassword(null);

        Map<String, Object> vo = new LinkedHashMap<>();
        vo.put("id", user.getId());
        vo.put("username", user.getUsername());
        vo.put("name", user.getName());
        vo.put("phone", user.getPhone());
        vo.put("email", user.getEmail());
        vo.put("avatar", user.getAvatar());
        vo.put("userType", user.getUserType());
        vo.put("createTime", user.getCreateTime());

        List<UserRole> userRoles = userRoleMapper.selectByUserId(userId);
        if (!userRoles.isEmpty()) {
            Role role = roleMapper.selectById(userRoles.get(0).getRoleId());
            vo.put("roleName", role != null ? role.getRoleName() : null);
        } else {
            vo.put("roleName", null);
        }

        return Result.success(vo);
    }

    @PutMapping("/profile")
    public Result<Void> updateProfile(@RequestBody Map<String, String> params) {
        Long userId = SecurityUtil.getUserId();
        User user = userMapper.selectById(userId);
        if (user == null) {
            return Result.fail("用户不存在");
        }

        if (params.containsKey("name")) user.setName(params.get("name"));
        if (params.containsKey("phone")) user.setPhone(params.get("phone"));
        if (params.containsKey("email")) user.setEmail(params.get("email"));
        if (params.containsKey("avatar")) user.setAvatar(params.get("avatar"));
        user.setUpdateTime(LocalDateTime.now());
        userMapper.updateById(user);
        return Result.success();
    }

    @PutMapping("/profile/password")
    public Result<Void> updatePassword(@RequestBody Map<String, String> params) {
        Long userId = SecurityUtil.getUserId();
        User user = userMapper.selectById(userId);
        if (user == null) {
            return Result.fail("用户不存在");
        }

        String oldPassword = params.get("oldPassword");
        String newPassword = params.get("newPassword");
        if (!StringUtils.hasText(oldPassword) || !StringUtils.hasText(newPassword)) {
            return Result.fail("请输入旧密码和新密码");
        }
        if (!passwordEncoder.matches(oldPassword, user.getPassword())) {
            return Result.fail("旧密码不正确");
        }
        if (newPassword.length() < 6) {
            return Result.fail("新密码长度不能少于6位");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        user.setUpdateTime(LocalDateTime.now());
        userMapper.updateById(user);
        return Result.success();
    }

    @Data
    public static class UserCreateDTO {
        private String username;
        private String password;
        private String name;
        private String phone;
        private String email;
        private Integer userType;
        private Long tenantId;
        private Long storeId;
        private Long roleId;
        private Integer status;
    }

    @Data
    public static class UserUpdateDTO {
        private String name;
        private String phone;
        private String email;
        private Integer userType;
        private Long tenantId;
        private Long storeId;
        private Long roleId;
        private Integer status;
    }
}
