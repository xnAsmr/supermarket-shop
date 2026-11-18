<template>
  <ArtSearchBar
    ref="searchBarRef"
    v-model="formData"
    :items="formItems"
    @reset="handleReset"
    @search="handleSearch"
  />
</template>

<script setup lang="ts">
  import { FLOW_CATEGORIES } from '@/api/finance'

  type FlowSearchFormParams = Api.Finance.FlowSearchParams & {
    daterange?: string[]
  }

  interface Props {
    modelValue: FlowSearchFormParams
  }
  interface Emits {
    (e: 'update:modelValue', value: FlowSearchFormParams): void
    (e: 'search', params: FlowSearchFormParams): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const categoryOptions = [
    ...FLOW_CATEGORIES.income.map((item) => ({ label: item, value: item })),
    ...FLOW_CATEGORIES.expense.map((item) => ({ label: item, value: item }))
  ]

  const formItems = computed(() => [
    {
      label: '流水类型',
      key: 'type',
      type: 'select',
      placeholder: '请选择类型',
      props: {
        clearable: true,
        options: [
          { label: '收入', value: 'income' },
          { label: '支出', value: 'expense' }
        ]
      }
    },
    {
      label: '收支分类',
      key: 'category',
      type: 'select',
      placeholder: '请选择分类',
      props: { clearable: true, options: categoryOptions }
    },
    {
      label: '流水号',
      key: 'flowNo',
      type: 'input',
      placeholder: '请输入流水号',
      clearable: true
    },
    {
      label: '关联单号',
      key: 'relatedNo',
      type: 'input',
      placeholder: '请输入关联单号',
      clearable: true
    },
    {
      label: '发生日期',
      key: 'daterange',
      type: 'daterange',
      props: {
        type: 'daterange',
        style: { width: '100%' },
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期',
        valueFormat: 'YYYY-MM-DD'
      }
    }
  ])

  const handleReset = () => {
    emit('reset')
  }

  const handleSearch = async (params: FlowSearchFormParams) => {
    await searchBarRef.value.validate()
    emit('search', params)
  }
</script>
