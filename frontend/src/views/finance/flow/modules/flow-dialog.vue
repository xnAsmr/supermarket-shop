<template>
  <ElDialog v-model="dialogVisible" title="记一笔收支" width="560px" align-center destroy-on-close>
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="88px">
      <ElFormItem label="收支类型" prop="type">
        <ElRadioGroup v-model="formData.type">
          <ElRadioButton value="income">收入</ElRadioButton>
          <ElRadioButton value="expense">支出</ElRadioButton>
        </ElRadioGroup>
      </ElFormItem>
      <ElFormItem label="收支分类" prop="category">
        <ElSelect v-model="formData.category" placeholder="请选择分类">
          <ElOption
            v-for="item in categoryOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="金额" prop="amount">
        <ElInputNumber
          v-model="formData.amount"
          :min="0.01"
          :precision="2"
          :controls="false"
          placeholder="请输入金额"
          class="w-full"
        />
      </ElFormItem>
      <ElFormItem label="支付方式" prop="method">
        <ElSelect v-model="formData.method" placeholder="请选择方式">
          <ElOption
            v-for="item in methodOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </ElSelect>
      </ElFormItem>
      <ElFormItem label="关联单号" prop="relatedNo">
        <ElInput v-model="formData.relatedNo" placeholder="选填，如采购单/订单号" clearable />
      </ElFormItem>
      <ElFormItem label="备注" prop="remark">
        <ElInput
          v-model="formData.remark"
          type="textarea"
          :rows="2"
          maxlength="100"
          placeholder="备注信息"
        />
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
  import { fetchCreateFlow, FLOW_CATEGORIES } from '@/api/finance'
  import type { FormInstance, FormRules } from 'element-plus'

  interface Props {
    visible: boolean
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

  const formRef = ref<FormInstance>()
  const submitting = ref(false)

  const formData = reactive({
    type: 'income' as Api.Finance.FlowType,
    category: '',
    amount: 0,
    method: '现金',
    relatedNo: '',
    remark: ''
  })

  const methodOptions = [
    { label: '现金', value: '现金' },
    { label: '银行转账', value: '银行转账' },
    { label: '微信', value: '微信' },
    { label: '支付宝', value: '支付宝' }
  ]

  const categoryOptions = computed(() =>
    (FLOW_CATEGORIES[formData.type] as readonly string[]).map((item) => ({
      label: item,
      value: item
    }))
  )

  const rules: FormRules = {
    type: [{ required: true, message: '请选择收支类型', trigger: 'change' }],
    category: [{ required: true, message: '请选择收支分类', trigger: 'change' }],
    amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
    method: [{ required: true, message: '请选择支付方式', trigger: 'change' }]
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible) {
        Object.assign(formData, {
          type: 'income',
          category: '',
          amount: 0,
          method: '现金',
          relatedNo: '',
          remark: ''
        })
        nextTick(() => formRef.value?.clearValidate())
      }
    },
    { immediate: true }
  )

  watch(
    () => formData.type,
    () => {
      formData.category = ''
    }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    submitting.value = true
    try {
      await fetchCreateFlow({
        type: formData.type,
        category: formData.category,
        amount: formData.amount,
        method: formData.method,
        relatedNo: formData.relatedNo,
        remark: formData.remark
      })
      ElMessage.success('记账成功')
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }
</script>
