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
  import { fetchPlanList } from '@/api/tenant'

  interface Props {
    modelValue: Api.Tenant.TenantSearchParams
  }
  interface Emits {
    (e: 'update:modelValue', value: Api.Tenant.TenantSearchParams): void
    (e: 'search', params: Api.Tenant.TenantSearchParams): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const planOptions = ref<{ label: string; value: string }[]>([])

  const loadOptions = async () => {
    try {
      const res = await fetchPlanList({ current: 1, size: 100 })
      planOptions.value = res.records.map((item) => ({ label: item.name, value: item.id }))
    } catch (error) {
      console.error(error)
    }
  }

  const formItems = computed(() => [
    {
      label: '门店名称',
      key: 'name',
      type: 'input',
      placeholder: '请输入门店名称',
      clearable: true
    },
    {
      label: '门店编码',
      key: 'code',
      type: 'input',
      placeholder: '请输入门店编码',
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
          { label: '正常', value: '1' },
          { label: '停用', value: '2' },
          { label: '过期', value: '3' }
        ]
      }
    },
    {
      label: '套餐',
      key: 'planId',
      type: 'select',
      placeholder: '请选择套餐',
      props: { clearable: true, options: planOptions.value }
    }
  ])

  const handleReset = () => {
    emit('reset')
  }

  const handleSearch = async (params: Api.Tenant.TenantSearchParams) => {
    await searchBarRef.value.validate()
    emit('search', params)
  }

  onMounted(loadOptions)
</script>
