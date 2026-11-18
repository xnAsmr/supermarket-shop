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
  import { fetchGetCategoryOptions } from '@/api/product'
  import { WARN_LEVEL_OPTIONS } from '@/views/warehouse/modules/shelf-status'

  interface Props {
    modelValue: Api.Warehouse.StockSearchParams
  }
  interface Emits {
    (e: 'update:modelValue', value: Api.Warehouse.StockSearchParams): void
    (e: 'search', params: Api.Warehouse.StockSearchParams): void
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
  const categoryOptions = ref<{ label: string; value: string }[]>([])

  const loadOptions = async () => {
    const [warehouses, categories] = await Promise.all([
      fetchGetWarehouseList(),
      fetchGetCategoryOptions()
    ])
    warehouseOptions.value = warehouses
      .filter((item) => item.status === '1')
      .map((item) => ({ label: item.name, value: item.id }))
    categoryOptions.value = categories.map((item) => ({ label: item.name, value: item.id }))
  }

  const formItems = computed(() => [
    {
      label: '商品名称',
      key: 'productName',
      type: 'input',
      placeholder: '请输入商品名称',
      clearable: true
    },
    {
      label: '商品条码',
      key: 'barcode',
      type: 'input',
      placeholder: '请输入条码',
      clearable: true
    },
    {
      label: '仓库',
      key: 'warehouseId',
      type: 'select',
      placeholder: '请选择仓库',
      props: { clearable: true, options: warehouseOptions.value }
    },
    {
      label: '商品分类',
      key: 'categoryId',
      type: 'select',
      placeholder: '请选择分类',
      props: { clearable: true, options: categoryOptions.value }
    },
    {
      label: '预警筛选',
      key: 'warnLevel',
      type: 'select',
      placeholder: '全部',
      props: {
        clearable: true,
        options: WARN_LEVEL_OPTIONS
      }
    }
  ])

  const handleReset = () => {
    emit('reset')
  }

  const handleSearch = async (params: Api.Warehouse.StockSearchParams) => {
    await searchBarRef.value.validate()
    emit('search', params)
  }

  onMounted(loadOptions)
</script>
