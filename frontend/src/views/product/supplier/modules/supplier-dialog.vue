<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑供应商' : '新增供应商'"
    width="640px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElRow :gutter="16">
        <ElCol :span="24">
          <ElFormItem label="供应商名称" prop="name">
            <ElInput v-model="formData.name" placeholder="请输入供应商名称" maxlength="50" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="联系人" prop="contact">
            <ElInput v-model="formData.contact" placeholder="请输入联系人" maxlength="30" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="联系电话" prop="phone">
            <ElInput v-model="formData.phone" placeholder="请输入联系电话" maxlength="20" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="地址" prop="address">
            <ElInput v-model="formData.address" placeholder="请输入地址" maxlength="100" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="合作状态" prop="status">
            <ElRadioGroup v-model="formData.status">
              <ElRadioButton value="1">合作中</ElRadioButton>
              <ElRadioButton value="2">停用</ElRadioButton>
            </ElRadioGroup>
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="备注" prop="remark">
            <ElInput v-model="formData.remark" type="textarea" :rows="2" placeholder="备注信息" />
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
  import { fetchCreateSupplier, fetchUpdateSupplier } from '@/api/product'
  import type { FormInstance, FormRules } from 'element-plus'

  type SupplierItem = Api.Product.SupplierItem

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    supplierData?: Partial<SupplierItem>
  }
  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    supplierData: () => ({})
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
    name: '',
    contact: '',
    phone: '',
    address: '',
    status: '1' as Api.Common.EnableStatus,
    remark: ''
  })

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入供应商名称', trigger: 'blur' },
      { min: 2, max: 50, message: '长度需在 2-50 个字符', trigger: 'blur' }
    ]
  }

  const initFormData = () => {
    const row = props.supplierData
    Object.assign(formData, {
      id: row?.id || '',
      name: row?.name || '',
      contact: row?.contact || '',
      phone: row?.phone || '',
      address: row?.address || '',
      status: row?.status ?? ('1' as Api.Common.EnableStatus),
      remark: row?.remark || ''
    })
  }

  watch(
    () => [props.visible, props.type, props.supplierData],
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
      const payload: Partial<SupplierItem> = {
        id: formData.id,
        name: formData.name,
        contact: formData.contact,
        phone: formData.phone,
        address: formData.address,
        status: formData.status,
        remark: formData.remark
      }
      if (isEdit.value) {
        await fetchUpdateSupplier(payload)
      } else {
        await fetchCreateSupplier(payload)
      }
      ElMessage.success(isEdit.value ? '供应商已更新' : '供应商已创建')
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }
</script>
