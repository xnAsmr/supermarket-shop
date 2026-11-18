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
  type ReturnSearchFormParams = Api.Order.ReturnSearchParams

  interface Props {
    modelValue: ReturnSearchFormParams
  }
  interface Emits {
    (e: 'update:modelValue', value: ReturnSearchFormParams): void
    (e: 'search', params: ReturnSearchFormParams): void
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
      label: '退货单号',
      key: 'returnNo',
      type: 'input',
      placeholder: '请输入退货单号',
      clearable: true
    },
    {
      label: '原订单号',
      key: 'orderNo',
      type: 'input',
      placeholder: '请输入原订单号',
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
          { label: '待处理', value: 'pending' },
          { label: '已完成', value: 'completed' },
          { label: '已驳回', value: 'rejected' }
        ]
      }
    }
  ])

  const handleReset = () => {
    emit('reset')
  }

  const handleSearch = async (params: ReturnSearchFormParams) => {
    await searchBarRef.value.validate()
    emit('search', params)
  }
</script>
