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
  import { fetchTenantOptions } from '@/api/tenant'

  interface Props {
    modelValue: Api.SystemManage.UserSearchParams
    /** 是否显示租户筛选（仅平台管理员跨租户视角） */
    showTenant?: boolean
  }
  interface Emits {
    (e: 'update:modelValue', value: Api.SystemManage.UserSearchParams): void
    (e: 'search', params: Api.SystemManage.UserSearchParams): void
    (e: 'reset'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const searchBarRef = ref()
  const formData = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val)
  })

  // 租户下拉选项（仅平台管理员展示并加载）
  const tenantOptions = ref<{ label: string; value: string }[]>([])
  onMounted(async () => {
    if (!props.showTenant) return
    try {
      const options = await fetchTenantOptions()
      tenantOptions.value = options.map((o) => ({ label: o.name, value: o.id }))
    } catch (error) {
      console.error(error)
    }
  })

  const handleSearch = async (params: Api.SystemManage.UserSearchParams) => {
    await searchBarRef.value.validate()
    emit('search', params)
  }

  const formItems = computed(() => [
    ...(props.showTenant
      ? [
          {
            label: '租户',
            key: 'tenantId',
            type: 'select',
            props: {
              placeholder: '请选择租户',
              clearable: true,
              options: tenantOptions.value,
              // 选中/清空即触发查询，无需再点查询按钮
              onChange: () => handleSearch({ ...props.modelValue })
            }
          }
        ]
      : []),
    {
      label: '用户名',
      key: 'userName',
      type: 'input',
      placeholder: '请输入用户名',
      clearable: true
    },
    {
      label: '手机号',
      key: 'userPhone',
      type: 'input',
      props: { placeholder: '请输入手机号', maxlength: '11' },
      clearable: true
    },
    {
      label: '邮箱',
      key: 'userEmail',
      type: 'input',
      props: { placeholder: '请输入邮箱' },
      clearable: true
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      props: {
        placeholder: '请选择状态',
        clearable: true,
        options: [
          { label: '启用', value: '1' },
          { label: '停用', value: '2' }
        ]
      }
    },
    {
      label: '性别',
      key: 'userGender',
      type: 'radiogroup',
      props: {
        options: [
          { label: '男', value: '男' },
          { label: '女', value: '女' }
        ]
      }
    }
  ])

  const handleReset = () => {
    emit('reset')
  }
</script>
