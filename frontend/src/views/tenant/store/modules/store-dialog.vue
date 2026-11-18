<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑门店' : '新增门店'"
    width="640px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElRow :gutter="16">
        <ElCol v-if="!isEdit" :span="12">
          <ElFormItem label="所属客户" prop="tenantId">
            <ElSelect
              v-model="formData.tenantId"
              placeholder="请选择客户（租户）"
              filterable
              class="!w-full"
            >
              <ElOption v-for="t in tenantOptions" :key="t.id" :label="t.name" :value="t.id" />
            </ElSelect>
          </ElFormItem>
        </ElCol>
        <ElCol :span="isEdit ? 24 : 12">
          <ElFormItem label="门店名称" prop="storeName">
            <ElInput v-model="formData.storeName" placeholder="请输入门店名称" maxlength="50" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="门店类型" prop="storeType">
            <ElRadioGroup v-model="formData.storeType">
              <ElRadioButton value="1">直营</ElRadioButton>
              <ElRadioButton value="2">加盟</ElRadioButton>
            </ElRadioGroup>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="联系电话" prop="contactPhone">
            <ElInput v-model="formData.contactPhone" placeholder="请输入联系电话" maxlength="20" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="营业时间" prop="businessHours">
            <ElInput v-model="formData.businessHours" placeholder="如 08:00-22:00" maxlength="30" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="门店地址" prop="address">
            <ElInput v-model="formData.address" placeholder="请输入门店地址" maxlength="100" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="排序" prop="sort">
            <ElInputNumber v-model="formData.sort" :min="0" :max="9999" class="!w-full" />
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
  import { fetchCreateStore, fetchUpdateStore, fetchTenantOptions } from '@/api/tenant'
  import type { FormInstance, FormRules } from 'element-plus'

  type StoreItem = Api.Tenant.StoreItem

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    storeData?: Partial<StoreItem>
    tenantId?: string
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
  const tenantOptions = ref<Api.Tenant.TenantOption[]>([])

  const formData = reactive({
    id: '',
    tenantId: '',
    storeName: '',
    storeType: '1' as Api.Tenant.StoreType,
    contactPhone: '',
    businessHours: '',
    address: '',
    sort: 0,
    remark: ''
  })

  const rules: FormRules = {
    tenantId: [{ required: true, message: '请选择所属客户', trigger: 'change' }],
    storeName: [
      { required: true, message: '请输入门店名称', trigger: 'blur' },
      { min: 2, max: 50, message: '长度需在 2-50 个字符', trigger: 'blur' }
    ]
  }

  const initFormData = () => {
    const row = props.storeData
    Object.assign(formData, {
      id: row?.id || '',
      tenantId: row?.tenantId || props.tenantId || '',
      storeName: row?.storeName || '',
      storeType: row?.storeType ?? '1',
      contactPhone: row?.contactPhone || '',
      businessHours: row?.businessHours || '',
      address: row?.address || '',
      sort: row?.sort ?? 0,
      remark: row?.remark || ''
    })
  }

  const loadTenants = async () => {
    try {
      tenantOptions.value = await fetchTenantOptions()
    } catch {
      tenantOptions.value = []
    }
  }

  watch(
    () => [props.visible, props.type, props.storeData, props.tenantId],
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
        await fetchUpdateStore({ ...formData })
      } else {
        await fetchCreateStore({ ...formData })
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

  onMounted(loadTenants)
</script>
