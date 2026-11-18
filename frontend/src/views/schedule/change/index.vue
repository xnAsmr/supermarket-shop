<!-- 调班审批：发起申请 + 店长审批（通过后自动回写班表） -->
<template>
  <div class="change-page art-full-height">
    <DemoBanner />

    <ElCard shadow="never">
      <template #header>
        <div class="page-head">
          <div>
            <h2>
              调班审批
              <ElTag v-if="pendingCount" type="danger" size="small" round effect="plain">
                {{ pendingCount }} 条待办
              </ElTag>
            </h2>
            <p>
              {{
                hasAuth('review')
                  ? '员工发起换班 / 替班 / 请假，审批通过后系统自动改写双方排班明细并留痕。'
                  : '仅显示与我相关的调班申请（我发起的或需我接班的），审批由店长处理。'
              }}
            </p>
          </div>
          <ElButton v-if="hasAuth('add')" type="primary" @click="openCreate">发起调班</ElButton>
        </div>
      </template>

      <div v-loading="loading" class="change-list">
        <div v-for="item in changes" :key="item.id" class="change-item">
          <div class="change-item__avatar" :style="{ background: avatarColor(item.applicantId) }">
            {{ item.applicantName.charAt(0) }}
          </div>

          <div class="change-item__main">
            <div class="change-item__line">
              <b>{{ item.applicantName }}</b>
              <span class="change-tag">{{ changeTypeText(item.changeType) }}</span>
              <span class="text-g-500">{{ item.date }}</span>
              <span>{{ shiftName(item.shiftId) }}</span>
              <span class="arrow">→</span>
              <b>{{ item.targetUserName }}</b>
            </div>
            <p class="change-item__reason">{{ item.reason }}</p>
            <p class="change-item__meta">
              提交于 {{ item.createTime }}
              <template v-if="item.reviewTime">
                · {{ item.reviewerName }} 于 {{ item.reviewTime }} 审批
              </template>
            </p>
          </div>

          <div class="change-item__side">
            <ElTag v-if="item.status === 0" type="warning" effect="plain" size="small">待审批</ElTag>
            <ElTag v-else-if="item.status === 1" type="success" effect="plain" size="small">已通过</ElTag>
            <ElTag v-else type="info" effect="plain" size="small">已拒绝</ElTag>
            <template v-if="item.status === 0 && hasAuth('review')">
              <ElButton size="small" type="primary" @click="review(item, 1)">同意</ElButton>
              <ElButton size="small" @click="review(item, 2)">拒绝</ElButton>
            </template>
          </div>
        </div>
        <ElEmpty v-if="!loading && !changes.length" description="暂无调班申请" :image-size="80" />
      </div>
    </ElCard>

    <ElDialog v-model="dialogVisible" title="发起调班" width="480px">
      <ElForm label-width="100px">
        <ElFormItem label="调班日期" required>
          <ElSelect v-model="form.date" style="width: 100%">
            <ElOption v-for="d in days" :key="d.date" :label="`${d.label} ${d.md}（${d.date}）`" :value="d.date" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="班次" required>
          <ElSelect v-model="form.shiftId" style="width: 100%">
            <ElOption v-for="s in shifts" :key="s.id" :label="`${s.name} ${s.start}–${s.end}`" :value="s.id" />
          </ElSelect>
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
              v-for="e in employees"
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
  import { useAuth } from '@/hooks/core/useAuth'
  import {
    fetchChanges,
    fetchShifts,
    fetchScheduleStores,
    fetchScheduleEmployees,
    fetchCurrentEmployee,
    createChange,
    reviewChange
  } from '@/api/schedule'
  import {
    avatarColor,
    buildDays,
    changeTypeText,
    setEmployeeDirectory,
    weekStartStr
  } from '../shared/schedule-utils'

  defineOptions({ name: 'ScheduleChange' })

  const { hasAuth } = useAuth()

  const storeId = ref('')

  const changes = ref<Api.Schedule.ChangeItem[]>([])
  const shifts = ref<Api.Schedule.ShiftItem[]>([])
  const employees = ref<Api.Schedule.EmployeeOption[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const dialogVisible = ref(false)
  const days = computed(() => buildDays(weekStartStr(0)))
  const pendingCount = computed(() => changes.value.filter((c) => c.status === 0).length)

  const form = reactive({
    date: days.value[0]?.date ?? '',
    shiftId: '',
    changeType: 2 as Api.Schedule.ChangeType,
    targetUserId: '',
    reason: ''
  })

  const shiftName = (id: string) => shifts.value.find((s) => s.id === id)?.name ?? id

  const load = async () => {
    loading.value = true
    try {
      const storeList = await fetchScheduleStores()
      if (!storeList.length) {
        ElMessage.warning('当前租户暂无门店，请先在「品牌门店」中创建门店')
        return
      }
      storeId.value = storeList[0].id
      const [list, shiftList, empList, me] = await Promise.all([
        fetchChanges(),
        fetchShifts(storeId.value),
        fetchScheduleEmployees(storeId.value),
        fetchCurrentEmployee()
      ])
      changes.value = list
      shifts.value = shiftList
      employees.value = empList
      setEmployeeDirectory(empList)
      if (!form.targetUserId) {
        form.targetUserId = empList.find((e) => e.id !== me.id)?.id ?? ''
      }
      if (!form.shiftId && shiftList.length) form.shiftId = shiftList[0].id
    } finally {
      loading.value = false
    }
  }

  const openCreate = () => {
    form.reason = ''
    dialogVisible.value = true
  }

  const submit = async () => {
    if (!form.targetUserId) return ElMessage.warning('请选择接班同事')
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
      ElMessage.success('调班申请已提交，等待店长审批')
      dialogVisible.value = false
      await load()
    } catch {
      // 业务错误已提示
    } finally {
      submitting.value = false
    }
  }

  const review = async (item: Api.Schedule.ChangeItem, status: 1 | 2) => {
    try {
      await reviewChange(item.id, status)
      ElMessage.success(
        status === 1 ? '已同意，班表明细已由后端自动回写（source=change）' : '已拒绝申请'
      )
      await load()
    } catch {
      // 业务错误已提示
    }
  }

  onMounted(load)
</script>

<style lang="scss" scoped>
  .change-page {
    padding-bottom: 16px;

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
    gap: 12px;
    flex-wrap: wrap;

    h2 {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0;
      font-size: 17px;
      font-weight: 600;
    }

    p {
      margin: 4px 0 0;
      font-size: 12px;
      color: var(--art-gray-500, #a8abb2);
    }
  }

  .change-list {
    min-height: 120px;
  }

  .change-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 4px;
    border-bottom: 1px solid var(--art-gray-200, #ebeef5);

    &:last-child {
      border-bottom: none;
    }

    &__avatar {
      width: 36px;
      height: 36px;
      flex-shrink: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 15px;
      font-weight: 600;
    }

    &__main {
      flex: 1;
      min-width: 0;
    }

    &__line {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 13px;

      .arrow {
        color: var(--el-color-primary);
      }
    }

    &__reason {
      margin: 6px 0 0;
      font-size: 12px;
      color: var(--art-gray-600, #909399);
    }

    &__meta {
      margin: 4px 0 0;
      font-size: 11px;
      color: var(--art-gray-500, #a8abb2);
    }

    &__side {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }
  }

  .change-tag {
    padding: 1px 7px;
    border-radius: 4px;
    background: var(--el-color-primary-light-9, #ecf5ff);
    color: var(--el-color-primary);
    font-size: 11px;
  }
</style>
