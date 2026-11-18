<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑采购退货单' : '新建采购退货单'"
    width="1020px"
    align-center
    destroy-on-close
    top="6vh"
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElRow :gutter="16">
        <ElCol :span="12">
          <ElFormItem label="来源采购单" prop="orderId">
            <ElSelect
              v-model="formData.orderId"
              placeholder="请选择来源采购订单（可手工退货）"
              filterable
              clearable
              :disabled="isEdit"
              @change="handleOrderChange"
            >
              <ElOption
                v-for="item in orderOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="退货门店" prop="storeId">
            <ElSelect v-model="formData.storeId" placeholder="请选择退货门店" filterable>
              <ElOption
                v-for="item in storeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="退货原因" prop="reason">
            <ElInput v-model="formData.reason" placeholder="请填写退货原因" maxlength="200" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="备注" prop="remark">
            <ElInput v-model="formData.remark" type="textarea" :rows="2" placeholder="备注信息" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="退货明细" prop="items">
            <div class="w-full">
              <div class="mb-2 flex items-center gap-2 text-xs text-gray-400">
                <span class="flex-1">商品</span>
                <span class="w-24">可退数量</span>
                <span class="w-28">本次退货</span>
                <span class="w-24">单价</span>
                <span class="w-16">操作</span>
              </div>
              <div
                v-for="(item, index) in formData.items"
                :key="item.key"
                class="mb-2 flex items-center gap-2"
              >
                <ElSelect
                  v-model="item.productId"
                  class="flex-1"
                  placeholder="输入名称/条码搜索商品"
                  filterable
                  remote
                  :remote-method="handleProductSearch"
                  :loading="productLoading"
                  @change="() => handleProductChange(item)"
                >
                  <ElOption
                    v-for="product in productOptions"
                    :key="product.id"
                    :label="`${product.name}（${product.barcode}）`"
                    :value="product.id"
                  />
                </ElSelect>
                <span class="w-24 text-sm">{{ item.returnableQty ?? '-' }}</span>
                <ElInputNumber
                  v-model="item.quantity"
                  class="w-28"
                  :min="0"
                  :max="item.returnableQty ?? undefined"
                  :precision="0"
                />
                <span class="w-24 text-sm">¥ {{ item.purchasePrice.toFixed(2) }}</span>
                <ElButton type="danger" link @click="removeItem(index)">删除</ElButton>
              </div>
              <ElButton type="primary" plain @click="addItem">添加商品</ElButton>
            </div>
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <div class="text-right text-sm text-gray-500">
            共 {{ formData.items.length }} 项，本次退货数量 {{ totalQuantity }}，退货金额：
            <span class="text-base font-medium text-theme">¥ {{ totalAmount }}</span>
          </div>
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
  import {
    fetchCreatePurchaseReturn,
    fetchGetPurchaseOrderDetail,
    fetchGetPurchaseOrderList,
    fetchGetPurchaseReturnDetail,
    fetchGetReturnableItems,
    fetchUpdatePurchaseReturn
  } from '@/api/purchase-order'
  import { fetchGetProductOptions } from '@/api/product'
  import { fetchGetWarehouseList } from '@/api/warehouse'
  import type { FormInstance, FormRules } from 'element-plus'

  type ProductItem = Api.Product.ProductItem

  interface ReturnItemForm {
    key: number
    orderItemId: string
    receiptItemId: string
    productId: string
    /** 可退数量（来源采购单时有效） */
    returnableQty?: number
    quantity: number
    purchasePrice: number
  }

  interface Props {
    visible: boolean
    /** 编辑时的采购退货单ID（为空则为新建） */
    returnId?: string
    /** 预置的来源采购订单ID */
    orderId?: string
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

  const isEdit = computed(() => Boolean(props.returnId))

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const productLoading = ref(false)

  const orderOptions = ref<{ label: string; value: string }[]>([])
  const storeOptions = ref<{ label: string; value: string }[]>([])
  const productOptions = ref<ProductItem[]>([])
  const productCache = ref(new Map<string, ProductItem>())

  const formData = reactive({
    orderId: '',
    storeId: '',
    supplierId: '',
    reason: '',
    remark: '',
    items: [] as ReturnItemForm[]
  })

  let itemKey = 0

  const rules: FormRules = {
    reason: [{ required: true, message: '请填写退货原因', trigger: 'blur' }],
    storeId: [{ required: true, message: '请选择退货门店', trigger: 'change' }],
    items: [
      {
        validator: (rule, value, callback) => {
          if (!formData.items.length) {
            callback(new Error('请至少添加一行退货明细'))
            return
          }
          if (formData.items.some((item) => !item.productId)) {
            callback(new Error('请选择完整的商品'))
            return
          }
          if (formData.items.every((item) => (item.quantity || 0) <= 0)) {
            callback(new Error('请填写本次退货数量'))
            return
          }
          callback()
        },
        trigger: 'change'
      }
    ]
  }

  const totalQuantity = computed(() =>
    formData.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
  )

  const totalAmount = computed(() =>
    formData.items
      .reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.purchasePrice) || 0),
        0
      )
      .toFixed(2)
  )

  const addItem = () => {
    formData.items.push({
      key: ++itemKey,
      orderItemId: '',
      receiptItemId: '',
      productId: '',
      quantity: 1,
      purchasePrice: 0
    })
  }

  const removeItem = (index: number) => {
    formData.items.splice(index, 1)
  }

  const handleProductSearch = async (keyword: string) => {
    productLoading.value = true
    try {
      const list = await fetchGetProductOptions(keyword)
      list.forEach((item) => productCache.value.set(item.id, item))
      productOptions.value = list
    } catch (error) {
      console.error(error)
    } finally {
      productLoading.value = false
    }
  }

  const handleProductChange = (item: ReturnItemForm) => {
    const product = productCache.value.get(item.productId)
    item.purchasePrice = product?.purchasePrice ?? 0
  }

  const loadOptions = async () => {
    const [warehouses] = await Promise.all([fetchGetWarehouseList()])
    storeOptions.value = warehouses
      .filter((item) => item.status === '1')
      .map((item) => ({ label: item.name, value: item.id }))

    // 可作为来源的采购订单：已审核及之后（有已收数量才可退）
    const statuses: Api.Purchase.PurchaseOrderStatus[] = [
      'approved',
      'partially_received',
      'completed',
      'partially_returned',
      'returned'
    ]
    const pages = await Promise.all(
      statuses.map((status) => fetchGetPurchaseOrderList({ current: 1, size: 200, status }))
    )
    orderOptions.value = pages
      .flatMap((page) => page.records)
      .map((item) => ({ label: `${item.orderNo}（${item.supplierName}）`, value: item.id }))
  }

  /** 选择来源采购订单后自动带出可退明细 */
  const handleOrderChange = async (orderId: string) => {
    if (!orderId) {
      formData.items = []
      return
    }
    try {
      const [items, order] = await Promise.all([
        fetchGetReturnableItems(orderId),
        fetchGetPurchaseOrderDetail(orderId)
      ])
      formData.storeId = order.storeId
      formData.supplierId = order.supplierId
      formData.items = items.map((it) => {
        productCache.value.set(it.productId, {
          id: it.productId,
          barcode: it.barcode,
          name: it.productName,
          unit: it.unit,
          spec: it.spec,
          purchasePrice: it.purchasePrice
        } as ProductItem)
        return {
          key: ++itemKey,
          orderItemId: it.id,
          receiptItemId: '',
          productId: it.productId,
          returnableQty: Math.max(0, it.receivedQty - it.returnedQty),
          quantity: 0,
          purchasePrice: it.purchasePrice
        }
      })
    } catch (error) {
      console.error(error)
    }
  }

  /** 编辑时回填明细 */
  const loadReturnDetail = async (id: string) => {
    try {
      const detail = await fetchGetPurchaseReturnDetail(id)
      formData.orderId = detail.orderId
      formData.storeId = detail.storeId
      formData.supplierId = detail.supplierId
      formData.reason = detail.reason
      formData.remark = detail.remark
      formData.items = detail.items.map((it) => {
        productCache.value.set(it.productId, {
          id: it.productId,
          barcode: it.barcode,
          name: it.productName,
          unit: it.unit,
          spec: it.spec,
          purchasePrice: it.purchasePrice
        } as ProductItem)
        return {
          key: ++itemKey,
          orderItemId: it.orderItemId,
          receiptItemId: it.receiptItemId,
          productId: it.productId,
          quantity: it.quantity,
          purchasePrice: it.purchasePrice
        }
      })
    } catch (error) {
      console.error(error)
    }
  }

  const initFormData = () => {
    formData.orderId = ''
    formData.storeId = ''
    formData.supplierId = ''
    formData.reason = ''
    formData.remark = ''
    formData.items = []
    addItem()
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible) {
        initFormData()
        loadOptions()
        handleProductSearch('')
        if (props.returnId) {
          loadReturnDetail(props.returnId)
        } else if (props.orderId) {
          formData.orderId = props.orderId
          handleOrderChange(props.orderId)
        }
        nextTick(() => formRef.value?.clearValidate())
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    const items = formData.items.filter((item) => (item.quantity || 0) > 0)
    if (!items.length) {
      ElMessage.warning('请填写本次退货数量')
      return
    }

    submitting.value = true
    try {
      const payload: Partial<Api.Purchase.PurchaseReturn> = {
        orderId: formData.orderId,
        storeId: formData.storeId,
        supplierId: formData.supplierId,
        reason: formData.reason,
        remark: formData.remark,
        items: items.map((item) => {
          const product = productCache.value.get(item.productId)
          return {
            id: '',
            orderItemId: item.orderItemId,
            receiptItemId: item.receiptItemId,
            productId: item.productId,
            productName: product?.name ?? '',
            barcode: product?.barcode ?? '',
            spec: product?.spec ?? '',
            unit: product?.unit ?? '',
            quantity: Number(item.quantity) || 0,
            purchasePrice: Number(item.purchasePrice) || 0,
            totalPrice:
              Math.round((Number(item.quantity) || 0) * (Number(item.purchasePrice) || 0) * 100) /
              100
          }
        })
      }
      if (props.returnId) {
        await fetchUpdatePurchaseReturn(props.returnId, payload)
        ElMessage.success('采购退货单已更新')
      } else {
        await fetchCreatePurchaseReturn(payload)
        ElMessage.success('采购退货单已创建')
      }
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }
</script>
