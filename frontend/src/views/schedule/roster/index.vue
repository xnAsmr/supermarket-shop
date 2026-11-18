<!-- 排班表（周视图）：编排 / 冲突校验 / 发布 -->
<template>
  <div class="roster-page art-full-height">
    <DemoBanner />

    <ElCard class="toolbar" shadow="never">
      <div class="toolbar__top">
        <div class="toolbar__title">
          <h2>排班表</h2>
          <ElTag :type="statusTagType" effect="plain" size="small">{{ statusText }}</ElTag>
          <span v-if="week?.publishTime" class="toolbar__publish-time">
            发布于 {{ week.publishTime }} · 发布人 {{ week.publisherName || '—' }}
          </span>
        </div>
        <ElSpace wrap>
          <ElButton :disabled="readonly || saving" @click="copyPrev">复制上周</ElButton>
          <ElButton :disabled="readonly" :loading="saving" @click="save()">保存</ElButton>
          <ElButton
            v-if="week?.status === 'draft'"
            type="primary"
            :disabled="!!conflicts.length || saving"
            @click="publish"
          >
            发布班表
          </ElButton>
          <ElButton v-else-if="week?.status === 'published'" @click="revoke">撤回发布</ElButton>
          <ElButton @click="openOperationLog">操作日志</ElButton>
        </ElSpace>
      </div>

      <div class="toolbar__filters">
        <ElSelect v-model="storeId" style="width: 200px" :disabled="loading">
          <ElOption v-for="s in stores" :key="s.id" :label="s.name" :value="s.id" />
        </ElSelect>
        <div class="week-switch">
          <ElButton size="small" @click="shiftWeek(-1)">‹</ElButton>
          <span class="week-switch__label">{{ weekLabel }}</span>
          <ElButton size="small" @click="shiftWeek(1)">›</ElButton>
          <ElButton v-if="weekOffset !== 0" size="small" text type="primary" @click="backToCurrent">
            回到本周
          </ElButton>
        </div>
        <div class="legend">
          <span v-for="s in shifts" :key="s.id" class="legend__item">
            <i :style="{ background: s.color }" />{{ s.name }} {{ s.start }}–{{ s.end }}
          </span>
        </div>
      </div>
    </ElCard>

    <ElCard v-loading="loading" class="main-card" shadow="never">
      <div v-if="week?.status === 'draft'" class="notice notice--warning">
        <ArtSvgIcon icon="ri:information-line" />
        当前为草稿，员工端暂不可见；确认无冲突后点击「发布班表」。
      </div>
      <div v-if="week?.status === 'archived'" class="notice notice--info">
        <ArtSvgIcon icon="ri:lock-line" />
        历史周班表已归档，仅供查看，不可修改。
      </div>
      <div v-if="conflicts.length" class="notice notice--danger">
        <ArtSvgIcon icon="ri:error-warning-line" />
        检测到 {{ conflicts.length }} 处排班冲突：{{ conflicts[0] }}
        <span v-if="conflicts.length > 1"> 等</span>，请调整后再发布。
      </div>

      <!-- 桌面：周网格 -->
      <div class="roster-scroll">
        <div class="roster-grid">
          <div class="roster-row roster-row--head">
            <div class="cell cell--head cell--sticky">班次 / 日期</div>
            <div
              v-for="d in days"
              :key="d.date"
              class="cell cell--head"
              :class="{ 'is-today': d.isToday, 'is-weekend': d.weekend }"
            >
              <b>{{ d.label }}</b>
              <span>{{ d.md }}</span>
              <em v-if="d.isToday">今天</em>
            </div>
          </div>

          <div v-for="s in shifts" :key="s.id" class="roster-row">
            <div class="cell cell--shift cell--sticky" :style="{ borderLeftColor: s.color }">
              <b>{{ s.name }}</b>
              <span>
                {{ s.start }}–{{ s.end }}
                <i v-if="s.crossDay">次日</i>
              </span>
              <small>至少 {{ s.minStaff }} 人 · {{ s.role }}</small>
            </div>
            <div
              v-for="d in days"
              :key="d.date"
              class="cell cell--day"
              :class="{
                'is-weekend': d.weekend,
                'is-conflict': isConflictCell(d.date, s.id),
                'is-shortage': shortageOf(items, d.date, s) > 0
              }"
              :style="{ '--shift-color': s.color }"
            >
              <div
                v-for="item in cellItems(items, d.date, s.id)"
                :key="item.id"
                class="chip"
                :class="{ 'chip--conflict': conflictKeys.has(`${d.date}_${item.userId}`) }"
              >
                <span class="chip__avatar" :style="{ background: avatarColor(item.userId) }">
                  {{ empName(item.userId).charAt(0) }}
                </span>
                <span class="chip__name">{{ empName(item.userId) }}</span>
                <span v-if="!readonly" class="chip__x" @click="removePerson(item)">×</span>
              </div>

              <button v-if="!readonly" class="add-btn" @click="openPicker(d.date, s)">+ 添加</button>
              <span v-if="shortageOf(items, d.date, s) > 0" class="shortage">
                缺 {{ shortageOf(items, d.date, s) }} 人
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 移动端：按天卡片流 -->
      <div class="mobile-view">
        <div v-for="d in days" :key="d.date" class="day-card">
          <div class="day-card__head">
            <b>{{ d.label }} {{ d.md }}</b>
            <em v-if="d.isToday">今天</em>
          </div>
          <div
            v-for="s in shifts"
            :key="s.id"
            class="day-card__row"
            :style="{ borderLeftColor: s.color }"
          >
            <span class="day-card__shift">
              {{ s.name }} <small>{{ s.start }}–{{ s.end }}</small>
            </span>
            <span class="day-card__people">
              {{ cellItems(items, d.date, s.id).map((i) => empName(i.userId)).join('、') || '未排班' }}
            </span>
          </div>
        </div>
      </div>

      <div class="summary">
        <span>本周 <b>{{ stats.slots }}</b> 个班次格</span>
        <span>共 <b>{{ stats.people }}</b> 人次</span>
        <span>约 <b>{{ stats.hours }}</b> 工时</span>
        <span :class="{ 'text-danger': conflicts.length }">
          冲突 <b>{{ conflicts.length }}</b> 处
        </span>
        <span :class="{ 'text-warning': stats.shortageCount }">
          缺员 <b>{{ stats.shortageCount }}</b> 处
        </span>
        <span class="summary__tip">
          {{ readonly ? '只读状态：局部调整请走调班审批' : '草稿可编辑' }}
        </span>
      </div>
    </ElCard>

    <PersonPicker
      v-model="pickerVisible"
      :date="pickerDate"
      :shift-name="pickerShiftName"
      :employees="employees"
      :assigned="pickerAssigned"
      @select="addPerson"
    />

    <ElDialog v-model="logVisible" title="排班操作日志" width="800px">
      <ElTable :data="logs" v-loading="logLoading" size="small" max-height="480">
        <ElTableColumn prop="createTime" label="时间" width="155" />
        <ElTableColumn prop="username" label="操作人" width="100" />
        <ElTableColumn prop="operation" label="操作" width="120" />
        <ElTableColumn prop="description" label="详情" min-width="230" show-overflow-tooltip />
        <ElTableColumn label="状态" width="80">
          <template #default="{ row }">
            <ElTag :type="row.status === 1 ? 'success' : 'danger'" size="small" effect="plain">
              {{ row.status === 1 ? '成功' : '失败' }}
            </ElTag>
          </template>
        </ElTableColumn>
      </ElTable>
      <p class="log-tip">展示最近 30 条排班相关操作；完整日志见「系统管理 → 操作日志」</p>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { ElMessage } from 'element-plus'
  import DemoBanner from '../shared/DemoBanner.vue'
  import PersonPicker from './modules/PersonPicker.vue'
  import {
    fetchScheduleStores,
    fetchScheduleEmployees,
    fetchShifts,
    fetchWeek,
    fetchValidateWeek,
    saveWeek,
    copyPrevWeek,
    publishWeek,
    revokeWeek
  } from '@/api/schedule'
  import { fetchGetOperationLogList } from '@/api/log'
  import {
    avatarColor,
    buildDays,
    cellItems,
    conflictMessages,
    conflictUserKeys,
    dateOfWeek,
    empName,
    setEmployeeDirectory,
    shortageOf,
    statsOf,
    statusTextOf,
    weekStartStr
  } from '../shared/schedule-utils'

  defineOptions({ name: 'ScheduleRoster' })

  const stores = ref<Api.Schedule.StoreOption[]>([])
  const storeId = ref('')
  const shifts = ref<Api.Schedule.ShiftItem[]>([])
  const employees = ref<Api.Schedule.EmployeeOption[]>([])
  const week = ref<Api.Schedule.WeekSchedule | null>(null)

  const loading = ref(false)
  const saving = ref(false)
  const weekOffset = ref(0)

  const logVisible = ref(false)
  const logLoading = ref(false)
  const logs = ref<Api.Log.OperationLogItem[]>([])

  const weekStart = computed(() => weekStartStr(weekOffset.value))
  const weekLabel = computed(() => `${weekStart.value} ~ ${dateOfWeek(weekStart.value, 6)}`)
  const days = computed(() => buildDays(weekStart.value))
  const items = computed(() => week.value?.items ?? [])
  const readonly = computed(() => !week.value || week.value.status !== 'draft')
  const statusText = computed(() => (week.value ? statusTextOf(week.value.status) : '加载中'))
  const statusTagType = computed<'warning' | 'success' | 'info'>(() =>
    week.value?.status === 'published' ? 'success' : week.value?.status === 'archived' ? 'info' : 'warning'
  )

  const conflictKeys = computed(() => conflictUserKeys(items.value, shifts.value))
  const conflicts = computed(() => conflictMessages(items.value, shifts.value))
  const stats = computed(() => statsOf(items.value, shifts.value, days.value))

  const isConflictCell = (date: string, shiftId: string) =>
    cellItems(items.value, date, shiftId).some((i) => conflictKeys.value.has(`${date}_${i.userId}`))

  /** 排班操作日志：复用系统操作日志（module=排班管理），无需另建日志表 */
  const openOperationLog = async () => {
    logVisible.value = true
    logLoading.value = true
    try {
      const res = await fetchGetOperationLogList({ module: '排班管理', current: 1, size: 30 })
      logs.value = res.records
    } catch (error) {
      console.error(error)
    } finally {
      logLoading.value = false
    }
  }

  /* ------------------------------ 数据加载 ------------------------------ */
  const loadBase = async () => {
    shifts.value = await fetchShifts(storeId.value)
  }

  const loadWeek = async () => {
    loading.value = true
    try {
      const [w, emps] = await Promise.all([
        fetchWeek(storeId.value, weekStart.value),
        fetchScheduleEmployees(storeId.value)
      ])
      week.value = w
      employees.value = emps
      setEmployeeDirectory(emps)
    } catch (error) {
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  onMounted(async () => {
    const storeList = await fetchScheduleStores()
    stores.value = storeList
    if (!storeList.length) {
      ElMessage.warning('当前租户暂无门店，请先在「品牌门店」中创建门店')
      return
    }
    // 后端按登录账号收敛可见门店，默认取第一个；切换门店由 watch 重新加载
    storeId.value = storeList[0].id
  })

  watch(storeId, async (id) => {
    if (!id) return
    await loadBase()
    await loadWeek()
  })

  const shiftWeek = async (delta: number) => {
    weekOffset.value += delta
    await loadWeek()
  }

  const backToCurrent = async () => {
    weekOffset.value = 0
    await loadWeek()
  }

  /* ------------------------------ 编辑 ------------------------------ */
  const pickerVisible = ref(false)
  const pickerDate = ref('')
  const pickerShiftId = ref('')
  const pickerShiftName = ref('')
  const pickerAssigned = computed(() =>
    cellItems(items.value, pickerDate.value, pickerShiftId.value).map((i) => i.userId)
  )

  const openPicker = (date: string, shift: Api.Schedule.ShiftItem) => {
    pickerDate.value = date
    pickerShiftId.value = shift.id
    pickerShiftName.value = shift.name
    pickerVisible.value = true
  }

  const addPerson = (userId: string) => {
    if (!week.value) return
    const { date, shiftId } = { date: pickerDate.value, shiftId: pickerShiftId.value }
    if (items.value.some((i) => i.date === date && i.shiftId === shiftId && i.userId === userId)) {
      ElMessage.warning('该员工已在此班次')
      return
    }
    const emp = employees.value.find((e) => e.id === userId)
    week.value.items = [
      ...items.value,
      {
        id: `IT_${date}_${shiftId}_${userId}_${Date.now()}`,
        scheduleId: week.value.id,
        date,
        shiftId,
        userId,
        roleCode: emp?.role ?? '',
        source: 'manual'
      }
    ]
  }

  const removePerson = (item: Api.Schedule.ScheduleItem) => {
    if (!week.value) return
    week.value.items = items.value.filter(
      (i) =>
        !(i.date === item.date && i.shiftId === item.shiftId && i.userId === item.userId)
    )
  }

  /* ------------------------------ 保存 / 发布 ------------------------------ */
  const save = async (silent = false) => {
    if (!week.value) return
    saving.value = true
    try {
      await saveWeek({
        storeId: storeId.value,
        weekStart: weekStart.value,
        items: items.value
      })
      if (!silent) ElMessage.success('本周排班已保存（草稿）')
      await loadWeek()
    } catch {
      // 业务错误已由 HTTP 层统一提示
    } finally {
      saving.value = false
    }
  }

  const copyPrev = async () => {
    try {
      week.value = await copyPrevWeek(storeId.value, weekStart.value)
      ElMessage.success('已复制上周班表，请核对后发布')
    } catch {
      // 业务错误已提示
    }
  }

  const publish = async () => {
    if (!week.value) return
    if (conflicts.value.length) {
      ElMessage.warning('请先处理排班冲突')
      return
    }
    await save(true)
    try {
      // 后端发布前的权威校验：冲突为阻断项，最低在岗人数仅作提示
      const report = await fetchValidateWeek(storeId.value, weekStart.value)
      if (!report.passable) {
        ElMessage.error(report.conflicts[0] ?? '存在排班冲突，请调整后再发布')
        return
      }
      if (report.shortages.length) {
        ElMessage.warning(`存在 ${report.shortages.length} 处班次缺员，请留意在岗人数`)
      }
      await publishWeek(week.value.id)
      ElMessage.success('班表已发布；已发布班表只读，变更请走调班审批')
      await loadWeek()
    } catch {
      // 业务错误已由 HTTP 层统一提示
    }
  }

  const revoke = async () => {
    if (!week.value) return
    try {
      await revokeWeek(week.value.id)
      ElMessage.success('已撤回发布，恢复可编辑')
      await loadWeek()
    } catch {
      // 业务错误已提示
    }
  }
</script>

<style lang="scss" scoped>
  .roster-page {
    padding-bottom: 16px;
  }

  .toolbar {
    margin-bottom: 16px;

    &__top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    &__title {
      display: flex;
      align-items: center;
      gap: 10px;

      h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
    }

    &__publish-time {
      font-size: 12px;
      color: var(--art-gray-500, #a8abb2);
    }

    &__filters {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 16px;
    }
  }

  .week-switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    &__label {
      min-width: 190px;
      text-align: center;
      font-size: 14px;
      font-weight: 500;
    }
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-left: auto;
    font-size: 12px;
    color: var(--art-gray-600, #666);

    &__item {
      display: inline-flex;
      align-items: center;
      gap: 5px;

      i {
        width: 10px;
        height: 10px;
        border-radius: 3px;
      }
    }
  }

  .notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    margin-bottom: 12px;
    border-radius: 8px;
    font-size: 13px;

    &--warning {
      color: #b8820a;
      background: #fff8e6;
    }

    &--danger {
      color: #d03050;
      background: #fff0f2;
    }

    &--info {
      color: var(--art-gray-600, #666);
      background: var(--art-gray-100, #f5f7fa);
    }
  }

  .roster-scroll {
    overflow-x: auto;
  }

  .roster-row {
    display: grid;
    grid-template-columns: 150px repeat(7, 160px);
    min-width: 1270px;
    border-bottom: 1px solid var(--art-gray-200, #ebeef5);

    &--head {
      border-bottom: 2px solid var(--art-gray-200, #ebeef5);
    }
  }

  .cell {
    min-height: 82px;
    padding: 8px;
    border-right: 1px solid var(--art-gray-200, #ebeef5);
    box-sizing: border-box;

    &--sticky {
      position: sticky;
      left: 0;
      z-index: 2;
      background: var(--el-bg-color, #fff);
    }

    &--head {
      min-height: 48px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 13px;

      span {
        color: var(--art-gray-600, #909399);
        font-size: 12px;
      }

      em {
        color: var(--el-color-primary);
        font-size: 11px;
        font-style: normal;
      }

      &.is-today {
        background: var(--el-color-primary-light-9, #ecf5ff);
      }

      &.is-weekend {
        background: var(--art-gray-100, #f8f9fa);
      }
    }

    &--shift {
      display: flex;
      flex-direction: column;
      gap: 4px;
      border-left: 4px solid transparent;
      font-size: 13px;

      span {
        color: var(--art-gray-600, #909399);
        font-size: 12px;
      }

      small {
        color: var(--art-gray-500, #a8abb2);
        font-size: 11px;
      }

      i {
        margin-left: 4px;
        font-style: normal;
        color: #e6a23c;
      }
    }

    &--day {
      position: relative;
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 5px;
      background: linear-gradient(
        180deg,
        color-mix(in srgb, var(--shift-color) 5%, transparent),
        transparent 60%
      );

      &.is-weekend {
        background-color: var(--art-gray-100, #fafafa);
      }

      &.is-conflict {
        outline: 2px solid #f56c6c;
        outline-offset: -2px;
      }

      &.is-shortage {
        box-shadow: inset 0 -3px 0 #e6a23c;
      }
    }
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 6px 0 3px;
    border: 1px solid var(--art-gray-200, #ebeef5);
    border-radius: 6px;
    background: var(--el-bg-color, #fff);
    font-size: 12px;

    &--conflict {
      border-color: #f56c6c;
      color: #d03050;
    }

    &__avatar {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 11px;
    }

    &__x {
      cursor: pointer;
      color: var(--art-gray-500, #a8abb2);

      &:hover {
        color: #f56c6c;
      }
    }
  }

  .add-btn {
    height: 26px;
    padding: 0 8px;
    border: 1px dashed var(--art-gray-300, #dcdfe6);
    border-radius: 6px;
    background: transparent;
    color: var(--art-gray-600, #909399);
    font-size: 12px;
    cursor: pointer;

    &:hover {
      color: var(--el-color-primary);
      border-color: var(--el-color-primary);
    }
  }

  .shortage {
    position: absolute;
    right: 6px;
    bottom: 4px;
    color: #e6a23c;
    font-size: 11px;
  }

  .summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
    padding: 12px 4px 0;
    font-size: 13px;
    color: var(--art-gray-700, #606266);

    b {
      color: var(--el-color-primary);
    }

    &__tip {
      margin-left: auto;
      color: var(--art-gray-500, #a8abb2);
      font-size: 12px;
    }
  }

  .text-danger {
    color: #f56c6c;
  }
  .text-warning {
    color: #e6a23c;
  }

  .mobile-view {
    display: none;
  }

  @media (max-width: 768px) {
    .roster-scroll,
    .summary {
      display: none;
    }

    .mobile-view {
      display: grid;
      gap: 10px;
    }

    .day-card {
      border: 1px solid var(--art-gray-200, #ebeef5);
      border-radius: 10px;
      overflow: hidden;

      &__head {
        display: flex;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--art-gray-100, #f8f9fa);
        font-size: 13px;

        em {
          color: var(--el-color-primary);
          font-style: normal;
          font-size: 12px;
        }
      }

      &__row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 12px;
        border-left: 3px solid;
        border-top: 1px solid var(--art-gray-200, #ebeef5);
        font-size: 13px;
      }

      &__shift small {
        display: block;
        color: var(--art-gray-500, #a8abb2);
        font-size: 11px;
      }

      &__people {
        color: var(--art-gray-700, #606266);
      }
    }

    .legend {
      display: none;
    }

    .week-switch__label {
      min-width: 150px;
      font-size: 12px;
    }
  }

  .log-tip {
    margin: 10px 0 0;
    color: var(--art-gray-500, #a8abb2);
    font-size: 12px;
  }
</style>
