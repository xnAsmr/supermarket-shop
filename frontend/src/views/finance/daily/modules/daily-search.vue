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
  type DailySearchFormParams = Api.Finance.DailySearchParams

  interface Props {
    modelValue: DailySearchFormParams
  }
  interface Emits {
    (e: 'update:modelValue', value: DailySearchFormParams): void
    (e: 'search', params: DailySearchFormParams): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const formItems = computed(() => [
    {
      label: '日期',
      key: 'date',
      type: 'input',
      placeholder: '如 2026-10-17',
      clearable: true
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      placeholder: '请选择状态',
      props: {
        clearable: true,
        options: [
          { label: '已日结', value: 'settled' },
          { label: '待日结', value: 'pending' }
        ]
      }
    }
  ])

  const handleReset = () => {
    emit('reset')
  }

  const handleSearch = async (params: DailySearchFormParams) => {
    await searchBarRef.value.validate()
    emit('search', params)
  }
</script>
