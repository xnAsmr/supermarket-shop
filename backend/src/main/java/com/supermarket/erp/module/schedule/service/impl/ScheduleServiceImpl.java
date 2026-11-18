package com.supermarket.erp.module.schedule.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.supermarket.erp.common.exception.BusinessException;
import com.supermarket.erp.common.security.LoginUser;
import com.supermarket.erp.common.security.PermissionChecker;
import com.supermarket.erp.common.util.SecurityUtil;
import com.supermarket.erp.module.auth.entity.User;
import com.supermarket.erp.module.auth.mapper.UserMapper;
import com.supermarket.erp.module.schedule.dto.ChangeCreateDTO;
import com.supermarket.erp.module.schedule.dto.ChangeReviewDTO;
import com.supermarket.erp.module.schedule.dto.CopyPrevWeekDTO;
import com.supermarket.erp.module.schedule.dto.ScheduleItemDTO;
import com.supermarket.erp.module.schedule.dto.ShiftUpsertDTO;
import com.supermarket.erp.module.schedule.dto.WeekActionDTO;
import com.supermarket.erp.module.schedule.dto.WeekSaveDTO;
import com.supermarket.erp.module.schedule.entity.ScheduleItem;
import com.supermarket.erp.module.schedule.entity.Shift;
import com.supermarket.erp.module.schedule.entity.ShiftChange;
import com.supermarket.erp.module.schedule.entity.WeekSchedule;
import com.supermarket.erp.module.schedule.enums.ScheduleEnums.*;
import com.supermarket.erp.module.schedule.mapper.ScheduleDictMapper;
import com.supermarket.erp.module.schedule.mapper.ScheduleItemMapper;
import com.supermarket.erp.module.schedule.mapper.ShiftChangeMapper;
import com.supermarket.erp.module.schedule.mapper.ShiftMapper;
import com.supermarket.erp.module.schedule.mapper.WeekScheduleMapper;
import com.supermarket.erp.module.schedule.service.IScheduleService;
import com.supermarket.erp.module.schedule.vo.ScheduleVO;
import com.supermarket.erp.module.tenant.entity.Store;
import com.supermarket.erp.module.tenant.mapper.StoreMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 排班模块服务实现。
 *
 * <p>隔离口径：所有数据按 tenant_id + store_id 收敛；非超级管理员且已绑定门店时，
 * 只能读写本门店数据。所有 id 出参统一字符串化，与前端 Api.Schedule 契约一致。
 *
 * <p>冲突口径（两条同时生效）：
 * <ol>
 *   <li>一人一天一班：同一员工同一营业日不得出现多条明细（与前端 conflictUserKeys 一致）；</li>
 *   <li>时间段不重叠：按归一化后的 [shift_start_at, shift_end_at) 半开区间比较，
 *       覆盖跨夜班与次日班、跨门店/跨周班表的重叠。</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class ScheduleServiceImpl implements IScheduleService {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Pattern TIME_PATTERN = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");
    private static final String DEFAULT_COLOR = "#3D7FFF";

    private final ShiftMapper shiftMapper;
    private final WeekScheduleMapper weekMapper;
    private final ScheduleItemMapper itemMapper;
    private final ShiftChangeMapper changeMapper;
    private final ScheduleDictMapper dictMapper;
    private final UserMapper userMapper;
    private final StoreMapper storeMapper;
    private final PermissionChecker permissionChecker;

    /** 登录上下文快照 */
    private record Ctx(Long tenantId, Long userId, Long storeId, String name, Integer userType) {
        boolean superAdmin() {
            return userType != null && userType == 3;
        }
    }

    /** 归一化后的排班计划（尚未落库） */
    private record Plan(LocalDate date, Long shiftId, Long userId, String userName, String roleCode,
                        LocalDateTime start, LocalDateTime end, int source) {
    }

    private Ctx ctx() {
        LoginUser login = SecurityUtil.getLoginUser();
        Long tenantId = login.getTenantId();
        if (tenantId == null) {
            Store first = storeMapper.selectOne(new LambdaQueryWrapper<Store>()
                    .orderByAsc(Store::getId).last("LIMIT 1"));
            tenantId = first == null ? null : first.getTenantId();
        }
        if (tenantId == null) {
            throw new BusinessException("当前账号未绑定租户，无法使用排班功能");
        }
        String name = login.getName();
        if (name == null || name.isBlank()) {
            name = SecurityUtil.getUsername();
        }
        return new Ctx(tenantId, login.getId(), login.getStoreId(), name, login.getUserType());
    }

    /* ======================================================================
     * 基础数据
     * ====================================================================== */

    @Override
    public List<ScheduleVO.StoreOptionVO> listStores() {
        Ctx c = ctx();
        LambdaQueryWrapper<Store> w = new LambdaQueryWrapper<Store>()
                .eq(Store::getTenantId, c.tenantId());
        if (!c.superAdmin() && c.storeId() != null) {
            w.eq(Store::getId, c.storeId());
        }
        w.orderByAsc(Store::getId);
        return storeMapper.selectList(w).stream().map(this::toStoreVO).collect(Collectors.toList());
    }

    @Override
    public List<ScheduleVO.EmployeeOptionVO> listEmployees(String storeId) {
        Ctx c = ctx();
        Store store = requireStore(c, storeId);
        Long sid = store.getId();
        LambdaQueryWrapper<User> w = new LambdaQueryWrapper<User>()
                .eq(User::getTenantId, store.getTenantId())
                // 本门店员工 + 未分配门店的总部员工（可被排到任意门店，仍严格限制在本租户内）
                .and(x -> x.eq(User::getStoreId, sid).or().isNull(User::getStoreId))
                .orderByAsc(User::getId);
        return userMapper.selectList(w).stream()
                .filter(u -> u.getStatus() == null || u.getStatus() == 1)
                .map(u -> toEmployeeVO(u, sid))
                .collect(Collectors.toList());
    }

    @Override
    public ScheduleVO.EmployeeOptionVO currentEmployee() {
        Ctx c = ctx();
        User user = userMapper.selectById(c.userId());
        ScheduleVO.EmployeeOptionVO vo = new ScheduleVO.EmployeeOptionVO();
        vo.setId(str(c.userId()));
        vo.setName(user != null && user.getName() != null && !user.getName().isBlank()
                ? user.getName() : c.name());
        vo.setStoreId(c.storeId() == null ? "" : str(c.storeId()));
        vo.setRole(user == null ? "店员" : roleOf(user));
        return vo;
    }

    @Override
    public List<ScheduleVO.ShiftVO> listShifts(String storeId) {
        Ctx c = ctx();
        LambdaQueryWrapper<Shift> w = new LambdaQueryWrapper<Shift>()
                .eq(Shift::getTenantId, c.tenantId());
        if (storeId != null && !storeId.isBlank()) {
            Store store = requireStore(c, storeId);
            Long sid = store.getId();
            w.and(x -> x.isNull(Shift::getStoreId).or().eq(Shift::getStoreId, sid));
        }
        w.orderByAsc(Shift::getSort).orderByAsc(Shift::getId);
        return shiftMapper.selectList(w).stream().map(this::toShiftVO).collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScheduleVO.ShiftVO upsertShift(ShiftUpsertDTO dto) {
        Ctx c = ctx();
        String name = trimToNull(dto.getName());
        if (name == null) {
            throw new BusinessException("班次名称不能为空");
        }
        String start = trimToNull(dto.getStart());
        String end = trimToNull(dto.getEnd());
        if (start != null && !TIME_PATTERN.matcher(start).matches()) {
            throw new BusinessException("开始时间格式应为 HH:mm（如 08:00）");
        }
        if (end != null && !TIME_PATTERN.matcher(end).matches()) {
            throw new BusinessException("结束时间格式应为 HH:mm（如 16:00）");
        }

        Long storeId = null;
        Long tenantId = c.tenantId();
        if (dto.getStoreId() != null && !dto.getStoreId().isBlank()) {
            Store store = requireStore(c, dto.getStoreId());
            storeId = store.getId();
            tenantId = store.getTenantId();
        }

        Shift entity;
        if (dto.getId() != null && !dto.getId().isBlank()) {
            Long id = parseId(dto.getId(), "班次ID");
            entity = shiftMapper.selectOne(new LambdaQueryWrapper<Shift>()
                    .eq(Shift::getId, id).eq(Shift::getTenantId, tenantId));
            if (entity == null) {
                throw new BusinessException("班次不存在或已被删除：" + dto.getId());
            }
        } else {
            if (start == null || end == null) {
                throw new BusinessException("新增班次必须填写开始时间与结束时间");
            }
            entity = new Shift();
            entity.setTenantId(tenantId);
            entity.setStoreId(storeId);
            entity.setCreateBy(c.userId());
            entity.setDeleted(0);
            entity.setEnabled(dto.getEnabled() == null ? 1 : (dto.getEnabled() ? 1 : 0));
            entity.setSort(dto.getSort() == null ? nextSort(tenantId) : dto.getSort());
            entity.setColor(dto.getColor() == null || dto.getColor().isBlank() ? DEFAULT_COLOR : dto.getColor());
            entity.setMinStaff(dto.getMinStaff() == null ? 1 : dto.getMinStaff());
            entity.setRoleName(dto.getRole() == null ? "店员" : dto.getRole());
            entity.setRestMinutes(dto.getRest() == null ? 0 : dto.getRest());
        }

        entity.setShiftName(name);
        entity.setUpdateBy(c.userId());
        if (trimToNull(dto.getStoreId()) != null) {
            entity.setStoreId(storeId);
        }
        if (dto.getCode() != null) {
            entity.setShiftCode(trimToNull(dto.getCode()));
        }
        if (entity.getShiftCode() == null || entity.getShiftCode().isBlank()) {
            entity.setShiftCode("SHIFT_" + System.currentTimeMillis());
        }
        if (start != null) {
            entity.setStartTime(start);
        }
        if (end != null) {
            entity.setEndTime(end);
        }
        if (entity.getStartTime() == null || entity.getEndTime() == null) {
            throw new BusinessException("班次开始时间与结束时间不能为空");
        }
        entity.setCrossDay(entity.getEndTime().compareTo(entity.getStartTime()) <= 0 ? 1 : 0);
        if (dto.getColor() != null && !dto.getColor().isBlank()) {
            entity.setColor(dto.getColor());
        }
        if (dto.getMinStaff() != null) {
            entity.setMinStaff(dto.getMinStaff());
        }
        if (dto.getRole() != null) {
            entity.setRoleName(dto.getRole());
        }
        if (dto.getRest() != null) {
            entity.setRestMinutes(dto.getRest());
        }
        if (dto.getSort() != null) {
            entity.setSort(dto.getSort());
        }
        if (dto.getEnabled() != null) {
            entity.setEnabled(dto.getEnabled() ? 1 : 0);
        }
        if (dto.getRemark() != null) {
            entity.setRemark(dto.getRemark());
        }

        assertShiftCodeUnique(tenantId, entity.getShiftCode(), entity.getId());
        if (entity.getId() == null) {
            shiftMapper.insert(entity);
        } else {
            shiftMapper.updateById(entity);
        }
        return toShiftVO(entity);
    }

    @Override
    public void toggleShift(String id) {
        Ctx c = ctx();
        Shift shift = requireShift(c.tenantId(), id);
        shift.setEnabled(Integer.valueOf(1).equals(shift.getEnabled()) ? 0 : 1);
        shift.setUpdateBy(c.userId());
        shiftMapper.updateById(shift);
    }

    @Override
    public void deleteShift(String id) {
        Ctx c = ctx();
        Shift shift = requireShift(c.tenantId(), id);
        if (itemMapper.countByShiftId(shift.getId()) > 0) {
            throw new BusinessException("班次「" + shift.getShiftName() + "」已被排班明细引用，不能删除；如不再使用请选择停用");
        }
        shift.setUpdateBy(c.userId());
        shiftMapper.deleteById(shift.getId());
    }

    /* ======================================================================
     * 周班表
     * ====================================================================== */

    @Override
    public ScheduleVO.WeekScheduleVO getWeek(String storeId, String weekStart) {
        Ctx c = ctx();
        Store store = requireStore(c, storeId);
        LocalDate monday = mondayOf(parseDate(weekStart, "周起始日期"));
        WeekSchedule ws = findOrCreateWeek(store.getTenantId(), store.getId(), monday, c.userId());
        return toWeekVO(ws, itemsOfWeek(ws.getId()));
    }

    @Override
    public ScheduleVO.ValidationVO validateWeek(String storeId, String weekStart) {
        Ctx c = ctx();
        Store store = requireStore(c, storeId);
        LocalDate monday = mondayOf(parseDate(weekStart, "周起始日期"));
        WeekSchedule ws = findWeek(store.getTenantId(), store.getId(), monday);
        List<ScheduleItem> items = ws == null ? List.of() : itemsOfWeek(ws.getId());
        List<Plan> plans = plansFromEntities(items);

        List<String> conflicts = collectConflicts(plans);
        List<String> shortages = collectShortages(plans, store.getTenantId());

        ScheduleVO.ValidationVO vo = new ScheduleVO.ValidationVO();
        vo.setPassable(conflicts.isEmpty());
        vo.setConflicts(conflicts);
        vo.setShortages(shortages);
        return vo;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void saveWeek(WeekSaveDTO dto) {
        Ctx c = ctx();
        Store store = requireStore(c, dto.getStoreId());
        Long tenantId = store.getTenantId();
        LocalDate monday = mondayOf(parseDate(dto.getWeekStart(), "周起始日期"));
        WeekSchedule ws = findOrCreateWeek(tenantId, store.getId(), monday, c.userId());
        assertDraft(ws);

        List<Plan> plans = buildPlans(tenantId, monday, dto.getItems());
        assertNoConflicts(plans);
        replaceItems(ws, plans, c.userId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScheduleVO.ScheduleItemVO addItem(ScheduleItemDTO dto) {
        Ctx c = ctx();
        Store store = requireStore(c, dto.getStoreId());
        Long tenantId = store.getTenantId();
        LocalDate date = parseDate(dto.getDate(), "排班日期");
        LocalDate monday = mondayOf(date);
        WeekSchedule ws = findOrCreateWeek(tenantId, store.getId(), monday, c.userId());
        assertDraft(ws);

        Plan added = buildSinglePlan(tenantId, date, dto.getShiftId(), dto.getUserId(),
                dto.getRoleCode(), ItemSource.MANUAL.getCode());
        List<Plan> all = new ArrayList<>(plansFromEntities(itemsOfWeek(ws.getId())));
        all.add(added);
        assertNoConflicts(all);

        ScheduleItem entity = toEntity(ws, added, c.userId());
        itemMapper.insert(entity);
        return toItemVO(entity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteItem(String id) {
        Ctx c = ctx();
        Long itemId = parseId(id, "排班明细ID");
        ScheduleItem item = itemMapper.selectOne(new LambdaQueryWrapper<ScheduleItem>()
                .eq(ScheduleItem::getId, itemId).eq(ScheduleItem::getTenantId, c.tenantId()));
        if (item == null) {
            throw new BusinessException("排班明细不存在：" + id);
        }
        WeekSchedule ws = weekMapper.selectById(item.getScheduleId());
        if (ws == null) {
            throw new BusinessException("排班明细所属的班表不存在");
        }
        assertStoreScope(c, ws);
        assertDraft(ws);
        itemMapper.hardDeleteById(itemId, c.tenantId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScheduleVO.WeekScheduleVO copyPrevWeek(CopyPrevWeekDTO dto) {
        Ctx c = ctx();
        Store store = requireStore(c, dto.getStoreId());
        Long tenantId = store.getTenantId();
        LocalDate monday = mondayOf(parseDate(dto.getWeekStart(), "周起始日期"));
        WeekSchedule current = findOrCreateWeek(tenantId, store.getId(), monday, c.userId());
        assertDraft(current);

        WeekSchedule previous = findWeek(tenantId, store.getId(), monday.minusDays(7));
        List<ScheduleItem> source = previous == null ? List.of() : itemsOfWeek(previous.getId());
        if (source.isEmpty()) {
            throw new BusinessException("上周暂无排班数据可复制，请先为上周排班");
        }

        List<WeekSaveDTO.Item> copies = new ArrayList<>();
        for (ScheduleItem item : source) {
            LocalDate shifted = item.getWorkDate().plusDays(7);
            if (!monday.equals(mondayOf(shifted))) {
                continue;
            }
            WeekSaveDTO.Item copy = new WeekSaveDTO.Item();
            copy.setDate(shifted.toString());
            copy.setShiftId(str(item.getShiftId()));
            copy.setUserId(str(item.getUserId()));
            copy.setRoleCode(item.getRoleCode());
            copy.setSource(ItemSource.COPY.getValue());
            copies.add(copy);
        }
        List<Plan> plans = buildPlans(tenantId, monday, copies);
        assertNoConflicts(plans);
        replaceItems(current, plans, c.userId());
        return toWeekVO(current, itemsOfWeek(current.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void publishWeek(WeekActionDTO dto) {
        Ctx c = ctx();
        WeekSchedule ws = requireWeek(dto.getId(), c);
        if (!Integer.valueOf(WeekStatus.DRAFT.getCode()).equals(ws.getStatus())) {
            throw new BusinessException("只有草稿状态的班表可以发布，当前状态："
                    + WeekStatus.of(ws.getStatus()).getValue());
        }
        List<ScheduleItem> items = itemsOfWeek(ws.getId());
        if (items.isEmpty()) {
            throw new BusinessException("本周暂无排班明细，无法发布空班表");
        }
        assertNoConflicts(plansFromEntities(items));

        ws.setStatus(WeekStatus.PUBLISHED.getCode());
        ws.setPublishTime(LocalDateTime.now());
        ws.setPublisherId(c.userId());
        ws.setUpdateBy(c.userId());
        weekMapper.updateById(ws);
        // TODO(NOTIFY): 发布成功后通过 INotifyEventService 给当周当班员工推送「班表已发布」事件提醒。
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void revokeWeek(WeekActionDTO dto) {
        Ctx c = ctx();
        WeekSchedule ws = requireWeek(dto.getId(), c);
        if (!Integer.valueOf(WeekStatus.PUBLISHED.getCode()).equals(ws.getStatus())) {
            throw new BusinessException("只有已发布的班表可以撤回");
        }
        ws.setStatus(WeekStatus.DRAFT.getCode());
        ws.setPublishTime(null);
        ws.setUpdateBy(c.userId());
        weekMapper.updateById(ws);
    }

    /* ======================================================================
     * 调班审批
     * ====================================================================== */

    @Override
    public List<ScheduleVO.ChangeVO> listChanges() {
        Ctx c = ctx();
        LambdaQueryWrapper<ShiftChange> w = new LambdaQueryWrapper<ShiftChange>()
                .eq(ShiftChange::getTenantId, c.tenantId());
        if (!c.superAdmin() && c.storeId() != null) {
            w.eq(ShiftChange::getStoreId, c.storeId());
        }
        // 数据权限：无审批权限（sch:change:review）的普通员工只能看到与自己相关的申请
        // ——自己发起的，或需要自己接班的；拥有审批权限的店长/管理员看本店全部。
        // 判定走权限码而非 userType 硬编码，权限分配变化时数据范围自动跟随。
        if (!permissionChecker.check("sch:change:review")) {
            Long me = c.userId();
            w.and(x -> x.eq(ShiftChange::getApplicantId, me)
                    .or()
                    .eq(ShiftChange::getTargetUserId, me));
        }
        w.orderByAsc(ShiftChange::getStatus).orderByDesc(ShiftChange::getCreateTime);
        return changeMapper.selectList(w).stream().map(this::toChangeVO).collect(Collectors.toList());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScheduleVO.ChangeVO createChange(ChangeCreateDTO dto) {
        Ctx c = ctx();
        Store store = requireStore(c, dto.getStoreId());
        Long tenantId = store.getTenantId();
        LocalDate date = parseDate(dto.getDate(), "调班日期");
        Shift shift = requireShift(tenantId, dto.getShiftId());
        User target = requireUser(tenantId, dto.getTargetUserId());
        if (target.getId().equals(c.userId())) {
            throw new BusinessException("不能与自己调班");
        }
        if (!ChangeType.isValid(dto.getChangeType())) {
            throw new BusinessException("调班类型只能是 1换班 / 2替班 / 3请假");
        }

        ShiftChange entity = new ShiftChange();
        entity.setTenantId(tenantId);
        entity.setStoreId(store.getId());
        entity.setApplicantId(c.userId());
        entity.setApplicantName(c.name());
        entity.setTargetUserId(target.getId());
        entity.setTargetUserName(target.getName());
        entity.setWorkDate(date);
        entity.setShiftId(shift.getId());
        entity.setChangeType(dto.getChangeType());
        entity.setReason(dto.getReason().trim());
        entity.setStatus(ChangeStatus.PENDING.getCode());
        entity.setCreateBy(c.userId());
        entity.setUpdateBy(c.userId());
        entity.setDeleted(0);
        changeMapper.insert(entity);
        return toChangeVO(entity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ScheduleVO.ChangeVO reviewChange(String id, ChangeReviewDTO dto) {
        Ctx c = ctx();
        Long changeId = parseId(id, "调班申请ID");
        ShiftChange change = changeMapper.selectOne(new LambdaQueryWrapper<ShiftChange>()
                .eq(ShiftChange::getId, changeId).eq(ShiftChange::getTenantId, c.tenantId()));
        if (change == null) {
            throw new BusinessException("调班申请不存在：" + id);
        }
        assertStoreScope(c, change.getTenantId(), change.getStoreId());
        if (!Integer.valueOf(ChangeStatus.PENDING.getCode()).equals(change.getStatus())) {
            throw new BusinessException("该申请已处理，不能重复审批");
        }

        boolean approved = Integer.valueOf(ChangeStatus.APPROVED.getCode()).equals(dto.getStatus());
        change.setStatus(dto.getStatus());
        change.setReviewerId(c.userId());
        change.setReviewerName(c.name());
        change.setReviewTime(LocalDateTime.now());
        change.setUpdateBy(c.userId());
        changeMapper.updateById(change);

        if (approved) {
            applyApprovedChange(change, c);
        }
        // TODO(NOTIFY): 审批完成后推送申请人/接班人的调班结果通知。
        return toChangeVO(change);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void cancelChange(String id) {
        Ctx c = ctx();
        Long changeId = parseId(id, "调班申请ID");
        ShiftChange change = changeMapper.selectOne(new LambdaQueryWrapper<ShiftChange>()
                .eq(ShiftChange::getId, changeId).eq(ShiftChange::getTenantId, c.tenantId()));
        if (change == null) {
            throw new BusinessException("调班申请不存在：" + id);
        }
        if (!Integer.valueOf(ChangeStatus.PENDING.getCode()).equals(change.getStatus())) {
            throw new BusinessException("只有待审批的申请可以撤销");
        }
        change.setUpdateBy(c.userId());
        changeMapper.deleteById(changeId);
    }

    /* ======================================================================
     * 我的排班
     * ====================================================================== */

    @Override
    public List<ScheduleVO.ScheduleItemVO> listMySchedule(String weekStart) {
        Ctx c = ctx();
        LocalDate monday = mondayOf(parseDate(weekStart, "周起始日期"));
        LambdaQueryWrapper<ScheduleItem> w = new LambdaQueryWrapper<ScheduleItem>()
                .eq(ScheduleItem::getTenantId, c.tenantId())
                .eq(ScheduleItem::getUserId, c.userId())
                .between(ScheduleItem::getWorkDate, monday, monday.plusDays(6))
                .orderByAsc(ScheduleItem::getWorkDate)
                .orderByAsc(ScheduleItem::getShiftStartAt);
        return itemMapper.selectList(w).stream().map(this::toItemVO).collect(Collectors.toList());
    }

    /* ======================================================================
     * 私有：校验与领域计算
     * ====================================================================== */

    private Store requireStore(Ctx c, String storeId) {
        Long sid = parseId(storeId, "门店ID");
        if (!c.superAdmin() && c.storeId() != null && !c.storeId().equals(sid)) {
            throw new BusinessException(403, "无权访问其他门店的排班数据");
        }
        LambdaQueryWrapper<Store> w = new LambdaQueryWrapper<Store>().eq(Store::getId, sid);
        if (!c.superAdmin()) {
            w.eq(Store::getTenantId, c.tenantId());
        }
        Store store = storeMapper.selectOne(w);
        if (store == null) {
            throw new BusinessException("门店不存在或不属于当前租户：" + storeId);
        }
        return store;
    }

    private void assertStoreScope(Ctx c, WeekSchedule ws) {
        assertStoreScope(c, ws.getTenantId(), ws.getStoreId());
    }

    private void assertStoreScope(Ctx c, Long tenantId, Long storeId) {
        if (c.superAdmin()) {
            return;
        }
        if (!c.tenantId().equals(tenantId)) {
            throw new BusinessException(403, "无权访问其他租户的排班数据");
        }
        if (c.storeId() != null && !c.storeId().equals(storeId)) {
            throw new BusinessException(403, "无权访问其他门店的排班数据");
        }
    }

    private Shift requireShift(Long tenantId, String shiftId) {
        Long id = parseId(shiftId, "班次ID");
        Shift shift = shiftMapper.selectOne(new LambdaQueryWrapper<Shift>()
                .eq(Shift::getId, id).eq(Shift::getTenantId, tenantId));
        if (shift == null) {
            throw new BusinessException("班次不存在或已被删除：" + shiftId);
        }
        if (shift.getStartTime() == null || !TIME_PATTERN.matcher(shift.getStartTime()).matches()
                || shift.getEndTime() == null || !TIME_PATTERN.matcher(shift.getEndTime()).matches()) {
            throw new BusinessException("班次「" + shift.getShiftName() + "」的起止时间配置非法，请先编辑班次");
        }
        return shift;
    }

    private User requireUser(Long tenantId, String userId) {
        Long id = parseId(userId, "员工ID");
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>()
                .eq(User::getId, id).eq(User::getTenantId, tenantId));
        if (user == null) {
            throw new BusinessException("员工不存在或不属于当前租户：" + userId);
        }
        if (user.getStatus() != null && user.getStatus() != 1) {
            throw new BusinessException("员工「" + user.getName() + "」已停用，不能参与排班");
        }
        return user;
    }

    private WeekSchedule requireWeek(String id, Ctx c) {
        Long wid = parseId(id, "班表ID");
        WeekSchedule ws = weekMapper.selectById(wid);
        if (ws == null) {
            throw new BusinessException("班表不存在：" + id);
        }
        assertStoreScope(c, ws);
        return ws;
    }

    private void assertDraft(WeekSchedule ws) {
        if (!Integer.valueOf(WeekStatus.DRAFT.getCode()).equals(ws.getStatus())) {
            throw new BusinessException("已发布或已归档的班表不可直接修改，请先撤回发布，或走调班审批");
        }
    }

    private WeekSchedule findWeek(Long tenantId, Long storeId, LocalDate monday) {
        return weekMapper.selectOne(new LambdaQueryWrapper<WeekSchedule>()
                .eq(WeekSchedule::getTenantId, tenantId)
                .eq(WeekSchedule::getStoreId, storeId)
                .eq(WeekSchedule::getWeekStartDate, monday)
                .last("LIMIT 1"));
    }

    private WeekSchedule findOrCreateWeek(Long tenantId, Long storeId, LocalDate monday, Long userId) {
        WeekSchedule existing = findWeek(tenantId, storeId, monday);
        if (existing != null) {
            return existing;
        }
        WeekSchedule created = new WeekSchedule();
        created.setTenantId(tenantId);
        created.setStoreId(storeId);
        created.setWeekStartDate(monday);
        created.setStatus(monday.isBefore(mondayOf(LocalDate.now()))
                ? WeekStatus.ARCHIVED.getCode() : WeekStatus.DRAFT.getCode());
        created.setCreateBy(userId);
        created.setUpdateBy(userId);
        created.setDeleted(0);
        try {
            weekMapper.insert(created);
        } catch (DuplicateKeyException e) {
            WeekSchedule again = findWeek(tenantId, storeId, monday);
            if (again == null) {
                throw new BusinessException("班表初始化失败，请重试");
            }
            return again;
        }
        return created;
    }

    private List<ScheduleItem> itemsOfWeek(Long scheduleId) {
        return itemMapper.selectList(new LambdaQueryWrapper<ScheduleItem>()
                .eq(ScheduleItem::getScheduleId, scheduleId)
                .orderByAsc(ScheduleItem::getWorkDate)
                .orderByAsc(ScheduleItem::getShiftStartAt)
                .orderByAsc(ScheduleItem::getId));
    }

    private List<Plan> buildPlans(Long tenantId, LocalDate monday, List<WeekSaveDTO.Item> items) {
        if (items == null) {
            throw new BusinessException("排班明细列表不能为空");
        }
        LocalDate sunday = monday.plusDays(6);
        Set<String> seen = new LinkedHashSet<>();
        List<Plan> plans = new ArrayList<>();
        for (WeekSaveDTO.Item item : items) {
            LocalDate date = parseDate(item.getDate(), "排班日期");
            if (date.isBefore(monday) || date.isAfter(sunday)) {
                throw new BusinessException("排班日期 " + date + " 不在本周（" + monday + " ~ " + sunday + "）范围内");
            }
            String key = date + "|" + item.getShiftId() + "|" + item.getUserId();
            if (!seen.add(key)) {
                continue;
            }
            plans.add(buildSinglePlan(tenantId, date, item.getShiftId(), item.getUserId(),
                    item.getRoleCode(), ItemSource.fromValue(item.getSource())));
        }
        return plans;
    }

    private Plan buildSinglePlan(Long tenantId, LocalDate date, String shiftId, String userId,
                                 String roleCode, int source) {
        Shift shift = requireShift(tenantId, shiftId);
        User user = requireUser(tenantId, userId);
        LocalDateTime[] range = rangeOf(date, shift);
        String role = roleCode == null || roleCode.isBlank() ? roleOf(user) : roleCode;
        return new Plan(date, shift.getId(), user.getId(), user.getName(), role,
                range[0], range[1], source);
    }

    /**
     * 把「营业日 + HH:mm + 跨夜标记」归一化为真实时刻区间 [start, end)。
     * 跨夜班（含 end &lt;= start 的容错判断）结束时刻 +1 天。
     */
    private LocalDateTime[] rangeOf(LocalDate workDate, Shift shift) {
        try {
            LocalTime startTime = LocalTime.parse(shift.getStartTime());
            LocalTime endTime = LocalTime.parse(shift.getEndTime());
            LocalDateTime start = LocalDateTime.of(workDate, startTime);
            boolean crossDay = Integer.valueOf(1).equals(shift.getCrossDay()) || !endTime.isAfter(startTime);
            LocalDate endDate = crossDay ? workDate.plusDays(1) : workDate;
            LocalDateTime end = LocalDateTime.of(endDate, endTime);
            if (!end.isAfter(start)) {
                end = start.plusHours(1);
            }
            return new LocalDateTime[]{start, end};
        } catch (DateTimeParseException e) {
            throw new BusinessException("班次「" + shift.getShiftName() + "」时间格式非法，应为 HH:mm");
        }
    }

    private List<Plan> plansFromEntities(List<ScheduleItem> items) {
        List<Plan> plans = new ArrayList<>();
        for (ScheduleItem item : items) {
            LocalDateTime start = item.getShiftStartAt();
            LocalDateTime end = item.getShiftEndAt();
            if (start == null || end == null) {
                continue;
            }
            plans.add(new Plan(item.getWorkDate(), item.getShiftId(), item.getUserId(),
                    item.getUserName(), item.getRoleCode(), start, end,
                    item.getSource() == null ? 0 : item.getSource()));
        }
        return plans;
    }

    /**
     * 冲突检测：规则 A 一人一天一班 + 规则 B 归一化时间段重叠。
     * 返回去重后的可读描述列表，供保存/发布阻断与校验报告共用。
     */
    private List<String> collectConflicts(List<Plan> plans) {
        Set<String> messages = new LinkedHashSet<>();

        Map<String, List<Plan>> byDayUser = plans.stream().collect(Collectors.groupingBy(
                p -> p.date() + "|" + p.userId(), LinkedHashMap::new, Collectors.toList()));
        for (Map.Entry<String, List<Plan>> entry : byDayUser.entrySet()) {
            List<Plan> group = entry.getValue();
            if (group.size() > 1) {
                Plan first = group.get(0);
                messages.add(displayName(first) + " " + first.date().toString().substring(5)
                        + " 同日被安排 " + group.size() + " 个班次（一人一天一班）");
            }
        }

        Map<Long, List<Plan>> byUser = plans.stream().collect(Collectors.groupingBy(
                Plan::userId, LinkedHashMap::new, Collectors.toList()));
        for (List<Plan> group : byUser.values()) {
            List<Plan> sorted = group.stream().sorted(Comparator.comparing(Plan::start))
                    .collect(Collectors.toList());
            for (int i = 1; i < sorted.size(); i++) {
                Plan prev = sorted.get(i - 1);
                Plan cur = sorted.get(i);
                if (!prev.end().isAfter(cur.start())) {
                    continue;
                }
                if (prev.date().equals(cur.date())) {
                    continue; // 同日组合已由规则 A 描述，避免重复报错
                }
                messages.add(displayName(cur) + " " + cur.date().toString().substring(5)
                        + " " + cur.start().toLocalTime() + " 与上一班次时间段重叠");
            }
        }
        return new ArrayList<>(messages);
    }

    private void assertNoConflicts(List<Plan> plans) {
        List<String> conflicts = collectConflicts(plans);
        if (conflicts.isEmpty()) {
            return;
        }
        String head = String.join("；", conflicts.subList(0, Math.min(3, conflicts.size())));
        String tail = conflicts.size() > 3 ? "，另有 " + (conflicts.size() - 3) + " 处冲突" : "";
        throw new BusinessException("排班冲突：" + head + tail + "，请调整后再保存或发布");
    }

    /**
     * 最低在岗人数报告：只检查「已安排了该班次」的格子，完全未排人的格子视为该日未开放该班次。
     * 这是提示项而非发布阻断项，避免未开放的班次格导致班表永远无法发布。
     */
    private List<String> collectShortages(List<Plan> plans, Long tenantId) {
        Map<Long, Shift> shiftMap = shiftMapper.selectList(new LambdaQueryWrapper<Shift>()
                        .eq(Shift::getTenantId, tenantId)).stream()
                .collect(Collectors.toMap(Shift::getId, s -> s, (a, b) -> a, HashMap::new));
        Map<String, Long> counts = plans.stream().collect(Collectors.groupingBy(
                p -> p.date() + "|" + p.shiftId(), LinkedHashMap::new, Collectors.counting()));

        List<String> result = new ArrayList<>();
        for (Map.Entry<String, Long> entry : counts.entrySet()) {
            String[] parts = entry.getKey().split("\\|");
            Shift shift = shiftMap.get(Long.valueOf(parts[1]));
            if (shift == null || shift.getMinStaff() == null || shift.getMinStaff() <= 0) {
                continue;
            }
            long count = entry.getValue();
            if (count < shift.getMinStaff()) {
                result.add(parts[0].substring(5) + " " + shift.getShiftName()
                        + " 缺 " + (shift.getMinStaff() - count) + " 人（最低 " + shift.getMinStaff() + " 人）");
            }
        }
        result.sort(String::compareTo);
        return result;
    }

    private void replaceItems(WeekSchedule ws, List<Plan> plans, Long userId) {
        itemMapper.hardDeleteByScheduleId(ws.getId());
        for (Plan plan : plans) {
            itemMapper.insert(toEntity(ws, plan, userId));
        }
    }

    private ScheduleItem toEntity(WeekSchedule ws, Plan plan, Long userId) {
        ScheduleItem entity = new ScheduleItem();
        entity.setTenantId(ws.getTenantId());
        entity.setScheduleId(ws.getId());
        entity.setStoreId(ws.getStoreId());
        entity.setShiftId(plan.shiftId());
        entity.setWorkDate(plan.date());
        entity.setUserId(plan.userId());
        entity.setUserName(plan.userName() == null ? "" : plan.userName());
        entity.setRoleCode(plan.roleCode() == null ? "" : plan.roleCode());
        entity.setShiftStartAt(plan.start());
        entity.setShiftEndAt(plan.end());
        entity.setStatus(ItemStatus.NORMAL.getCode());
        entity.setSource(plan.source());
        entity.setCreateBy(userId);
        entity.setUpdateBy(userId);
        entity.setDeleted(0);
        return entity;
    }

    /** 审批通过：移除申请人该格原排班，加入接班人（source=change），并做时间段冲突保护 */
    private void applyApprovedChange(ShiftChange change, Ctx c) {
        LocalDate monday = mondayOf(change.getWorkDate());
        WeekSchedule ws = findOrCreateWeek(change.getTenantId(), change.getStoreId(), monday, c.userId());
        if (Integer.valueOf(WeekStatus.ARCHIVED.getCode()).equals(ws.getStatus())) {
            throw new BusinessException("已归档的班表不可再调班");
        }
        Shift shift = requireShift(change.getTenantId(), str(change.getShiftId()));
        User target = requireUser(change.getTenantId(), str(change.getTargetUserId()));
        LocalDateTime[] range = rangeOf(change.getWorkDate(), shift);

        itemMapper.hardDeleteByCell(ws.getId(), change.getWorkDate(), shift.getId(), change.getApplicantId());

        Long exists = itemMapper.selectCount(new LambdaQueryWrapper<ScheduleItem>()
                .eq(ScheduleItem::getScheduleId, ws.getId())
                .eq(ScheduleItem::getWorkDate, change.getWorkDate())
                .eq(ScheduleItem::getShiftId, shift.getId())
                .eq(ScheduleItem::getUserId, target.getId()));
        if (exists != null && exists > 0) {
            return;
        }

        List<ScheduleItem> overlapped = itemMapper.selectOverlapped(
                change.getTenantId(), range[0], range[1]);
        boolean conflict = overlapped.stream()
                .anyMatch(item -> target.getId().equals(item.getUserId()));
        if (conflict) {
            throw new BusinessException("接班人「" + target.getName() + "」在该时段已有班次，无法通过调班审批");
        }

        Plan plan = new Plan(change.getWorkDate(), shift.getId(), target.getId(), target.getName(),
                roleOf(target), range[0], range[1], ItemSource.CHANGE.getCode());
        itemMapper.insert(toEntity(ws, plan, c.userId()));
    }

    private void assertShiftCodeUnique(Long tenantId, String code, Long excludeId) {
        LambdaQueryWrapper<Shift> w = new LambdaQueryWrapper<Shift>()
                .eq(Shift::getTenantId, tenantId)
                .eq(Shift::getShiftCode, code);
        if (excludeId != null) {
            w.ne(Shift::getId, excludeId);
        }
        if (shiftMapper.selectCount(w) > 0) {
            throw new BusinessException("班次编码「" + code + "」已存在，请更换");
        }
    }

    private int nextSort(Long tenantId) {
        Long count = shiftMapper.selectCount(new LambdaQueryWrapper<Shift>()
                .eq(Shift::getTenantId, tenantId));
        return (count == null ? 0 : count.intValue()) + 1;
    }

    /* ======================================================================
     * 私有：通用工具与 VO 转换
     * ====================================================================== */

    private String roleOf(User user) {
        String role = dictMapper.selectRoleName(user.getId());
        if (role != null && !role.isBlank()) {
            return role;
        }
        Integer type = user.getUserType();
        if (type != null && type == 3) {
            return "超级管理员";
        }
        if (type != null && type == 2) {
            return "系统管理员";
        }
        return "店员";
    }

    private String displayName(Plan plan) {
        return plan.userName() == null || plan.userName().isBlank()
                ? "员工" + plan.userId() : plan.userName();
    }

    private String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String fmt(LocalDateTime time) {
        return time == null ? null : time.format(DATE_TIME);
    }

    private String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private Long parseId(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(label + "不能为空");
        }
        try {
            return Long.parseLong(value.trim());
        } catch (NumberFormatException e) {
            throw new BusinessException(label + "格式错误：" + value);
        }
    }

    private LocalDate parseDate(String value, String label) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(label + "不能为空");
        }
        try {
            return LocalDate.parse(value.trim(), DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException e) {
            throw new BusinessException(label + "格式应为 yyyy-MM-dd：" + value);
        }
    }

    private LocalDate mondayOf(LocalDate date) {
        return date.minusDays(date.getDayOfWeek().getValue() - 1);
    }

    private ScheduleVO.StoreOptionVO toStoreVO(Store store) {
        ScheduleVO.StoreOptionVO vo = new ScheduleVO.StoreOptionVO();
        vo.setId(str(store.getId()));
        vo.setName(store.getStoreName());
        vo.setBusinessHours(store.getBusinessHours() == null ? "" : store.getBusinessHours());
        return vo;
    }

    private ScheduleVO.EmployeeOptionVO toEmployeeVO(User user, Long storeId) {
        ScheduleVO.EmployeeOptionVO vo = new ScheduleVO.EmployeeOptionVO();
        vo.setId(str(user.getId()));
        vo.setName(user.getName() == null ? user.getUsername() : user.getName());
        vo.setRole(roleOf(user));
        vo.setStoreId(str(storeId));
        return vo;
    }

    private ScheduleVO.ShiftVO toShiftVO(Shift s) {
        ScheduleVO.ShiftVO vo = new ScheduleVO.ShiftVO();
        vo.setId(str(s.getId()));
        vo.setStoreId(str(s.getStoreId()));
        vo.setName(s.getShiftName());
        vo.setCode(s.getShiftCode());
        vo.setStart(s.getStartTime());
        vo.setEnd(s.getEndTime());
        vo.setCrossDay(Integer.valueOf(1).equals(s.getCrossDay()));
        vo.setColor(s.getColor() == null ? DEFAULT_COLOR : s.getColor());
        vo.setMinStaff(s.getMinStaff() == null ? 0 : s.getMinStaff());
        vo.setRole(s.getRoleName() == null ? "" : s.getRoleName());
        vo.setRest(s.getRestMinutes() == null ? 0 : s.getRestMinutes());
        vo.setSort(s.getSort() == null ? 0 : s.getSort());
        vo.setEnabled(!Integer.valueOf(0).equals(s.getEnabled()));
        vo.setRemark(s.getRemark());
        return vo;
    }

    private ScheduleVO.ScheduleItemVO toItemVO(ScheduleItem item) {
        ScheduleVO.ScheduleItemVO vo = new ScheduleVO.ScheduleItemVO();
        vo.setId(str(item.getId()));
        vo.setScheduleId(str(item.getScheduleId()));
        vo.setDate(item.getWorkDate() == null ? null : item.getWorkDate().toString());
        vo.setShiftId(str(item.getShiftId()));
        vo.setUserId(str(item.getUserId()));
        vo.setRoleCode(item.getRoleCode() == null ? "" : item.getRoleCode());
        vo.setSource(ItemSource.of(item.getSource()).getValue());
        return vo;
    }

    private ScheduleVO.WeekScheduleVO toWeekVO(WeekSchedule ws, List<ScheduleItem> items) {
        ScheduleVO.WeekScheduleVO vo = new ScheduleVO.WeekScheduleVO();
        vo.setId(str(ws.getId()));
        vo.setStoreId(str(ws.getStoreId()));
        vo.setWeekStart(ws.getWeekStartDate() == null ? null : ws.getWeekStartDate().toString());
        vo.setStatus(WeekStatus.of(ws.getStatus()).getValue());
        vo.setPublishTime(fmt(ws.getPublishTime()));
        User publisher = ws.getPublisherId() == null ? null : userMapper.selectById(ws.getPublisherId());
        vo.setPublisherName(publisher == null ? "" : publisher.getName());
        vo.setItems(items.stream().map(this::toItemVO).collect(Collectors.toList()));
        return vo;
    }

    private ScheduleVO.ChangeVO toChangeVO(ShiftChange e) {
        ScheduleVO.ChangeVO vo = new ScheduleVO.ChangeVO();
        vo.setId(str(e.getId()));
        vo.setStoreId(str(e.getStoreId()));
        vo.setApplicantId(str(e.getApplicantId()));
        vo.setApplicantName(e.getApplicantName() == null ? "" : e.getApplicantName());
        vo.setTargetUserId(str(e.getTargetUserId()));
        vo.setTargetUserName(e.getTargetUserName() == null ? "" : e.getTargetUserName());
        vo.setDate(e.getWorkDate() == null ? null : e.getWorkDate().toString());
        vo.setShiftId(str(e.getShiftId()));
        vo.setChangeType(e.getChangeType());
        vo.setReason(e.getReason() == null ? "" : e.getReason());
        vo.setStatus(e.getStatus());
        vo.setReviewerName(e.getReviewerName());
        vo.setReviewTime(fmt(e.getReviewTime()));
        vo.setCreateTime(fmt(e.getCreateTime()));
        return vo;
    }
}
