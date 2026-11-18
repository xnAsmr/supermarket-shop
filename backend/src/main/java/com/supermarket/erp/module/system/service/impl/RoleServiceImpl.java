package com.supermarket.erp.module.system.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.result.PageResult;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.system.dto.RoleCreateDTO;
import com.supermarket.erp.module.system.entity.Menu;
import com.supermarket.erp.module.system.entity.Role;
import com.supermarket.erp.module.system.entity.RoleMenu;
import com.supermarket.erp.module.system.mapper.MenuMapper;
import com.supermarket.erp.module.system.mapper.RoleMapper;
import com.supermarket.erp.module.system.mapper.RoleMenuMapper;
import com.supermarket.erp.module.system.service.IRoleService;
import com.supermarket.erp.module.system.vo.RoleVO;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class RoleServiceImpl implements IRoleService {

    private final RoleMapper roleMapper;
    private final RoleMenuMapper roleMenuMapper;
    private final MenuMapper menuMapper;

    @Override
    public PageResult<RoleVO> pageList(Long tenantId, Integer page, Integer pageSize) {
        boolean isSuper = isSuperAdmin();
        LambdaQueryWrapper<Role> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Role::getDeleted, 0);
        if (tenantId != null) {
            // 可见范围：本租户角色 + 平台共享角色（平台共享 = 所有租户均可用）
            wrapper.and(w -> w
                    .eq(Role::getTenantId, tenantId)
                    .or()
                    .eq(Role::getRoleScope, Role.SCOPE_PLATFORM));
            // 平台内置角色（如系统管理员 sysAdmin）仅超级管理员可见
            if (!isSuper) {
                wrapper.and(w -> w
                        .ne(Role::getRoleScope, Role.SCOPE_BUILTIN)
                        .or()
                        .isNull(Role::getRoleScope));
            }
        }
        wrapper.orderByDesc(Role::getCreateTime);

        Page<Role> pageParam = new Page<>(page, pageSize);
        Page<Role> result = roleMapper.selectPage(pageParam, wrapper);

        List<Long> roleIds = result.getRecords().stream()
                .map(Role::getId)
                .collect(Collectors.toList());

        // 批量查询本页所有角色的菜单 id（避免列表接口 menuIds 为空导致前端无法回显权限）
        Map<Long, List<Long>> roleMenuIdsMap = roleIds.isEmpty()
                ? Collections.emptyMap()
                : roleMenuMapper.selectList(
                                new LambdaQueryWrapper<RoleMenu>()
                                        .in(RoleMenu::getRoleId, roleIds))
                        .stream()
                        .collect(Collectors.groupingBy(
                                RoleMenu::getRoleId,
                                Collectors.mapping(RoleMenu::getMenuId, Collectors.toList())));

        List<RoleVO> voList = result.getRecords().stream()
                .map(role -> {
                    RoleVO vo = toVO(role);
                    vo.setMenuIds(roleMenuIdsMap.getOrDefault(role.getId(), List.of()));
                    return vo;
                })
                .collect(Collectors.toList());

        return new PageResult<>(voList, result.getTotal(), (int) result.getCurrent(), (int) result.getSize());
    }

    @Override
    public RoleVO getById(Long id) {
        Role role = roleMapper.selectById(id);
        if (role == null) {
            throw new BusinessException(404, "角色不存在");
        }
        // 范围校验：平台内置角色仅超级管理员可查看；
        // 非超户只能查看本租户私有角色或平台共享角色（共享角色所有租户均可用）
        if (!isSuperAdmin()) {
            Integer scope = role.getRoleScope() == null ? Role.SCOPE_TENANT : role.getRoleScope();
            if (scope >= Role.SCOPE_BUILTIN) {
                throw new BusinessException(403, "平台内置角色仅超级管理员可查看");
            }
            if (scope < Role.SCOPE_PLATFORM && !Objects.equals(role.getTenantId(), SecurityUtil.getTenantId())) {
                throw new BusinessException(403, "无权查看其他租户的角色");
            }
        }
        RoleVO vo = toVO(role);
        List<RoleMenu> roleMenus = roleMenuMapper.selectByRoleId(id);
        vo.setMenuIds(roleMenus.stream().map(RoleMenu::getMenuId).collect(Collectors.toList()));
        return vo;
    }

    @Override
    @Transactional
    public Long create(RoleCreateDTO dto, Long tenantId) {
        LambdaQueryWrapper<Role> checkWrapper = new LambdaQueryWrapper<>();
        checkWrapper.eq(Role::getDeleted, 0)
                   .eq(Role::getTenantId, tenantId)
                   .eq(Role::getRoleCode, dto.getRoleCode());
        if (roleMapper.selectCount(checkWrapper) > 0) {
            throw new BusinessException(400, "该租户下角色编码已存在");
        }

        Role role = new Role();
        BeanUtils.copyProperties(dto, role);
        role.setTenantId(tenantId);
        role.setStatus(dto.getStatus() != null ? dto.getStatus() : 1);
        // 角色范围：仅超级管理员可创建平台共享/平台内置角色，其余一律租户私有
        role.setRoleScope(resolveRoleScope(dto.getRoleScope()));
        roleMapper.insert(role);

        if (dto.getMenuIds() != null && !dto.getMenuIds().isEmpty()) {
            for (Long menuId : withAncestorDirectories(dto.getMenuIds())) {
                RoleMenu roleMenu = new RoleMenu();
                roleMenu.setRoleId(role.getId());
                roleMenu.setMenuId(menuId);
                roleMenuMapper.insert(roleMenu);
            }
        }

        return role.getId();
    }

    @Override
    @Transactional
    public void update(Long id, RoleCreateDTO dto, Long tenantId) {
        Role role = roleMapper.selectById(id);
        if (role == null) {
            throw new BusinessException(404, "角色不存在");
        }

        LambdaQueryWrapper<Role> checkWrapper = new LambdaQueryWrapper<>();
        checkWrapper.eq(Role::getDeleted, 0)
                   .eq(Role::getTenantId, tenantId)
                   .eq(Role::getRoleCode, dto.getRoleCode())
                   .ne(Role::getId, id);
        if (roleMapper.selectCount(checkWrapper) > 0) {
            throw new BusinessException(400, "该租户下角色编码已存在");
        }

        // 平台共享/平台内置角色仅超级管理员可维护；非超管也不能把角色升级为共享/内置
        boolean isSuper = isSuperAdmin();
        Integer existingScope = role.getRoleScope() == null ? Role.SCOPE_TENANT : role.getRoleScope();
        if (!isSuper && existingScope >= Role.SCOPE_PLATFORM) {
            throw new BusinessException(403, "平台角色仅超级管理员可修改");
        }
        if (!isSuper && dto.getRoleScope() != null && dto.getRoleScope() >= Role.SCOPE_PLATFORM) {
            throw new BusinessException(403, "仅超级管理员可设置平台共享角色");
        }
        // 非超管只能修改本租户角色（防跨租户越权）
        if (!isSuper && !Objects.equals(role.getTenantId(), tenantId)) {
            throw new BusinessException(403, "无权修改其他租户的角色");
        }

        BeanUtils.copyProperties(dto, role);
        // copyProperties 可能把 null 拷进来，显式回填范围：超管可按传入修改（限 1/2/3），其余保持原值
        Integer targetScope = existingScope;
        if (isSuper && dto.getRoleScope() != null
                && dto.getRoleScope() >= Role.SCOPE_TENANT && dto.getRoleScope() <= Role.SCOPE_BUILTIN) {
            targetScope = dto.getRoleScope();
        }
        role.setRoleScope(targetScope);
        roleMapper.updateById(role);

        roleMenuMapper.deleteByRoleId(id);

        if (dto.getMenuIds() != null && !dto.getMenuIds().isEmpty()) {
            for (Long menuId : withAncestorDirectories(dto.getMenuIds())) {
                RoleMenu roleMenu = new RoleMenu();
                roleMenu.setRoleId(id);
                roleMenu.setMenuId(menuId);
                roleMenuMapper.insert(roleMenu);
            }
        }
    }

    @Override
    public void delete(Long id, Long tenantId) {
        Role role = roleMapper.selectById(id);
        if (role == null) {
            throw new BusinessException(404, "角色不存在");
        }
        boolean isSuper = isSuperAdmin();
        Integer scope = role.getRoleScope() == null ? Role.SCOPE_TENANT : role.getRoleScope();
        // 平台共享/平台内置角色仅超级管理员可删除
        if (!isSuper && scope >= Role.SCOPE_PLATFORM) {
            throw new BusinessException(403, "平台角色仅超级管理员可删除");
        }
        // 非超管只能删除本租户角色（防跨租户越权）
        if (!isSuper && !Objects.equals(role.getTenantId(), tenantId)) {
            throw new BusinessException(403, "无权删除其他租户的角色");
        }
        roleMapper.deleteById(id);
    }

    /**
     * 角色菜单持久化前补齐祖先目录
     *
     * 授权树里父目录（menu_type=0）只是分组，客户端（如角色授权弹窗）可能只提交
     * 叶子/页面节点。若直接落库，下次登录时 MenuServiceImpl.getUserMenuTree 会因
     * 「父目录不在授权集」把子菜单提升为一级菜单，侧边栏结构扁平化。
     * 这里沿 parent_id 向上遍历，把所有祖先目录一并纳入授权，保证树结构完整。
     */
    private List<Long> withAncestorDirectories(List<Long> menuIds) {
        if (menuIds == null || menuIds.isEmpty()) {
            return Collections.emptyList();
        }
        Set<Long> result = new LinkedHashSet<>(menuIds);
        for (Long menuId : menuIds) {
            Long current = menuId;
            //  parent_id 链理论上有界，限制步数防脏数据成环
            for (int depth = 0; current != null && depth < 32; depth++) {
                Menu menu = menuMapper.selectById(current);
                if (menu == null) {
                    break;
                }
                Long parentId = menu.getParentId();
                if (parentId == null || parentId == 0) {
                    break;
                }
                result.add(parentId);
                current = parentId;
            }
        }
        return new ArrayList<>(result);
    }

    private RoleVO toVO(Role role) {
        RoleVO vo = new RoleVO();
        BeanUtils.copyProperties(role, vo);
        if (vo.getRoleScope() == null) {
            vo.setRoleScope(Role.SCOPE_TENANT);
        }
        return vo;
    }

    /** 当前登录者是否为超级管理员（user_type=3） */
    private boolean isSuperAdmin() {
        return Integer.valueOf(3).equals(SecurityUtil.getUserType());
    }

    /**
     * 角色范围收敛：非超管一律租户私有；
     * 超管可按传入设置 1=租户私有 / 2=平台共享 / 3=平台内置，非法值回落租户私有
     */
    private Integer resolveRoleScope(Integer requested) {
        if (!isSuperAdmin()) {
            return Role.SCOPE_TENANT;
        }
        if (Integer.valueOf(Role.SCOPE_TENANT).equals(requested)
                || Integer.valueOf(Role.SCOPE_PLATFORM).equals(requested)
                || Integer.valueOf(Role.SCOPE_BUILTIN).equals(requested)) {
            return requested;
        }
        return Role.SCOPE_TENANT;
    }
}
