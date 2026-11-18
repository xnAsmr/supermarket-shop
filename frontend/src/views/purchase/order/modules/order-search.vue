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
  import { fetchGetSupplierOptions } from '@/api/product'
  import { fetchGetWarehouseList } from '@/api/warehouse'
  import { PURCHASE_ORDER_STATUS } from '../../modules/purchase-status'

  type SearchFormParams = Api.Purchase.PurchaseOrderSearchParams & {
    daterange?: string[]
  }

  interface Props {
    modelValue: SearchFormParams
  }
  interface Emits {
    (e: 'update:modelValue', value: SearchFormParams): void
    (e: 'search', params: Api.Purchase.PurchaseOrderSearchParams): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const supplierOptions = ref<{ label: string; value: string }[]>([])
  const storeOptions = ref<{ label: string; value: string }[]>([])

  const loadOptions = async () => {
    const [suppliers, warehouses] = await Promise.all([
      fetchGetSupplierOptions(),
      fetchGetWarehouseList()
    ])
    supplierOptions.value = suppliers.map((item) => ({ label: item.name, value: item.id }))
    storeOptions.value = warehouses
      .filter((item) => item.status === '1')
      .map((item) => ({ label: item.name, value: item.id }))
  }

  const formItems = computed(() => [
    {
      label: '采购单号',
      key: 'orderNo',
      type: 'input',
      placeholder: '请输入采购单号',
      clearable: true
    },
    {
      label: '供应商',
      key: 'supplierId',
      type: 'select',
      placeholder: '请选择供应商',
      props: { clearable: true, options: supplierOptions.value }
    },
    {
      label: '收货门店',
      key: 'storeId',
      type: 'select',
      placeholder: '请选择收货门店',
      props: { clearable: true, options: storeOptions.value }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      placeholder: '请选择状态',
      props: {
        clearable: true,
        options: Object.entries(PURCHASE_ORDER_STATUS).map(
          ([value, item]: [string, { text: string }]) => ({
            label: item.text,
            value
          })
        )
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
