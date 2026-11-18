<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑门店' : '新增门店'"
    width="720px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElRow :gutter="16">
        <ElCol :span="12">
          <ElFormItem label="门店名称" prop="name">
            <ElInput v-model="formData.name" placeholder="请输入门店/品牌名称" maxlength="50" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="门店编码" prop="code">
            <ElInput v-model="formData.code" placeholder="留空自动生成" maxlength="32" />
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
          <ElFormItem label="门店地址" prop="address">
            <ElInput v-model="formData.address" placeholder="请输入门店地址" maxlength="100" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="所属套餐" prop="planId">
            <ElSelect v-model="formData.planId" placeholder="请选择套餐" filterable>
              <ElOption
                v-for="item in planOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="到期时间" prop="expireTime">
            <ElDatePicker
              v-model="formData.expireTime"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="请选择到期时间"
              class="!w-full"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="状态" prop="status">
            <ElRadioGroup v-model="formData.status">
              <ElRadioButton value="1">正常</ElRadioButton>
              <ElRadioButton value="2">停用</ElRadioButton>
              <ElRadioButton value="3">过期</ElRadioButton>
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
  import { fetchCreateTenant, fetchUpdateTenant, fetchPlanList } from '@/api/tenant'
  import type { FormInstance, FormRules } from 'element-plus'

  type TenantItem = Api.Tenant.TenantItem

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    tenantData?: Partial<TenantItem>
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
  const planOptions = ref<{ label: string; value: string }[]>([])

  const formData = reactive({
    id: '',
    name: '',
    code: '',
    contact: '',
    phone: '',
    address: '',
    status: '1' as Api.Tenant.TenantStatus,
    planId: '',
    expireTime: '',
    remark: ''
  })

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入门店/品牌名称', trigger: 'blur' },
      { min: 2, max: 50, message: '长度需在 2-50 个字符', trigger: 'blur' }
    ],
    planId: [{ required: true, message: '请选择所属套餐', trigger: 'change' }],
    expireTime: [{ required: true, message: '请选择到期时间', trigger: 'change' }]
  }

  const nextYearStr = () => {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${m}-${day}`
  }

  const initFormData = () => {
    const row = props.tenantData
    Object.assign(formData, {
      id: row?.id || '',
      name: row?.name || '',
      code: row?.code || '',
      contact: row?.contact || '',
      phone: row?.phone || '',
      address: row?.address || '',
      status: row?.status ?? '1',
      planId: row?.planId || planOptions.value[0]?.value || '',
      expireTime: row?.expireTime ? row.expireTime.slice(0, 10) : nextYearStr(),
      remark: row?.remark || ''
    })
  }

  const loadOptions = async () => {
    try {
      const res = await fetchPlanList({ current: 1, size: 100 })
      planOptions.value = res.records.map((item) => ({ label: item.name, value: item.id }))
    } catch (error) {
      console.error(error)
    }
  }

  watch(
    () => [props.visible, props.type, props.tenantData],
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
        await fetchUpdateTenant({ ...formData })
      } else {
        await fetchCreateTenant({ ...formData })
      }
      ElMessage.success(isEdit.value ? '门店已更新' : '门店已创建')
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }

  onMounted(loadOptions)
</script>
