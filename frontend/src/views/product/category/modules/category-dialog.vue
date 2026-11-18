<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑分类' : '新增分类'"
    width="520px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElFormItem label="上级分类" prop="parentId">
        <ElSelect v-model="formData.parentId" placeholder="不选则为一级分类" clearable filterable>
          <ElOption
            v-for="item in parentOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
            :disabled="item.disabled"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="分类名称" prop="name">
        <ElInput v-model="formData.name" placeholder="请输入分类名称" maxlength="50" />
      </ElFormItem>
      <ElFormItem label="排序" prop="sort">
        <ElInputNumber v-model="formData.sort" :min="0" :precision="0" class="w-full" />
      </ElFormItem>
      <ElFormItem label="状态" prop="status">
        <ElRadioGroup v-model="formData.status">
          <ElRadioButton value="1">启用</ElRadioButton>
          <ElRadioButton value="2">停用</ElRadioButton>
        </ElRadioGroup>
      </ElFormItem>
    </ElForm>

    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchCreateCategory, fetchUpdateCategory } from '@/api/product'
  import type { FormInstance, FormRules } from 'element-plus'

  type CategoryItem = Api.Product.CategoryItem

  interface ParentOption {
    label: string
    value: string
    disabled?: boolean
  }

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    categoryData?: Partial<CategoryItem>
    parentOptions?: ParentOption[]
  }
  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    categoryData: () => ({}),
    parentOptions: () => []
  })
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const isEdit = computed(() => props.type === 'edit')

  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  const formData = reactive({
    id: '',
    parentId: '',
    name: '',
    sort: 0,
    status: '1' as Api.Common.EnableStatus
  })

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入分类名称', trigger: 'blur' },
      { min: 2, max: 50, message: '长度需在 2-50 个字符', trigger: 'blur' }
    ]
  }

  const initFormData = () => {
    const row = props.categoryData
    Object.assign(formData, {
      id: row?.id || '',
      parentId: row?.parentId || '',
      name: row?.name || '',
      sort: row?.sort ?? 0,
      status: row?.status ?? ('1' as Api.Common.EnableStatus)
    })
  }

  watch(
    () => [props.visible, props.type, props.categoryData],
    ([visible]) => {
      if (visible) {
        initFormData()
        nextTick(() => formRef.value?.clearValidate())
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      const payload: Partial<CategoryItem> = {
        id: formData.id,
        parentId: formData.parentId || null,
        name: formData.name,
        sort: formData.sort,
        status: formData.status
      }
      if (isEdit.value) {
        await fetchUpdateCategory(payload)
      } else {
        await fetchCreateCategory(payload)
      }
      ElMessage.success(isEdit.value ? '分类已更新' : '分类已创建')
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }
</script>
