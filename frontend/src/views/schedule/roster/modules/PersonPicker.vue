<!-- 排班单元格选人弹窗：只列本门店在职员工 -->
<template>
  <ElDialog v-model="visible" title="选择员工" width="420px" align-center>
    <p class="picker-hint">
      {{ date }} · {{ shiftName }}
      <span>（仅显示本门店在职员工，TODO: 后端应查 sys_user）</span>
    </p>
    <div v-if="employees.length" class="picker">
      <button
        v-for="emp in employees"
        :key="emp.id"
        type="button"
        class="picker__item"
        :disabled="assigned.includes(emp.id)"
        @click="handleSelect(emp.id)"
      >
        <span class="picker__avatar" :style="{ background: avatarColor(emp.id) }">
          {{ emp.name.charAt(0) }}
        </span>
        <span class="picker__name">{{ emp.name }}</span>
        <small>{{ assigned.includes(emp.id) ? '已在此班次' : emp.role }}</small>
      </button>
    </div>
    <ElEmpty v-else description="该门店暂无可选员工" :image-size="70" />
  </ElDialog>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { avatarColor } from '../../shared/schedule-utils'

  const props = defineProps<{
    modelValue: boolean
    date: string
    shiftName: string
    employees: Api.Schedule.EmployeeOption[]
    /** 已在当前格子的员工 id */
    assigned: string[]
  }>()

  const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    select: [userId: string]
  }>()

  const visible = computed({
    get: () => props.modelValue,
    set: (value: boolean) => emit('update:modelValue', value)
  })

  const handleSelect = (userId: string) => {
    emit('select', userId)
    visible.value = false
  }
</script>

<style lang="scss" scoped>
  .picker-hint {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--art-gray-700, #606266);

    span {
      color: var(--art-gray-500, #a8abb2);
      font-size: 11px;
    }
  }

  .picker {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    max-height: 320px;
    overflow-y: auto;

    &__item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px;
      border: 1px solid var(--art-gray-200, #ebeef5);
      border-radius: 8px;
      background: transparent;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;

      &:hover:not(:disabled) {
        border-color: var(--el-color-primary);
        background: var(--el-color-primary-light-9, #ecf5ff);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      small {
        margin-left: auto;
        color: var(--art-gray-500, #a8abb2);
        font-size: 11px;
      }
    }

    &__avatar {
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 12px;
    }

    &__name {
      font-weight: 500;
    }
  }
</style>
