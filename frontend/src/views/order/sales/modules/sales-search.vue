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

  type SalesSearchFormParams = Api.Order.SalesSearchParams & {
    daterange?: string[]
  }

  interface Props {
    modelValue: SalesSearchFormParams
  }
  interface Emits {
    (e: 'update:modelValue', value: SalesSearchFormParams): void
    (e: 'search', params: SalesSearchFormParams): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const warehouseOptions = ref<{ label: string; value: string }[]>([])

  const loadOptions = async () => {
    const warehouses = await fetchGetWarehouseList()
    warehouseOptions.value = warehouses.map((item) => ({ label: item.name, value: item.id }))
  }

  const formItems = computed(() => [
    {
      label: '关键词',
      key: 'keyword',
      type: 'input',
      placeholder: '订单号/会员/收银员/商品',
      clearable: true
    },
    {
      label: '订单状态',
      key: 'status',
      type: 'select',
      placeholder: '请选择状态',
      props: {
        clearable: true,
        options: [
          { label: '已完成', value: 'paid' },
          { label: '部分退款', value: 'partial_refund' },
          { label: '已全额退款', value: 'refunded' },
          { label: '已取消', value: 'cancelled' }
        ]
      }
    },
    {
      label: '门店',
      key: 'warehouseId',
      type: 'select',
      placeholder: '请选择门店',
      props: { clearable: true, options: warehouseOptions.value }
    },
    {
      label: '下单日期',
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

  const handleSearch = async (params: SalesSearchFormParams) => {
    await searchBarRef.value.validate()
    emit('search', params)
  }

  onMounted(loadOptions)
</script>
