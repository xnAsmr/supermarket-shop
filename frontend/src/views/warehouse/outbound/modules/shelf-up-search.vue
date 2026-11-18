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
  import { fetchGetWarehouseList } from '@/api/warehouse'
  import { SHELF_UP_STATUS } from '@/views/warehouse/modules/shelf-status'

  type SearchFormParams = Partial<Api.Warehouse.ShelfUpSearchParams> & {
    daterange?: string[]
  }

  interface Props {
    modelValue: SearchFormParams
  }
  interface Emits {
    (e: 'update:modelValue', value: SearchFormParams): void
    (e: 'search', params: Partial<Api.Warehouse.ShelfUpSearchParams>): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const storeOptions = ref<{ label: string; value: string }[]>([])

  const loadOptions = async () => {
    const warehouses = await fetchGetWarehouseList()
    storeOptions.value = warehouses
      .filter((item) => item.status === '1')
      .map((item) => ({ label: item.name, value: item.id }))
  }

  const formItems = computed(() => [
    {
      label: '上架单号',
      key: 'shelfUpNo',
      type: 'input',
      placeholder: '请输入上架单号',
      clearable: true
    },
    {
      label: '门店',
      key: 'storeId',
      type: 'select',
      placeholder: '请选择门店',
      props: { clearable: true, options: storeOptions.value }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      placeholder: '请选择状态',
      props: {
        clearable: true,
        options: Object.entries(SHELF_UP_STATUS).map(([value, item]) => ({
          label: item.text,
          value
        }))
      }
    },
    {
      label: '创建时间',
      key: 'daterange',
      type: 'daterange',
      props: {
        style: { width: '100%' },
        type: 'daterange',
        valueFormat: 'YYYY-MM-DD',
        rangeSeparator: '至',
        startPlaceholder: '开始日期',
        endPlaceholder: '结束日期'
      }
    }
  ])

  const handleReset = () => {
    emit('reset')
  }

  const handleSearch = async (params: SearchFormParams) => {
    await searchBarRef.value.validate()
    const { daterange, ...rest } = params
    const [startTime, endTime] = Array.isArray(daterange) ? daterange : []
    emit('search', { ...rest, startTime, endTime })
  }

  onMounted(loadOptions)
</script>
