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
    modelValue: Api.Product.CategorySearchParams
  }
  interface Emits {
    (e: 'update:modelValue', value: Api.Product.CategorySearchParams): void
    (e: 'search', params: Api.Product.CategorySearchParams): void
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
      label: '分类名称',
      key: 'name',
      type: 'input',
      placeholder: '请输入分类名称',
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

  const handleSearch = async (params: Api.Product.CategorySearchParams) => {
    await searchBarRef.value.validate()
    emit('search', params)
  }
</script>
