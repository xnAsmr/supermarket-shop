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
  interface Props {
    modelValue: Api.Product.SupplierSearchParams
  }
  interface Emits {
    (e: 'update:modelValue', value: Api.Product.SupplierSearchParams): void
    (e: 'search', params: Api.Product.SupplierSearchParams): void
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
      label: '供应商名称',
      key: 'name',
      type: 'input',
      placeholder: '请输入供应商名称',
      clearable: true
    },
    {
      label: '联系人',
      key: 'contact',
      type: 'input',
      placeholder: '请输入联系人',
      clearable: true
    },
    {
      label: '联系电话',
      key: 'phone',
      type: 'input',
      placeholder: '请输入联系电话',
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
          { label: '启用', value: '1' },
          { label: '停用', value: '2' }
        ]
      }
    }
  ])

  const handleReset = () => {
    emit('reset')
  }

  const handleSearch = async (params: Api.Product.SupplierSearchParams) => {
    await searchBarRef.value.validate()
    emit('search', params)
  }
</script>
