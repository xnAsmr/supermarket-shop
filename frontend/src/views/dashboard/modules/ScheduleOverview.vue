<!-- 经营驾驶舱：本周排班概览（只读）。发布后才展示明细，草稿只显示提示 -->
<template>
  <ElCard class="dashboard-schedule-card" shadow="never" data-tour="dashboard-schedule">
    <template #header>
      <div class="schedule-head">
        <div class="schedule-head__left">
          <span class="schedule-head__icon"><ArtSvgIcon icon="ri:calendar-line" :size="18" /></span>
          <div class="schedule-head__title">
            <span class="schedule-head__name">本周排班</span>
            <span class="schedule-head__range">{{ storeName }} · {{ weekLabel }}</span>
          </div>
          <ElTag
            v-if="week"
            :type="week.status === 'published' ? 'success' : 'warning'"
            effect="plain"
            size="small"
          >
            {{ statusText }}
          </ElTag>
          <ElTag
            v-if="showMyTag"
            class="schedule-head__my-tag"
            type="primary"
            effect="dark"
            size="small"
            title="点击只看我的排班"
            @click="filterUserId = myUserId"
          >
            我的排班 {{ myItemCount }} 次
          </ElTag>
        </div>
        <div class="schedule-head__right">
          <ElSelect v-model="filterUserId" size="small" class="schedule-filter" placeholder="全部用户">
            <ElOption label="全部用户" value="" />
            <ElOption
              v-for="user in weekUsers"
              :key="user.id"
              :label="user.isMe ? `${user.name}（我）` : user.name"
              :value="user.id"
            />
          </ElSelect>
          <RouterLink to="/schedule/roster" class="schedule-head__link">查看完整排班 →</RouterLink>
        </div>
      </div>
    </template>

    <div v-loading="loading" class="schedule-body">
      <template v-if="week && week.status === 'published'">
        <div class="schedule-summary">
          <span class="summary-item">
            <i class="summary-item__dot is-primary" />
            <b>{{ visibleCount }}</b><small>本周人次</small>
          </span>
          <span class="summary-item">
            <i class="summary-item__dot is-success" />
            <b>{{ participantCount }}</b><small>参与人数</small>
          </span>
          <span class="summary-item">
            <i class="summary-item__dot is-warning" />
            <b>{{ myItemCount }}</b><small>我的班次</small>
          </span>
          <span class="summary-note">
            今日 {{ todayLabel || '—' }} · 主题色边框标签为我的排班
          </span>
        </div>

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
                  'is-shortage': shortageOf(allItems, d.date, s) > 0
                }"
                :style="{ '--shift-color': s.color }"
              >
                <div
                  v-for="item in personsOf(d.date, s.id)"
                  :key="item.id"
                  class="chip"
                  :class="{ 'chip--me': item.userId === myUserId }"
                >
                  <span class="chip__avatar" :style="{ background: avatarColor(item.userId) }">
                    {{ empName(item.userId).charAt(0) }}
                  </span>
                  <span class="chip__name">{{ empName(item.userId) }}</span>
                </div>
                <span v-if="shortageOf(allItems, d.date, s) > 0" class="shortage">
                  缺 {{ shortageOf(allItems, d.date, s) }} 人
                </span>
              </div>
            </div>
          </div>
        </div>

        <p class="roster-foot">
          <template v-if="week?.publishTime">
            发布于 {{ week.publishTime }} · 发布人 {{ week.publisherName || '—' }} ·
          </template>
          共 {{ visibleCount }} 人次<template v-if="selectedUserName">（{{ selectedUserName }}）</template> · 已发布班表对全员可见，临时变更请到「调班审批」发起
        </p>
      </template>

      <div v-else-if="week && week.status === 'draft'" class="draft-hint">
        <span class="draft-hint__icon"><ArtSvgIcon icon="ri:file-list-3-line" :size="22" /></span>
        <div>
          <p>本周班表尚未发布，发布后对全员可见</p>
          <small>已安排 {{ week.items.length }} 人次 · 可在「周排班」中查看和发布</small>
        </div>
      </div>

      <ElEmpty v-else :description="emptyText" :image-size="70" />
    </div>
  </ElCard>
</template>

<script setup lang="ts">
  import {
    fetchScheduleStores,
    fetchScheduleEmployees,
    fetchCurrentEmployee,
    fetchShifts,
    fetchWeek
  } from '@/api/schedule'
  import {
    avatarColor,
    buildDays,
    cellItems,
    dateOfWeek,
    empName,
    setEmployeeDirectory,
    shortageOf,
    statusTextOf,
    weekStartStr
  } from '@/views/schedule/shared/schedule-utils'

  defineOptions({ name: 'DashboardScheduleOverview' })

  const loading = ref(true)
  const stores = ref<Api.Schedule.StoreOption[]>([])
  const storeId = ref('')
  const shifts = ref<Api.Schedule.ShiftItem[]>([])
  const week = ref<Api.Schedule.WeekSchedule | null>(null)
  /** 当前登录用户，用于高亮「我的排班」 */
  const myUserId = ref('')
  /** 用户筛选，空字符串表示全部 */
  const filterUserId = ref('')

  const weekStart = weekStartStr(0)
  const days = computed(() => buildDays(weekStart))
  const weekLabel = computed(() => `${weekStart} ~ ${dateOfWeek(weekStart, 6)}`)
  const storeName = computed(() => stores.value.find((s) => s.id === storeId.value)?.name ?? '本店')
  const statusText = computed(() => (week.value ? statusTextOf(week.value.status) : ''))
  const emptyText = computed(() => {
    if (!week.value) return '本周暂无班表数据'
    if (week.value.status === 'draft') return '本周班表尚未发布，发布后对全员可见'
    return '本周班表已归档'
  })

  /** 本周有排班的人员，「我」排在最前便于快速定位 */
  const weekUsers = computed(() => {
    if (!week.value) return []
    const ids = Array.from(new Set(week.value.items.map((item) => item.userId)))
    return ids
      .map((id) => ({ id, name: empName(id), isMe: id === myUserId.value }))
      .sort((a, b) => Number(b.isMe) - Number(a.isMe) || a.name.localeCompare(b.name, 'zh-Hans-CN'))
  })

  const participantCount = computed(() => weekUsers.value.length)

  const todayLabel = computed(() => {
    const today = days.value.find((day) => day.isToday)
    return today ? `${today.label} ${today.md}` : ''
  })

  const selectedUserName = computed(() =>
    filterUserId.value ? (weekUsers.value.find((u) => u.id === filterUserId.value)?.name ?? '') : ''
  )

  const myItemCount = computed(() =>
    week.value && myUserId.value
      ? week.value.items.filter((item) => item.userId === myUserId.value).length
      : 0
  )

  /** 已发布、「我」本周有班且未筛选时，展示「我的排班」快捷标签 */
  const showMyTag = computed(
    () => week.value?.status === 'published' && !filterUserId.value && myItemCount.value > 0
  )

  /** 缺员统计按全量班表计算，不随用户筛选变化 */
  const allItems = computed(() => week.value?.items ?? [])

  const visibleCount = computed(() => {
    if (!week.value) return 0
    return filterUserId.value
      ? week.value.items.filter((item) => item.userId === filterUserId.value).length
      : week.value.items.length
  })

  const personsOf = (date: string, shiftId: string): Api.Schedule.ScheduleItem[] => {
    if (!week.value) return []
    const list = cellItems(week.value.items, date, shiftId)
    return filterUserId.value ? list.filter((item) => item.userId === filterUserId.value) : list
  }

  const load = async () => {
    loading.value = true
    try {
      const storeList = await fetchScheduleStores()
      stores.value = storeList
      if (!storeList.length) return
      storeId.value = storeList[0].id
      const [shiftList, employeeList, weekData, currentEmployee] = await Promise.all([
        fetchShifts(storeId.value),
        fetchScheduleEmployees(storeId.value),
        fetchWeek(storeId.value, weekStart),
        fetchCurrentEmployee().catch(() => null)
      ])
      shifts.value = [...shiftList].sort((a, b) => a.sort - b.sort)
      setEmployeeDirectory(employeeList)
      week.value = weekData
      myUserId.value = currentEmployee?.id ?? ''
      filterUserId.value = ''
    } catch (error) {
      // 驾驶舱其它数据不受影响，这里只降级为空状态
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  onMounted(load)
</script>

<style lang="scss" scoped>
  .dashboard-schedule-card {
    overflow: hidden;
    border: 1px solid var(--art-gray-200, #ebeef5);
    border-radius: 10px;

    :deep(.el-card__header) {
      padding: 12px 16px;
      border-bottom: 1px solid var(--art-gray-200, #ebeef5);
      background: linear-gradient(
        100deg,
        var(--el-color-primary-light-9, #ecf5ff) 0%,
        transparent 62%
      );
    }

    :deep(.el-card__body) {
      padding: 12px 16px 14px;
    }
  }

  .schedule-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;

    &__left {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }

    &__icon {
      width: 34px;
      height: 34px;
      flex-shrink: 0;
      border-radius: 9px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      background: linear-gradient(135deg, var(--el-color-primary), var(--el-color-primary-light-3));
    }

    &__title {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    &__name {
      font-size: 15px;
      font-weight: 600;
      line-height: 1.2;
    }

    &__range {
      color: var(--art-gray-500, #a8abb2);
      font-size: 11px;
      line-height: 1.2;
    }

    &__my-tag {
      cursor: pointer;
    }

    &__right {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    &__link {
      font-size: 13px;
      white-space: nowrap;
    }
  }

  .schedule-filter {
    width: 150px;
  }

  .schedule-summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
    margin-bottom: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--art-gray-100, #f8f9fa);
  }

  .summary-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;

    b {
      font-size: 16px;
      line-height: 1;
    }

    small {
      color: var(--art-gray-500, #a8abb2);
      font-size: 12px;
    }

    &__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;

      &.is-primary {
        background: var(--el-color-primary);
      }

      &.is-success {
        background: var(--el-color-success);
      }

      &.is-warning {
        background: var(--el-color-warning);
      }
    }
  }

  .summary-note {
    margin-left: auto;
    color: var(--art-gray-500, #a8abb2);
    font-size: 12px;
  }

  /* 与 views/schedule/roster/index.vue 的排班表样式保持一致 */
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

    // 当前登录用户：保留排班表 chip 原有样式，仅增加主题色边框强调
    &--me {
      border-color: var(--el-color-primary);
      background: var(--el-color-primary-light-9, #ecf5ff);
      font-weight: 600;
    }
  }

  .shortage {
    position: absolute;
    right: 6px;
    bottom: 4px;
    color: #e6a23c;
    font-size: 11px;
  }

  .roster-foot {
    margin: 8px 0 0;
    color: var(--art-gray-500, #a8abb2);
    font-size: 12px;
  }

  .draft-hint {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 84px;
    padding: 16px;
    color: var(--art-gray-600, #909399);

    &__icon {
      display: flex;
      color: var(--el-color-primary);
    }

    p {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 500;
    }

    small {
      color: var(--art-gray-500, #a8abb2);
      font-size: 12px;
    }
  }
</style>
