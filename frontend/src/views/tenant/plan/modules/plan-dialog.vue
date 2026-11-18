<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑套餐' : '新增套餐'"
    width="640px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElRow :gutter="16">
        <ElCol :span="12">
          <ElFormItem label="套餐名称" prop="name">
            <ElInput v-model="formData.name" placeholder="请输入套餐名称" maxlength="50" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="套餐价格" prop="price">
            <ElInputNumber
              v-model="formData.price"
              :min="0"
              :precision="2"
              placeholder="请输入价格"
              class="w-full"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="时长（天）" prop="duration">
            <ElInputNumber
              v-model="formData.duration"
              :min="1"
              :precision="0"
              placeholder="如 365 表示一年"
              class="w-full"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="状态" prop="status">
            <ElRadioGroup v-model="formData.status">
              <ElRadioButton value="1">启用</ElRadioButton>
              <ElRadioButton value="2">停用</ElRadioButton>
            </ElRadioGroup>
          </ElFormItem>
        </ElCol>
        <ElCol :span="8">
          <ElFormItem label="用户上限" prop="userLimit">
            <ElInputNumber
              v-model="formData.userLimit"
              :min="0"
              :precision="0"
              placeholder="0 不限"
              class="w-full"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="8">
          <ElFormItem label="门店上限" prop="storeLimit">
            <ElInputNumber
              v-model="formData.storeLimit"
              :min="0"
              :precision="0"
              placeholder="0 不限"
              class="w-full"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="8">
          <ElFormItem label="商品上限" prop="productLimit">
            <ElInputNumber
              v-model="formData.productLimit"
              :min="0"
              :precision="0"
              placeholder="0 不限"
              class="w-full"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="套餐说明" prop="desc">
            <ElInput v-model="formData.desc" type="textarea" :rows="3" placeholder="套餐说明" />
          </ElFormItem>
        </ElCol>
      </ElRow>
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
  import { fetchCreatePlan, fetchUpdatePlan } from '@/api/tenant'
  import type { FormInstance, FormRules } from 'element-plus'

  type PlanItem = Api.Tenant.PlanItem

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    planData?: Partial<PlanItem>
  }

  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const props = defineProps<Props>()
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
    name: '',
    price: 0,
    duration: 365,
    userLimit: 10,
    storeLimit: 3,
    productLimit: 2000,
    status: '1' as Api.Common.EnableStatus,
    desc: ''
  })

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入套餐名称', trigger: 'blur' },
      { min: 2, max: 50, message: '长度需在 2-50 个字符', trigger: 'blur' }
    ],
    price: [{ required: true, message: '请输入套餐价格', trigger: 'blur' }],
    duration: [{ required: true, message: '请输入套餐时长', trigger: 'blur' }]
  }

  const initFormData = () => {
    const row = props.planData
    Object.assign(formData, {
      id: row?.id || '',
      name: row?.name || '',
      price: row?.price ?? 0,
      duration: row?.duration ?? 365,
      userLimit: row?.userLimit ?? 10,
      storeLimit: row?.storeLimit ?? 3,
      productLimit: row?.productLimit ?? 2000,
      status: row?.status ?? '1',
      desc: row?.desc || ''
    })
  }

  watch(
    () => [props.visible, props.type, props.planData],
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
      if (isEdit.value) {
        await fetchUpdatePlan({ ...formData })
      } else {
        await fetchCreatePlan({ ...formData })
      }
      ElMessage.success(isEdit.value ? '套餐已更新' : '套餐已创建')
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }
</script>
