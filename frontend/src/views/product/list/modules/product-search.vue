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
  import { fetchGetCategoryOptions, fetchGetSupplierOptions } from '@/api/product'

  interface Props {
    modelValue: Api.Product.ProductSearchParams
  }
  interface Emits {
    (e: 'update:modelValue', value: Api.Product.ProductSearchParams): void
    (e: 'search', params: Api.Product.ProductSearchParams): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const categoryOptions = ref<{ label: string; value: string }[]>([])
  const supplierOptions = ref<{ label: string; value: string }[]>([])

  const loadOptions = async () => {
    const [categories, suppliers] = await Promise.all([
      fetchGetCategoryOptions(),
      fetchGetSupplierOptions()
    ])
    categoryOptions.value = categories.map((item) => ({ label: item.name, value: item.id }))
    supplierOptions.value = suppliers.map((item) => ({ label: item.name, value: item.id }))
  }

  const formItems = computed(() => [
    {
      label: '商品名称',
      key: 'name',
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
      label: '商品分类',
      key: 'categoryId',
      type: 'select',
      placeholder: '请选择分类',
      props: { clearable: true, options: categoryOptions.value }
    },
    {
      label: '供应商',
      key: 'supplierId',
      type: 'select',
      placeholder: '请选择供应商',
      props: { clearable: true, options: supplierOptions.value }
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      placeholder: '请选择状态',
      props: {
        clearable: true,
        options: [
          { label: '在售', value: '1' },
          { label: '停售', value: '2' }
        ]
      }
    }
  ])

  const handleReset = () => {
    emit('reset')
  }

  const handleSearch = async (params: Api.Product.ProductSearchParams) => {
    await searchBarRef.value.validate()
    emit('search', params)
  }

  onMounted(loadOptions)
</script>
