<!-- 班次管理：定义门店标准班次（排班表直接引用） -->
<template>
  <div class="shift-page art-full-height">
    <DemoBanner />

    <ElCard shadow="never">
      <template #header>
        <div class="page-head">
          <div>
            <h2>班次管理</h2>
            <p>定义门店标准班次，排班表按模板引用；停用不影响历史班表。</p>
          </div>
          <ElButton type="primary" @click="openDialog()">新增班次</ElButton>
        </div>
      </template>

      <ElTable v-loading="loading" :data="shifts" size="small" border>
        <ElTableColumn label="班次" min-width="140">
          <template #default="{ row }">
            <span class="shift-name">
              <i :style="{ background: row.color }" />
              <b>{{ row.name }}</b>
              <small>{{ row.code }}</small>
            </span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="时间" min-width="170">
          <template #default="{ row }">
            {{ row.start }} – {{ row.end }}
            <ElTag v-if="row.crossDay" size="small" type="warning" effect="plain">跨夜</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="role" label="岗位" min-width="100" />
        <ElTableColumn label="最低人数" width="100" align="center">
          <template #default="{ row }">{{ row.minStaff }} 人</template>
        </ElTableColumn>
        <ElTableColumn label="休息" width="100" align="center">
          <template #default="{ row }">{{ row.rest }} 分钟</template>
        </ElTableColumn>
        <ElTableColumn label="适用门店" min-width="120">
          <template #default="{ row }">{{ row.storeId ? storeName(row.storeId) : '租户通用' }}</template>
        </ElTableColumn>
        <ElTableColumn label="状态" width="90">
          <template #default="{ row }">
            <ElTag :type="row.enabled ? 'success' : 'info'" size="small" effect="plain">
              {{ row.enabled ? '启用' : '停用' }}
            </ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <ElButton size="small" text type="primary" @click="openDialog(row)">编辑</ElButton>
            <ElButton size="small" text @click="handleToggle(row)">
              {{ row.enabled ? '停用' : '启用' }}
            </ElButton>
          </template>
        </ElTableColumn>
      </ElTable>

      <p class="page-tip">
        <ArtSvgIcon icon="ri:information-line" />
        提示：结束时间小于等于开始时间会自动识别为「跨夜班」；工时按「班次时长 − 休息时长」计算。
      </p>
    </ElCard>

    <ElDialog v-model="dialogVisible" :title="editingId ? '编辑班次' : '新增班次'" width="480px">
      <ElForm label-width="100px">
        <ElFormItem label="班次名称" required>
          <ElInput v-model="form.name" placeholder="如：中班" />
        </ElFormItem>
        <ElFormItem label="开始时间" required>
          <ElInput v-model="form.start" placeholder="08:00" />
        </ElFormItem>
        <ElFormItem label="结束时间" required>
          <ElInput v-model="form.end" placeholder="16:00" />
          <span v-if="isCrossDay" class="cross-hint">将自动识别为跨夜班</span>
        </ElFormItem>
        <ElFormItem label="岗位">
          <ElInput v-model="form.role" placeholder="收银员 / 值班" />
        </ElFormItem>
        <ElFormItem label="最低人数">
          <ElInputNumber v-model="form.minStaff" :min="1" :max="20" />
        </ElFormItem>
        <ElFormItem label="休息(分钟)">
          <ElInputNumber v-model="form.rest" :min="0" :max="240" :step="10" />
        </ElFormItem>
        <ElFormItem label="班次颜色">
          <ElColorPicker v-model="form.color" />
        </ElFormItem>
        <ElFormItem label="备注">
          <ElInput v-model="form.remark" type="textarea" :rows="2" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submit">确定</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { ElMessage } from 'element-plus'
  import DemoBanner from '../shared/DemoBanner.vue'
  import { fetchScheduleStores, fetchShifts, upsertShift, toggleShift } from '@/api/schedule'

  defineOptions({ name: 'ScheduleShift' })

  const shifts = ref<Api.Schedule.ShiftItem[]>([])
  const stores = ref<Api.Schedule.StoreOption[]>([])
  const loading = ref(false)
  const submitting = ref(false)
  const dialogVisible = ref(false)
  const editingId = ref('')

  const form = reactive({
    name: '',
    code: '',
    start: '08:00',
    end: '16:00',
    role: '收银员',
    minStaff: 2,
    rest: 30,
    color: '#FFB200',
    remark: ''
  })

  const isCrossDay = computed(() => form.end <= form.start)
  const storeName = (id: string) => stores.value.find((s) => s.id === id)?.name ?? id

  const load = async () => {
    loading.value = true
    try {
      const [list, storeList] = await Promise.all([fetchShifts(), fetchScheduleStores()])
      shifts.value = list
      stores.value = storeList
    } finally {
      loading.value = false
    }
  }

  const openDialog = (row?: Api.Schedule.ShiftItem) => {
    editingId.value = row?.id ?? ''
    form.name = row?.name ?? ''
    form.code = row?.code ?? ''
    form.start = row?.start ?? '08:00'
    form.end = row?.end ?? '16:00'
    form.role = row?.role ?? '收银员'
    form.minStaff = row?.minStaff ?? 2
    form.rest = row?.rest ?? 30
    form.color = row?.color ?? '#FFB200'
    form.remark = row?.remark ?? ''
    dialogVisible.value = true
  }

  const submit = async () => {
    if (!form.name.trim()) return ElMessage.warning('请输入班次名称')
    if (!/^\d{2}:\d{2}$/.test(form.start) || !/^\d{2}:\d{2}$/.test(form.end)) {
      return ElMessage.warning('时间格式应为 HH:mm，如 08:00')
    }
    submitting.value = true
    try {
      await upsertShift({
        id: editingId.value || undefined,
        name: form.name.trim(),
        code: form.code || undefined,
        start: form.start,
        end: form.end,
        role: form.role,
        minStaff: form.minStaff,
        rest: form.rest,
        color: form.color,
        remark: form.remark,
        enabled: true
      })
      ElMessage.success(editingId.value ? '班次已更新' : `已新增「${form.name}」${isCrossDay.value ? '（跨夜班）' : ''}`)
      dialogVisible.value = false
      await load()
    } catch {
      // 业务错误已提示
    } finally {
      submitting.value = false
    }
  }

  const handleToggle = async (row: Api.Schedule.ShiftItem) => {
    try {
      await toggleShift(row.id)
      ElMessage.success(`已${row.enabled ? '停用' : '启用'}「${row.name}」`)
      await load()
    } catch {
      // 业务错误已提示
    }
  }

  onMounted(load)
</script>

<style lang="scss" scoped>
  .shift-page {
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

  .shift-name {
    display: inline-flex;
    align-items: center;
    gap: 7px;

    i {
      width: 10px;
      height: 10px;
      border-radius: 3px;
    }

    small {
      color: var(--art-gray-500, #a8abb2);
      font-size: 11px;
    }
  }

  .page-tip {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 14px 0 0;
    font-size: 12px;
    color: var(--art-gray-500, #a8abb2);
  }

  .cross-hint {
    margin-left: 10px;
    color: #e6a23c;
    font-size: 12px;
  }
</style>
