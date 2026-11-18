<!-- 日志清理弹窗：按保留天数清理 / 清空全部（清空需输入确认文字，避免误点） -->
<template>
  <ElDialog v-model="visible" :title="`清理${label}`" width="480px" append-to-body @closed="reset">
    <ElRadioGroup v-model="mode" class="mode-group">
      <ElRadio value="before">按保留天数清理</ElRadio>
      <ElRadio value="all">清空全部</ElRadio>
    </ElRadioGroup>

    <div v-if="mode === 'before'" class="mode-body">
      <span>保留最近</span>
      <ElSelect v-model="retainDays" class="!w-24">
        <ElOption v-for="days in RETAIN_OPTIONS" :key="days" :label="`${days} 天`" :value="days" />
      </ElSelect>
      <span>的日志，更早的记录将被删除</span>
    </div>

    <div v-else class="mode-body mode-body--column">
      <ElAlert
        type="error"
        :closable="false"
        show-icon
        :title="`将删除全部${label}，该操作不可恢复，请先确认已完成审计留档`"
      />
      <ElInput
        v-model="confirmText"
        :placeholder="`请输入「${CONFIRM_WORD}」以确认`"
        maxlength="10"
      />
    </div>

    <p class="clean-tip">
      清理只删除数据库中的历史记录，不影响系统运行；每日 03:30 的定时任务仍会按保留天数自动清理。
    </p>

    <template #footer>
      <ElButton v-ripple @click="visible = false">取消</ElButton>
      <ElButton
        type="danger"
        v-ripple
        :loading="loading"
        :disabled="!canConfirm"
        @click="handleConfirm"
      >
        {{ mode === 'all' ? '清空全部' : '开始清理' }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  defineOptions({ name: 'ArtLogCleanDialog' })

  interface Props {
    /** 日志名称，用于标题与提示文案（如：操作日志） */
    label: string
    /** 清理请求进行中 */
    loading?: boolean
  }

  withDefaults(defineProps<Props>(), { loading: false })

  /** 弹窗显隐（父组件 v-model 控制） */
  const visible = defineModel<boolean>({ default: false })

  const emit = defineEmits<{
    /** beforeDate 为空表示清空全部 */
    (e: 'confirm', payload: { beforeDate?: string }): void
  }>()

  const RETAIN_OPTIONS = [7, 30, 90, 180]
  /** 清空全部时需手动输入的确认词 */
  const CONFIRM_WORD = '清空'

  const mode = ref<'before' | 'all'>('before')
  const retainDays = ref(30)
  const confirmText = ref('')

  /** 清空全部必须输入确认词；按天数清理随时可提交 */
  const canConfirm = computed(
    () => mode.value === 'before' || confirmText.value.trim() === CONFIRM_WORD
  )

  /** 保留 N 天 → 截止日期（yyyy-MM-dd，早于当天 0 点的记录被清理） */
  const beforeDateOf = (days: number): string => {
    const date = new Date(Date.now() - days * 86400000)
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  const handleConfirm = () => {
    if (!canConfirm.value) return
    emit('confirm', {
      beforeDate: mode.value === 'before' ? beforeDateOf(retainDays.value) : undefined
    })
  }

  const reset = () => {
    mode.value = 'before'
    retainDays.value = 30
    confirmText.value = ''
  }
</script>

<style lang="scss" scoped>
  .mode-group {
    display: flex;
    gap: 16px;
  }

  .mode-body {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 13px;
    color: var(--art-gray-700);
  }

  .mode-body--column {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .clean-tip {
    margin: 16px 0 0;
    font-size: 12px;
    line-height: 1.6;
    color: var(--art-gray-500);
  }
</style>
