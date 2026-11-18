<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑采购订单' : '新建采购订单'"
    width="960px"
    align-center
    destroy-on-close
    top="6vh"
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElRow :gutter="16">
        <ElCol :span="12">
          <ElFormItem label="供应商" prop="supplierId">
            <ElSelect v-model="formData.supplierId" placeholder="请选择供应商" filterable>
              <ElOption
                v-for="item in supplierOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
        </ElCol>
        <ElCol :span="12">
          <ElFormItem label="收货门店" prop="storeId">
            <ElSelect v-model="formData.storeId" placeholder="请选择收货门店" filterable>
              <ElOption
                v-for="item in storeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="备注" prop="remark">
            <ElInput v-model="formData.remark" type="textarea" :rows="2" placeholder="备注信息" />
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="采购明细" prop="items">
            <div class="w-full">
              <div class="mb-2 flex items-center gap-2 text-xs text-gray-400">
                <span class="flex-1">商品</span>
                <span class="w-28">订购数量</span>
                <span class="w-28">采购单价</span>
                <span class="w-28">金额</span>
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
                <ElInputNumber v-model="item.orderedQty" class="w-28" :min="1" :precision="0" />
                <ElInputNumber v-model="item.purchasePrice" class="w-28" :min="0" :precision="2" />
                <span class="w-28 text-sm">¥ {{ calcAmount(item) }}</span>
                <ElButton type="danger" link @click="removeItem(index)">删除</ElButton>
              </div>
              <ElButton type="primary" plain @click="addItem">添加商品</ElButton>
            </div>
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <div class="text-right text-sm text-gray-500">
            共 {{ formData.items.length }} 项，总数量 {{ totalQuantity }}，合计金额：
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
    fetchCreatePurchaseOrder,
    fetchGetPurchaseOrderDetail,
    fetchUpdatePurchaseOrder
  } from '@/api/purchase-order'
  import { fetchGetProductOptions, fetchGetSupplierOptions } from '@/api/product'
  import { fetchGetWarehouseList } from '@/api/warehouse'
  import type { FormInstance, FormRules } from 'element-plus'

  type ProductItem = Api.Product.ProductItem

  interface OrderItemForm {
    key: number
    productId: string
    orderedQty: number
    purchasePrice: number
  }

  interface Props {
    visible: boolean
    /** 编辑时的采购订单ID（为空则为新建） */
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

  const isEdit = computed(() => Boolean(props.orderId))

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const productLoading = ref(false)

  const supplierOptions = ref<{ label: string; value: string }[]>([])
  const storeOptions = ref<{ label: string; value: string }[]>([])
  const productOptions = ref<ProductItem[]>([])
  const productCache = ref(new Map<string, ProductItem>())

  const formData = reactive({
    supplierId: '',
    storeId: '',
    remark: '',
    items: [] as OrderItemForm[]
  })

  let itemKey = 0

  const rules: FormRules = {
    supplierId: [{ required: true, message: '请选择供应商', trigger: 'change' }],
    storeId: [{ required: true, message: '请选择收货门店', trigger: 'change' }],
    items: [
      {
        validator: (rule, value, callback) => {
          if (!formData.items.length) {
            callback(new Error('请至少添加一个采购商品'))
            return
          }
          if (formData.items.some((item) => !item.productId)) {
            callback(new Error('请选择完整的商品'))
            return
          }
          callback()
        },
        trigger: 'change'
      }
    ]
  }

  const totalQuantity = computed(() =>
    formData.items.reduce((sum, item) => sum + (Number(item.orderedQty) || 0), 0)
  )

  const totalAmount = computed(() =>
    formData.items
      .reduce(
        (sum, item) => sum + (Number(item.orderedQty) || 0) * (Number(item.purchasePrice) || 0),
        0
      )
      .toFixed(2)
  )

  const calcAmount = (item: OrderItemForm) =>
    ((Number(item.orderedQty) || 0) * (Number(item.purchasePrice) || 0)).toFixed(2)

  const addItem = () => {
    formData.items.push({ key: ++itemKey, productId: '', orderedQty: 1, purchasePrice: 0 })
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

  const handleProductChange = (item: OrderItemForm) => {
    const product = productCache.value.get(item.productId)
    item.purchasePrice = product?.purchasePrice ?? 0
  }

  const loadOptions = async () => {
    const [suppliers, warehouses] = await Promise.all([
      fetchGetSupplierOptions(),
      fetchGetWarehouseList()
    ])
    supplierOptions.value = suppliers.map((item) => ({ label: item.name, value: item.id }))
    storeOptions.value = warehouses
      .filter((item) => item.status === '1')
      .map((item) => ({ label: item.name, value: item.id }))
  }

  /** 编辑时回填明细 */
  const loadOrderDetail = async (id: string) => {
    try {
      const detail = await fetchGetPurchaseOrderDetail(id)
      formData.supplierId = detail.supplierId
      formData.storeId = detail.storeId
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
          productId: it.productId,
          orderedQty: it.orderedQty,
          purchasePrice: it.purchasePrice
        }
      })
    } catch (error) {
      console.error(error)
    }
  }

  const initFormData = () => {
    formData.supplierId = ''
    formData.storeId = ''
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
        if (props.orderId) loadOrderDetail(props.orderId)
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
      const payload: Partial<Api.Purchase.PurchaseOrderDetail> = {
        supplierId: formData.supplierId,
        storeId: formData.storeId,
        remark: formData.remark,
        items: formData.items.map((item) => {
          const product = productCache.value.get(item.productId)
          return {
            id: '',
            productId: item.productId,
            productName: product?.name ?? '',
            barcode: product?.barcode ?? '',
            spec: product?.spec ?? '',
            unit: product?.unit ?? '',
            orderedQty: Number(item.orderedQty) || 0,
            receivedQty: 0,
            returnedQty: 0,
            purchasePrice: Number(item.purchasePrice) || 0,
            totalPrice:
              Math.round((Number(item.orderedQty) || 0) * (Number(item.purchasePrice) || 0) * 100) /
              100,
            remark: ''
          }
        })
      }
      if (props.orderId) {
        await fetchUpdatePurchaseOrder(props.orderId, payload)
        ElMessage.success('采购订单已更新')
      } else {
        await fetchCreatePurchaseOrder(payload)
        ElMessage.success('采购订单已创建')
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
