<template>
  <ElDialog v-model="dialogVisible" title="发起退货" width="880px" align-center destroy-on-close>
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="88px">
      <ElTable :data="orderItems" size="small" border class="mb-4">
        <ElTableColumn prop="name" label="商品" min-width="150" show-overflow-tooltip />
        <ElTableColumn prop="barcode" label="条码" width="130" />
        <ElTableColumn label="单价" width="92" align="right">
          <template #default="{ row }">¥ {{ row.price.toFixed(2) }}</template>
        </ElTableColumn>
        <ElTableColumn prop="quantity" label="购买数量" width="86" align="right" />
        <ElTableColumn label="已退数量" width="86" align="right">
          <template #default="{ row }">{{ row.refundedQty || 0 }}</template>
        </ElTableColumn>
        <ElTableColumn label="可退数量" width="86" align="right">
          <template #default="{ row }">{{ refundableQty(row) }}</template>
        </ElTableColumn>
        <ElTableColumn label="本次退货" width="170">
          <template #default="{ row }">
            <ElInputNumber
              v-model="returnQuantities[row.productId]"
              :min="0"
              :max="refundableQty(row)"
              :precision="0"
              :disabled="refundableQty(row) <= 0"
              size="small"
            />
          </template>
        </ElTableColumn>
      </ElTable>

      <ElRow :gutter="16">
        <ElCol :span="12">
          <ElFormItem label="退款方式" prop="refundMethod">
            <ElRadioGroup v-model="formData.refundMethod">
              <ElRadioButton v-for="item in refundOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </ElRadioButton>
            </ElRadioGroup>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="预计退款">
            <span class="text-danger font-medium">¥ {{ refundAmount.toFixed(2) }}</span>
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="退货原因" prop="reason">
            <ElInput
              v-model="formData.reason"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              placeholder="请填写退货原因"
            />
          </ElFormItem>
        </ElCol>
      </ElRow>

      <ElAlert
        v-if="hasStoredPayment"
        type="warning"
        :closable="false"
        show-icon
        title="该订单包含储值卡支付，退款时储值卡部分将退回会员余额"
      />
    </ElForm>

    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit"> 确认退货 </ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchCreateReturn } from '@/api/order'
  import type { FormInstance, FormRules } from 'element-plus'

  type SalesOrder = Api.Order.SalesOrder

  interface Props {
    visible: boolean
    orderData?: Partial<SalesOrder>
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
  const returnQuantities = ref<Record<string, number>>({})

  const formData = reactive({
    refundMethod: 'cash' as Api.Order.PayMethod,
    reason: ''
  })

  /** 退款方式：现金退款 / 原路退回 */
  const refundOptions = [
    { value: 'cash' as Api.Order.PayMethod, label: '现金退款' },
    { value: 'bank' as Api.Order.PayMethod, label: '原路退回' }
  ]

  const orderItems = computed(() => props.orderData?.items ?? [])

  /** 可退数量 = 购买数量 - 已退数量 */
  const refundableQty = (row: Api.Order.OrderItem) =>
    Math.max(0, row.quantity - (row.refundedQty || 0))

  /** 订单是否含储值卡支付（退款需退回会员余额） */
  const hasStoredPayment = computed(() =>
    (props.orderData?.payments ?? []).some((p) => p.method === 'stored')
  )

  const refundAmount = computed(() =>
    orderItems.value.reduce(
      (sum, item) => sum + (returnQuantities.value[item.productId] || 0) * item.price,
      0
    )
  )

  const rules: FormRules = {
    reason: [{ required: true, message: '请填写退货原因', trigger: 'blur' }]
  }

  const initQuantities = () => {
    const quantities: Record<string, number> = {}
    orderItems.value.forEach((item) => {
      quantities[item.productId] = 0
    })
    returnQuantities.value = quantities
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible) {
        initQuantities()
        formData.refundMethod = 'cash'
        formData.reason = ''
        nextTick(() => formRef.value?.clearValidate())
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    const items = orderItems.value
      .filter((item) => (returnQuantities.value[item.productId] || 0) > 0)
      .map((item) => ({
        productId: item.productId,
        quantity: returnQuantities.value[item.productId]
      }))

    if (!items.length) {
      ElMessage.warning('请设置需要退货的商品数量')
      return
    }

    submitting.value = true
    try {
      await fetchCreateReturn({
        orderId: props.orderData?.id || '',
        items,
        refundMethod: formData.refundMethod,
        reason: formData.reason
      })
      ElMessage.success('退货成功，库存与支付账户已同步回退')
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }
</script>
