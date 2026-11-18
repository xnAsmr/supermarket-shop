<template>
  <ElDialog
    v-model="dialogVisible"
    :title="`新建${TYPE_LABEL[props.type]}单`"
    width="920px"
    align-center
    destroy-on-close
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElRow :gutter="16">
        <ElCol :span="12">
          <ElFormItem label="来源仓库" prop="warehouseId">
            <ElSelect
              v-model="formData.warehouseId"
              placeholder="请选择来源仓库"
              filterable
              @change="handleWarehouseChange"
            >
              <ElOption
                v-for="item in warehouseOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </ElSelect>
          </ElFormItem>
        </ElCol>
        <ElCol v-if="props.type === 'transfer'" :span="12">
          <ElFormItem label="目标仓库" prop="targetWarehouseId">
            <ElSelect v-model="formData.targetWarehouseId" placeholder="请选择目标仓库" filterable>
              <ElOption
                v-for="item in targetOptions"
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
      </ElRow>
    </ElForm>

    <div class="mb-2 flex-c justify-between">
      <span class="text-sm font-medium">商品明细</span>
      <ElButton type="primary" link @click="addRow">添加商品</ElButton>
    </div>

    <ElTable :data="formData.items" border size="small">
      <ElTableColumn label="商品" min-width="240">
        <template #default="{ row }">
          <ElSelect
            v-model="row.productId"
            filterable
            :remote="!isStocktake"
            reserve-keyword
            :placeholder="isStocktake ? '请选择商品（需先选择仓库）' : '搜索商品名称/条码'"
            :remote-method="searchProducts"
            :loading="productLoading"
            class="w-full"
            @change="(val: string) => handleProductChange(row, val)"
          >
            <ElOption
              v-for="item in productOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </ElSelect>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="barcode" label="条码" width="120" />
      <ElTableColumn prop="unit" label="单位" width="64" />
      <ElTableColumn label="数量" width="130">
        <template #default="{ row }">
          <ElInputNumber
            v-model="row.quantity"
            :min="0"
            :precision="0"
            class="w-full"
            controls-position="right"
          />
        </template>
      </ElTableColumn>
      <ElTableColumn v-if="props.type === 'stocktake'" label="实盘数量" width="140">
        <template #default="{ row }">
          <ElInputNumber
            v-model="row.actualQuantity"
            :min="0"
            :precision="0"
            class="w-full"
            controls-position="right"
          />
        </template>
      </ElTableColumn>
      <ElTableColumn label="操作" width="70" fixed="right">
        <template #default="{ $index }">
          <ElButton type="danger" link @click="removeRow($index)">删除</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>

    <div class="mt-2 text-right text-sm text-gray-500">
      共 {{ formData.items.length }} 项，数量合计：<span class="font-medium">{{
        totalQuantity
      }}</span>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确定</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchGetWarehouseList, fetchCreateStockDoc, fetchGetStockList } from '@/api/warehouse'
  import { fetchGetProductOptions } from '@/api/product'
  import type { FormInstance, FormRules } from 'element-plus'

  type StockDocType = Api.Warehouse.StockDocType

  const TYPE_LABEL: Record<StockDocType, string> = {
    inbound: '入库',
    outbound: '出库',
    transfer: '调拨',
    stocktake: '盘点'
  }

  interface DocItemRow {
    productId: string
    barcode: string
    productName: string
    unit: string
    quantity: number
    price: number
    actualQuantity?: number
  }

  interface Props {
    visible: boolean
    type: StockDocType
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

  const isStocktake = computed(() => props.type === 'stocktake')

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const productLoading = ref(false)

  const warehouseOptions = ref<{ label: string; value: string }[]>([])
  const productOptions = ref<{ label: string; value: string }[]>([])
  const productCache = new Map<string, Api.Product.ProductItem>()
  const stockCache = new Map<string, Api.Warehouse.StockItem>()

  const formData = reactive({
    warehouseId: '',
    targetWarehouseId: '',
    remark: '',
    items: [] as DocItemRow[]
  })

  const rules: FormRules = {
    warehouseId: [{ required: true, message: '请选择来源仓库', trigger: 'change' }],
    targetWarehouseId: [{ required: true, message: '请选择目标仓库', trigger: 'change' }]
  }

  const targetOptions = computed(() =>
    warehouseOptions.value.filter((item) => item.value !== formData.warehouseId)
  )

  const totalQuantity = computed(() =>
    formData.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
  )

  const createEmptyRow = (): DocItemRow => ({
    productId: '',
    barcode: '',
    productName: '',
    unit: '',
    quantity: 1,
    price: 0,
    ...(isStocktake.value ? { actualQuantity: 0 } : {})
  })

  const addRow = () => {
    formData.items.push(createEmptyRow())
  }

  const removeRow = (index: number) => {
    formData.items.splice(index, 1)
  }

  const loadWarehouses = async () => {
    const warehouses = await fetchGetWarehouseList()
    warehouseOptions.value = warehouses
      .filter((item) => item.status === '1')
      .map((item) => ({ label: item.name, value: item.id }))
  }

  const searchProducts = async (keyword: string) => {
    productLoading.value = true
    try {
      const list = await fetchGetProductOptions(keyword)
      list.forEach((item) => productCache.set(item.id, item))
      productOptions.value = list.map((item) => ({
        label: `${item.name}（${item.barcode}）`,
        value: item.id
      }))
    } catch (error) {
      console.error(error)
    } finally {
      productLoading.value = false
    }
  }

  const loadWarehouseStock = async (warehouseId: string) => {
    try {
      const res = await fetchGetStockList({ warehouseId, current: 1, size: 500 })
      stockCache.clear()
      productOptions.value = res.records.map((item) => {
        stockCache.set(item.productId, item)
        return {
          label: `${item.productName}（${item.barcode}）库存 ${item.quantity}`,
          value: item.productId
        }
      })
    } catch (error) {
      console.error(error)
    }
  }

  const handleWarehouseChange = (val: string) => {
    if (formData.targetWarehouseId === val) {
      formData.targetWarehouseId = ''
    }
    if (isStocktake.value) {
      if (val) {
        loadWarehouseStock(val)
      } else {
        stockCache.clear()
        productOptions.value = []
      }
    }
  }

  const handleProductChange = (row: DocItemRow, val: string) => {
    if (!val) {
      Object.assign(row, { barcode: '', productName: '', unit: '', price: 0 })
      return
    }
    if (isStocktake.value) {
      const stock = stockCache.get(val)
      if (stock) {
        Object.assign(row, {
          barcode: stock.barcode,
          productName: stock.productName,
          unit: stock.unit,
          quantity: stock.quantity,
          price: stock.purchasePrice,
          actualQuantity: stock.quantity
        })
      }
      return
    }
    const product = productCache.get(val)
    if (product) {
      Object.assign(row, {
        barcode: product.barcode,
        productName: product.name,
        unit: product.unit,
        price: product.purchasePrice
      })
    }
  }

  const initFormData = () => {
    formData.warehouseId = ''
    formData.targetWarehouseId = ''
    formData.remark = ''
    formData.items = [createEmptyRow()]
    productOptions.value = []
    productCache.clear()
    stockCache.clear()
    nextTick(() => formRef.value?.clearValidate())
  }

  const validateItems = (): boolean => {
    const items = formData.items.filter((item) => item.productId)
    if (!items.length) {
      ElMessage.warning('请至少添加一个商品明细')
      return false
    }
    if (isStocktake.value) {
      if (items.some((item) => item.actualQuantity == null || item.actualQuantity < 0)) {
        ElMessage.warning('请填写每个商品的实盘数量')
        return false
      }
    } else if (items.some((item) => !item.quantity || item.quantity <= 0)) {
      ElMessage.warning('商品数量必须大于 0')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return
    if (!validateItems()) return

    submitting.value = true
    try {
      const items = formData.items.filter((item) => item.productId)
      await fetchCreateStockDoc({
        type: props.type,
        warehouseId: formData.warehouseId,
        targetWarehouseId: props.type === 'transfer' ? formData.targetWarehouseId : '',
        remark: formData.remark,
        items: items.map((item) => ({
          productId: item.productId,
          barcode: item.barcode,
          productName: item.productName,
          unit: item.unit,
          quantity: Number(item.quantity) || 0,
          price: item.price,
          ...(isStocktake.value ? { actualQuantity: Number(item.actualQuantity) || 0 } : {})
        }))
      })
      ElMessage.success(
        isStocktake.value ? '盘点单已创建，请确认后点击完成盘点' : '单据已生效，库存已更新'
      )
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible) {
        initFormData()
        if (!isStocktake.value) {
          searchProducts('')
        }
      }
    }
  )

  onMounted(loadWarehouses)
</script>
