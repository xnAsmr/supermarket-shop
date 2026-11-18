<template>
  <ElDialog v-model="dialogVisible" title="会员充值" width="480px" align-center destroy-on-close>
    <div v-if="member" class="mb-4 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
      <p class="mb-1">
        <span class="text-gray-500">会员：</span>
        {{ member.name }}（{{ member.phone }}）
      </p>
      <p>
        <span class="text-gray-500">当前余额：</span>
        <span class="font-medium text-theme">¥ {{ member.balance.toFixed(2) }}</span>
      </p>
    </div>

    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="88px">
      <ElFormItem label="充值金额" prop="amount">
        <ElInputNumber
          v-model="formData.amount"
          :min="0.01"
          :max="999999"
          :precision="2"
          :step="100"
          placeholder="请输入充值金额"
          style="width: 100%"
        />
      </ElFormItem>
      <ElFormItem label="赠送金额" prop="giftAmount">
        <ElInputNumber
          v-model="formData.giftAmount"
          :min="0"
          :max="999999"
          :precision="2"
          :step="10"
          placeholder="活动赠送（选填）"
          style="width: 100%"
        />
      </ElFormItem>
      <ElFormItem label="支付方式" prop="payMethod">
        <ElSelect v-model="formData.payMethod" placeholder="请选择支付方式">
          <ElOption
            v-for="item in PAY_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="备注" prop="remark">
        <ElInput
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          placeholder="备注信息（选填）"
          maxlength="200"
        />
      </ElFormItem>
      <div class="text-right text-sm text-gray-500">
        实际到账：
        <span class="text-base font-medium text-theme">¥ {{ receivedAmount }}</span>
      </div>
    </ElForm>

    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定充值</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchRechargeMember } from '@/api/member'
  import type { FormInstance, FormRules } from 'element-plus'

  type MemberItem = Api.Member.MemberItem

  interface Props {
    visible: boolean
    member?: MemberItem | null
  }
  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  const props = withDefaults(defineProps<Props>(), {
    member: null
  })
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const PAY_OPTIONS = [
    { label: '现金', value: 'cash' },
    { label: '微信', value: 'wechat' },
    { label: '支付宝', value: 'alipay' },
    { label: '银行卡', value: 'card' }
  ]

  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  const formData = reactive({
    amount: undefined as number | undefined,
    giftAmount: 0,
    payMethod: 'cash',
    remark: ''
  })

  const receivedAmount = computed(() => {
    const amount = Number(formData.amount) || 0
    const gift = Number(formData.giftAmount) || 0
    return (amount + gift).toFixed(2)
  })

  const rules: FormRules = {
    amount: [
      {
        validator: (rule, value, callback) => {
          if (!value || Number(value) <= 0) {
            callback(new Error('请输入充值金额'))
            return
          }
          callback()
        },
        trigger: 'change'
      }
    ],
    payMethod: [{ required: true, message: '请选择支付方式', trigger: 'change' }]
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible) {
        formData.amount = undefined
        formData.giftAmount = 0
        formData.payMethod = 'cash'
        formData.remark = ''
        nextTick(() => formRef.value?.clearValidate())
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (!formRef.value || !props.member) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      await fetchRechargeMember(String(props.member.id), {
        amount: Number(formData.amount) || 0,
        giftAmount: Number(formData.giftAmount) || 0,
        payMethod: formData.payMethod,
        remark: formData.remark
      })
      ElMessage.success('充值成功')
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }
</script>
