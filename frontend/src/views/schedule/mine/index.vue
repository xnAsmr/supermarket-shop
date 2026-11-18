<!-- 我的排班：员工只读视角 + 发起调班 -->
<template>
  <div class="mine-page art-full-height">
    <DemoBanner />

    <ElCard shadow="never">
      <template #header>
        <div class="page-head">
          <div class="mine-head">
            <span class="mine-head__avatar" :style="{ background: avatarColor(me.id) }">
              {{ me.name.charAt(0) }}
            </span>
            <div>
              <h2>{{ me.name }} <small>{{ me.role }}</small></h2>
              <p>{{ storeName }} · {{ weekLabel }} · 状态：{{ statusText }}</p>
            </div>
          </div>
          <div class="week-switch">
            <ElButton size="small" @click="shiftWeek(-1)">‹</ElButton>
            <span>{{ weekLabel }}</span>
            <ElButton size="small" @click="shiftWeek(1)">›</ElButton>
            <ElButton v-if="weekOffset !== 0" size="small" text type="primary" @click="backToCurrent">
              回到本周
            </ElButton>
          </div>
        </div>
      </template>

      <div v-loading="loading" class="mine-summary">
        <span>本周 <b>{{ myItems.length }}</b> 个班次</span>
        <span>约 <b>{{ totalHours }}</b> 工时</span>
        <span class="text-g-500">草稿班表对员工不可见，发布后才在此展示</span>
      </div>

      <div class="mine-list">
        <div v-for="d in days" :key="d.date" class="mine-day" :class="{ 'is-today': d.isToday }">
          <div class="mine-day__date">
            <b>{{ d.label }}</b>
            <small>{{ d.md }}</small>
            <em v-if="d.isToday">今天</em>
          </div>

          <div v-if="shiftsOfDay(d.date).length" class="mine-day__shifts">
            <div
              v-for="item in shiftsOfDay(d.date)"
              :key="item.id"
              class="mine-shift"
              :style="{ borderLeftColor: shiftById(item.shiftId)?.color }"
            >
              <div class="mine-shift__main">
                <b>{{ shiftById(item.shiftId)?.name }}</b>
                <span>
                  {{ shiftById(item.shiftId)?.start }} – {{ shiftById(item.shiftId)?.end }}
                  <i v-if="shiftById(item.shiftId)?.crossDay">（次日）</i>
                </span>
                <small>同班：{{ matesOf(item) || '无' }}</small>
              </div>
              <ElButton size="small" text type="primary" @click="openChange(item)">申请调班</ElButton>
            </div>
          </div>
          <span v-else class="mine-day__rest">休息</span>
        </div>
      </div>
    </ElCard>

    <ElDialog v-model="dialogVisible" title="申请调班" width="460px">
      <ElForm label-width="100px">
        <ElFormItem label="调班班次">
          <ElInput :model-value="changeLabel" disabled />
        </ElFormItem>
        <ElFormItem label="调班类型">
          <ElRadioGroup v-model="form.changeType">
            <ElRadio :value="1">换班</ElRadio>
            <ElRadio :value="2">替班</ElRadio>
            <ElRadio :value="3">请假</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="接班同事" required>
          <ElSelect v-model="form.targetUserId" style="width: 100%">
            <ElOption
              v-for="e in colleagues"
              :key="e.id"
              :label="`${e.name}（${e.role}）`"
              :value="e.id"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="调班原因" required>
          <ElInput v-model="form.reason" type="textarea" :rows="3" placeholder="请说明原因，便于店长审批" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">提交申请</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import DemoBanner from '../shared/DemoBanner.vue'
  import {
    fetchScheduleStores,
    fetchScheduleEmployees,
    fetchShifts,
    fetchWeek,
    fetchMySchedule,
    fetchCurrentEmployee,
    createChange
  } from '@/api/schedule'
  import {
    avatarColor,
    buildDays,
    cellItems,
    dateOfWeek,
    empName,
    setEmployeeDirectory,
    shiftMinutes,
    statusTextOf,
    weekStartStr
  } from '../shared/schedule-utils'

  defineOptions({ name: 'ScheduleMine' })

  const storeId = ref('')

  const me = ref<Api.Schedule.EmployeeOption>({ id: '', name: '', role: '', storeId: '' })
  const myItems = ref<Api.Schedule.ScheduleItem[]>([])
  const allItems = ref<Api.Schedule.ScheduleItem[]>([])
  const shifts = ref<Api.Schedule.ShiftItem[]>([])
  const colleagues = ref<Api.Schedule.EmployeeOption[]>([])
  const stores = ref<Api.Schedule.StoreOption[]>([])
  const status = ref<Api.Schedule.WeekStatus>('draft')
  const loading = ref(false)
  const submitting = ref(false)
  const weekOffset = ref(0)
  const dialogVisible = ref(false)

  const weekStart = computed(() => weekStartStr(weekOffset.value))
  const weekLabel = computed(() => `${weekStart.value} ~ ${dateOfWeek(weekStart.value, 6)}`)
  const days = computed(() => buildDays(weekStart.value))
  const statusText = computed(() => statusTextOf(status.value))
  const storeName = computed(() => stores.value.find((s) => s.id === storeId.value)?.name ?? '本店')

  const shiftById = (id: string) => shifts.value.find((s) => s.id === id)
  const shiftsOfDay = (date: string) =>
    myItems.value.filter((i) => i.date === date).sort((a, b) => a.shiftId.localeCompare(b.shiftId))

  const totalHours = computed(() =>
    Math.round(
      myItems.value.reduce((sum, item) => {
        const shift = shiftById(item.shiftId)
        return sum + (shift ? shiftMinutes(shift) / 60 : 0)
      }, 0)
    )
  )

  /** 同班同事（从整周明细里取同日同班次的其他人） */
  const matesOf = (item: Api.Schedule.ScheduleItem) =>
    cellItems(allItems.value, item.date, item.shiftId)
      .filter((i) => i.userId !== me.value.id)
      .map((i) => empName(i.userId))
      .join('、')

  const load = async () => {
    loading.value = true
    try {
      const storeList = await fetchScheduleStores()
      stores.value = storeList
      if (!storeList.length) {
        ElMessage.warning('当前租户暂无门店，请先在「品牌门店」中创建门店')
        return
      }
      storeId.value = storeList[0].id
      const [current, mine, week, shiftList, empList] = await Promise.all([
        fetchCurrentEmployee(),
        fetchMySchedule(weekStart.value),
        fetchWeek(storeId.value, weekStart.value),
        fetchShifts(storeId.value),
        fetchScheduleEmployees(storeId.value)
      ])
      me.value = current
      myItems.value = mine
      allItems.value = week.items
      status.value = week.status
      shifts.value = shiftList
      setEmployeeDirectory(empList)
      colleagues.value = empList.filter((e) => e.id !== current.id)
      if (!form.targetUserId) form.targetUserId = colleagues.value[0]?.id ?? ''
    } finally {
      loading.value = false
    }
  }

  const shiftWeek = async (delta: number) => {
    weekOffset.value += delta
    await load()
  }
  const backToCurrent = async () => {
    weekOffset.value = 0
    await load()
  }

  /* ------------------------------ 发起调班 ------------------------------ */
  const form = reactive({
    date: '',
    shiftId: '',
    changeType: 2 as Api.Schedule.ChangeType,
    targetUserId: '',
    reason: ''
  })
  const currentItem = ref<Api.Schedule.ScheduleItem | null>(null)
  const changeLabel = computed(() => {
    if (!currentItem.value) return ''
    return `${currentItem.value.date} · ${shiftById(currentItem.value.shiftId)?.name ?? ''}`
  })

  const openChange = (item: Api.Schedule.ScheduleItem) => {
    currentItem.value = item
    form.date = item.date
    form.shiftId = item.shiftId
    form.reason = ''
    dialogVisible.value = true
  }

  const submit = async () => {
    if (!currentItem.value) return
    submitting.value = true
    try {
      await createChange({
        storeId: storeId.value,
        date: form.date,
        shiftId: form.shiftId,
        changeType: form.changeType,
        targetUserId: form.targetUserId,
        reason: form.reason
      })
      ElMessage.success('调班申请已提交，可到「调班审批」查看进度')
      dialogVisible.value = false
    } catch {
      // 业务错误已提示
    } finally {
      submitting.value = false
    }
  }

  onMounted(load)
</script>

<style lang="scss" scoped>
  .mine-page {
    padding-bottom: 16px;

    // art-full-height 给页面固定高度，卡片必须可收缩并让内容区自行滚动，
    // 否则一周班次的后几天会被挤出可视区且无法滚动查看
    :deep(.el-card) {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;

      .el-card__body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
      }
    }
  }

  .page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .mine-head {
    display: flex;
    align-items: center;
    gap: 12px;

    &__avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 19px;
      font-weight: 600;
    }

    h2 {
      margin: 0;
      font-size: 17px;
      font-weight: 600;

      small {
        margin-left: 6px;
        font-size: 12px;
        font-weight: 400;
        color: var(--art-gray-500, #a8abb2);
      }
    }

    p {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--art-gray-500, #a8abb2);
    }
  }

  .week-switch {
    display: inline-flex;
    align-items: center;
    gap: 8px;

    span {
      min-width: 190px;
      text-align: center;
      font-size: 13px;
      font-weight: 500;
    }
  }

  .mine-summary {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
    padding: 4px 0 14px;
    font-size: 13px;

    b {
      color: var(--el-color-primary);
      font-size: 15px;
    }
  }

  .mine-day {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 8px;
    border-bottom: 1px solid var(--art-gray-200, #ebeef5);

    &:last-child {
      border-bottom: none;
    }

    &.is-today {
      background: var(--el-color-primary-light-9, #ecf5ff);
    }

    &__date {
      width: 92px;
      flex-shrink: 0;
      font-size: 13px;

      small {
        display: block;
        color: var(--art-gray-500, #a8abb2);
        font-size: 11px;
      }

      em {
        color: var(--el-color-primary);
        font-size: 11px;
        font-style: normal;
      }
    }

    &__shifts {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      flex: 1;
    }

    &__rest {
      color: var(--art-gray-500, #a8abb2);
      font-size: 13px;
    }
  }

  .mine-shift {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 8px 12px;
    border-left: 3px solid;
    border-radius: 8px;
    background: var(--art-gray-100, #f8f9fa);

    &__main {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 12px;

      b {
        font-size: 13px;
      }

      span {
        color: var(--art-gray-600, #909399);
      }

      small {
        color: var(--art-gray-500, #a8abb2);
        font-size: 11px;
      }

      i {
        font-style: normal;
        color: #e6a23c;
      }
    }
  }

  @media (max-width: 768px) {
    .mine-day {
      align-items: flex-start;
      flex-direction: column;
      gap: 8px;
    }

    .week-switch span {
      min-width: 150px;
      font-size: 12px;
    }
  }
</style>
