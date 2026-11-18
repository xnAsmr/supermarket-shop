<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑支付账户' : '新增支付账户'"
    width="560px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElRow :gutter="16">
        <ElCol :span="24">
          <ElFormItem label="账户名称" prop="name">
            <ElInput
              v-model="formData.name"
              placeholder="如：现金 / 微信支付 / 建设银行柘城支行"
              maxlength="50"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="支付编码" prop="code">
            <ElInput
              v-model="formData.code"
              placeholder="cash / wechat / alipay / card 等"
              maxlength="30"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="排序" prop="sort">
            <ElInputNumber
              v-model="formData.sort"
              :min="0"
              :max="999"
              :controls="false"
              class="!w-full"
              placeholder="数字越小越靠前"
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
  import { fetchCreatePaymentAccount, fetchUpdatePaymentAccount } from '@/api/finance'
  import type { FormInstance, FormRules } from 'element-plus'

  type AccountItem = Api.Finance.PaymentAccountItem

  interface Props {
    visible: boolean
    type: 'add' | 'edit'
    accountData?: Partial<AccountItem>
  }
  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    accountData: () => ({})
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
    code: '',
    sort: 1,
    status: '1' as Api.Common.EnableStatus,
    remark: ''
  })

  const rules: FormRules = {
    name: [
      { required: true, message: '请输入账户名称', trigger: 'blur' },
      { min: 2, max: 50, message: '长度需在 2-50 个字符', trigger: 'blur' }
    ],
    code: [
      { required: true, message: '请输入支付编码', trigger: 'blur' },
      {
        pattern: /^[a-z][a-z0-9_]*$/,
        message: '只能由小写字母/数字/下划线组成，且以字母开头',
        trigger: 'blur'
      }
    ]
  }

  const initFormData = () => {
    const row = props.accountData
    Object.assign(formData, {
      id: row?.id || '',
      name: row?.name || '',
      code: row?.code || '',
      sort: row?.sort ?? 1,
      status: row?.status ?? ('1' as Api.Common.EnableStatus),
      remark: row?.remark || ''
    })
  }

  watch(
    () => [props.visible, props.type, props.accountData],
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
      const payload: Api.Finance.PaymentAccountUpsertPayload = {
        id: formData.id,
        name: formData.name,
        code: formData.code,
        sort: formData.sort,
        status: formData.status,
        remark: formData.remark
      }
      if (isEdit.value) {
        await fetchUpdatePaymentAccount(payload)
      } else {
        await fetchCreatePaymentAccount(payload)
      }
      ElMessage.success(isEdit.value ? '账户已更新' : '账户已创建')
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }
</script>
