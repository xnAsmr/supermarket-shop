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
  type MemberSearchFormParams = Api.Member.MemberSearchParams

  interface Props {
    modelValue: MemberSearchFormParams
  }
  interface Emits {
    (e: 'update:modelValue', value: MemberSearchFormParams): void
    (e: 'search', params: MemberSearchFormParams): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  const LEVEL_OPTIONS = [
    { label: '普通会员', value: '1' },
    { label: '银卡会员', value: '2' },
    { label: '金卡会员', value: '3' },
    { label: '钻石会员', value: '4' }
  ]

  const formItems = computed(() => [
    {
      label: '关键字',
      key: 'keyword',
      type: 'input',
      placeholder: '会员姓名 / 手机号 / 会员编号',
      clearable: true
    },
    {
      label: '会员等级',
      key: 'levelId',
      type: 'select',
      placeholder: '请选择会员等级',
      props: { clearable: true, options: LEVEL_OPTIONS }
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
          { label: '停用', value: '2' }
        ]
      }
    }
  ])

  const handleReset = () => {
    emit('reset')
  }

  const handleSearch = async (params: MemberSearchFormParams) => {
    await searchBarRef.value.validate()
    emit('search', params)
  }
</script>
