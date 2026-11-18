<template>
  <ElDialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑上架单' : '新建上架单'"
    width="1080px"
    align-center
    destroy-on-close
    top="5vh"
  >
    <ElForm ref="formRef" :model="formData" :rules="rules" label-width="96px">
      <ElRow :gutter="16">
        <ElCol :span="12">
          <ElFormItem label="上架门店" prop="storeId">
            <ElSelect
              v-model="formData.storeId"
              placeholder="请选择上架门店"
              filterable
              @change="handleStoreChange"
            >
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
            <ElInput
              v-model="formData.remark"
              type="textarea"
              :rows="2"
              placeholder="备注信息（选填）"
            />
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <ElFormItem label="上架明细" prop="items">
            <div class="w-full">
              <ElTable :data="formData.items" border size="small" class="w-full">
                <ElTableColumn label="商品" min-width="250">
                  <template #default="{ row }">
                    <ElSelect
                      v-model="row.productId"
                      class="w-full"
                      placeholder="输入名称/条码搜索商品"
                      filterable
                      remote
                      reserve-keyword
                      :remote-method="handleProductSearch"
                      :loading="productLoading"
                      @change="() => handleProductChange(row)"
                    >
                      <ElOption
                        v-for="product in productOptions"
                        :key="product.value"
                        :label="product.label"
                        :value="product.value"
                      />
                    </ElSelect>
                  </template>
                </ElTableColumn>
                <ElTableColumn prop="barcode" label="条码" width="125" />
                <ElTableColumn prop="unit" label="单位" width="64" />
                <ElTableColumn label="当前仓库库存" width="120" align="right">
                  <template #default="{ row }">
                    <span
                      :class="
                        row.warehouseQuantity <= 0 ? 'font-medium text-danger' : 'font-medium'
                      "
                    >
                      {{ row.warehouseQuantity }}
                    </span>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="当前货架库存" width="120" align="right">
                  <template #default="{ row }">{{ row.shelfQuantity }}</template>
                </ElTableColumn>
                <ElTableColumn label="上架数量" width="140">
                  <template #default="{ row }">
                    <ElInputNumber
                      v-model="row.quantity"
                      :min="1"
                      :precision="0"
                      controls-position="right"
                      class="w-full"
                    />
                    <p
                      v-if="row.productId && row.quantity > row.warehouseQuantity"
                      class="mt-1 text-xs text-danger"
                    >
                      超出仓库库存
                    </p>
                  </template>
                </ElTableColumn>
                <ElTableColumn label="备注" width="150">
                  <template #default="{ row }">
                    <ElInput v-model="row.remark" size="small" placeholder="选填" />
                  </template>
                </ElTableColumn>
                <ElTableColumn label="操作" width="70" fixed="right">
                  <template #default="{ $index }">
                    <ElButton type="danger" link @click="removeItem($index)">删除</ElButton>
                  </template>
                </ElTableColumn>
              </ElTable>
              <ElButton type="primary" plain class="mt-2" @click="addItem">添加商品</ElButton>
            </div>
          </ElFormItem>
        </ElCol>
        <ElCol :span="24">
          <div class="text-right text-sm text-gray-500">
            共 {{ formData.items.length }} 项，本次上架数量
            <span class="text-base font-medium text-theme">{{ totalQuantity }}</span>
          </div>
        </ElCol>
      </ElRow>
    </ElForm>

    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">保存草稿</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchGetProductOptions } from '@/api/product'
  import { fetchCreateShelfUp, fetchGetShelfUpDetail, fetchUpdateShelfUp } from '@/api/shelf-up'
  import { fetchGetStockList, fetchGetWarehouseList } from '@/api/warehouse'
  import type { FormInstance, FormRules } from 'element-plus'

  interface PresetShelfUpItem {
    productId: string
    quantity: number
    productName?: string
    barcode?: string
    unit?: string
    spec?: string
  }

  interface Props {
    visible: boolean
    /** 编辑时的上架单 ID（为空则为新建） */
    shelfUpId?: string
    /** 预置门店（从库存预警页跳转） */
    presetStoreId?: string
    /** 预置商品明细（从库存预警页跳转） */
    presetItems?: PresetShelfUpItem[]
  }
  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }

  interface ProductBrief {
    id: string
    name: string
    barcode: string
    spec: string
    unit: string
  }

  interface ShelfUpItemForm {
    key: number
    productId: string
    productName: string
    barcode: string
    spec: string
    unit: string
    quantity: number
    warehouseQuantity: number
    shelfQuantity: number
    remark: string
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const isEdit = computed(() => Boolean(props.shelfUpId))

  const formRef = ref<FormInstance>()
  const submitting = ref(false)
  const productLoading = ref(false)

  const storeOptions = ref<{ label: string; value: string }[]>([])
  const productOptions = ref<{ label: string; value: string }[]>([])
  const productCache = new Map<string, ProductBrief>()
  const stockCache = new Map<string, Api.Warehouse.StockItem>()

  const formData = reactive({
    storeId: '',
    remark: '',
    items: [] as ShelfUpItemForm[]
  })

  let itemKey = 0

  const rules: FormRules = {
    storeId: [{ required: true, message: '请选择上架门店', trigger: 'change' }],
    items: [
      {
        validator: (rule, value, callback) => {
          if (!formData.items.length) {
            callback(new Error('请至少添加一行上架明细'))
            return
          }
          if (formData.items.some((item) => !item.productId)) {
            callback(new Error('请选择完整的商品'))
            return
          }
          if (formData.items.some((item) => (Number(item.quantity) || 0) <= 0)) {
            callback(new Error('上架数量必须大于 0'))
            return
          }
          callback()
        },
        trigger: 'change'
      }
    ]
  }

  const totalQuantity = computed(() => {
    let total = 0
    formData.items.forEach((item) => {
      if (item.productId) total += Number(item.quantity) || 0
    })
    return total
  })

  const addItem = () => {
    formData.items.push({
      key: ++itemKey,
      productId: '',
      productName: '',
      barcode: '',
      spec: '',
      unit: '',
      quantity: 1,
      warehouseQuantity: 0,
      shelfQuantity: 0,
      remark: ''
    })
  }

  const removeItem = (index: number) => {
    formData.items.splice(index, 1)
  }

  /** 合并商品下拉：搜索结果 + 当前门店有库存的商品 */
  const refreshProductOptions = () => {
    const optionMap = new Map<string, string>()
    stockCache.forEach((row) => {
      optionMap.set(row.productId, `${row.productName}（${row.barcode}）`)
      if (!productCache.has(row.productId)) {
        productCache.set(row.productId, {
          id: row.productId,
          name: row.productName,
          barcode: row.barcode,
          spec: '',
          unit: row.unit
        })
      }
    })
    productCache.forEach((product) => {
      optionMap.set(product.id, `${product.name}（${product.barcode}）`)
    })
    // 已选明细始终保留选项，避免预置商品不在搜索结果中时下拉框显示商品 ID
    formData.items.forEach((item) => {
      if (!item.productId) return
      const name = item.productName || item.productId
      optionMap.set(item.productId, item.barcode ? `${name}（${item.barcode}）` : name)
    })
    productOptions.value = [...optionMap.entries()].map(([value, label]) => ({ label, value }))
  }

  const handleProductSearch = async (keyword: string) => {
    productLoading.value = true
    try {
      const list = await fetchGetProductOptions(keyword)
      list.forEach((item) => {
        productCache.set(item.id, {
          id: item.id,
          name: item.name,
          barcode: item.barcode,
          spec: item.spec,
          unit: item.unit
        })
      })
      refreshProductOptions()
    } catch (error) {
      console.error(error)
    } finally {
      productLoading.value = false
    }
  }

  const loadStoreStock = async () => {
    stockCache.clear()
    if (!formData.storeId) {
      refreshProductOptions()
      return
    }
    try {
      const res = await fetchGetStockList({
        warehouseId: formData.storeId,
        current: 1,
        size: 500
      })
      res.records.forEach((item) => stockCache.set(item.productId, item))
    } catch (error) {
      console.error(error)
    }
    refreshProductOptions()
    applyStockToItems()
  }

  const applyStockToItems = () => {
    formData.items.forEach((item) => {
      if (!item.productId) return
      const stock = stockCache.get(item.productId)
      if (!stock) {
        item.warehouseQuantity = 0
        item.shelfQuantity = 0
        return
      }
      item.warehouseQuantity = stock.warehouseQuantity
      item.shelfQuantity = stock.shelfQuantity
      if (!item.productName) {
        item.productName = stock.productName
        item.barcode = stock.barcode
        item.unit = stock.unit
      }
    })
  }

  const handleStoreChange = async () => {
    await loadStoreStock()
  }

  const handleProductChange = (item: ShelfUpItemForm) => {
    if (!item.productId) {
      item.productName = ''
      item.barcode = ''
      item.spec = ''
      item.unit = ''
      item.warehouseQuantity = 0
      item.shelfQuantity = 0
      return
    }
    const duplicated = formData.items.some(
      (row) => row !== item && row.productId === item.productId
    )
    if (duplicated) {
      ElMessage.warning('该商品已在明细中，请直接修改数量或删除重复行')
      item.productId = ''
      item.productName = ''
      item.barcode = ''
      item.spec = ''
      item.unit = ''
      item.warehouseQuantity = 0
      item.shelfQuantity = 0
      return
    }
    const product = productCache.get(item.productId)
    const stock = stockCache.get(item.productId)
    item.productName = product?.name ?? stock?.productName ?? ''
    item.barcode = product?.barcode ?? stock?.barcode ?? ''
    item.spec = product?.spec ?? ''
    item.unit = product?.unit ?? stock?.unit ?? ''
    item.warehouseQuantity = stock?.warehouseQuantity ?? 0
    item.shelfQuantity = stock?.shelfQuantity ?? 0
    if (item.warehouseQuantity <= 0) {
      ElMessage.warning(`商品「${item.productName}」当前仓库库存为 0，请谨慎上架`)
    }
  }

  const loadStores = async () => {
    const warehouses = await fetchGetWarehouseList()
    storeOptions.value = warehouses
      .filter((item) => item.status === '1')
      .map((item) => ({ label: item.name, value: item.id }))
  }

  const fillPresetItems = (presetItems: PresetShelfUpItem[]) => {
    formData.items = presetItems.map((item) => {
      const stock = stockCache.get(item.productId)
      const product = productCache.get(item.productId)
      return {
        key: ++itemKey,
        productId: item.productId,
        productName: item.productName ?? product?.name ?? stock?.productName ?? '',
        barcode: item.barcode ?? product?.barcode ?? stock?.barcode ?? '',
        spec: item.spec ?? product?.spec ?? '',
        unit: item.unit ?? product?.unit ?? stock?.unit ?? '',
        quantity: Number(item.quantity) > 0 ? Number(item.quantity) : 1,
        warehouseQuantity: stock?.warehouseQuantity ?? 0,
        shelfQuantity: stock?.shelfQuantity ?? 0,
        remark: ''
      }
    })
    applyStockToItems()
  }

  const loadShelfUpDetail = async (id: string) => {
    const detail = await fetchGetShelfUpDetail(id)
    formData.storeId = detail.storeId
    formData.remark = detail.remark
    formData.items = detail.items.map((item) => ({
      key: ++itemKey,
      productId: item.productId,
      productName: item.productName,
      barcode: item.barcode,
      spec: item.spec,
      unit: item.unit,
      quantity: item.quantity,
      warehouseQuantity: item.warehouseQuantity,
      shelfQuantity: item.shelfQuantity,
      remark: item.remark
    }))
    detail.items.forEach((item) => {
      if (!productCache.has(item.productId)) {
        productCache.set(item.productId, {
          id: item.productId,
          name: item.productName,
          barcode: item.barcode,
          spec: item.spec,
          unit: item.unit
        })
      }
    })
  }

  const initFormData = () => {
    formData.storeId = ''
    formData.remark = ''
    formData.items = []
    itemKey = 0
    productCache.clear()
    stockCache.clear()
    productOptions.value = []
  }

  watch(
    () => props.visible,
    async (visible) => {
      if (!visible) return
      initFormData()
      await Promise.all([loadStores(), handleProductSearch('')])
      if (props.shelfUpId) {
        await loadShelfUpDetail(props.shelfUpId)
      } else {
        const presetStoreId = props.presetStoreId
        formData.storeId =
          presetStoreId && storeOptions.value.some((item) => item.value === presetStoreId)
            ? presetStoreId
            : (storeOptions.value[0]?.value ?? '')
        if (formData.items.length === 0 && !props.presetItems?.length) addItem()
      }
      if (formData.storeId) {
        await loadStoreStock()
      }
      if (!props.shelfUpId && props.presetItems?.length) {
        fillPresetItems(props.presetItems)
      }
      refreshProductOptions()
      nextTick(() => formRef.value?.clearValidate())
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    if (!formRef.value) return
    const valid = await formRef.value.validate().catch(() => false)
    if (!valid) return

    const items = formData.items.filter(
      (item) => item.productId && (Number(item.quantity) || 0) > 0
    )
    if (!items.length) {
      ElMessage.warning('请至少添加一行有效的上架明细')
      return
    }

    submitting.value = true
    try {
      const payload: Partial<Api.Warehouse.ShelfUpOrder> = {
        storeId: formData.storeId,
        remark: formData.remark,
        items: items.map((item) => ({
          id: '',
          productId: item.productId,
          productName: item.productName,
          barcode: item.barcode,
          spec: item.spec,
          unit: item.unit,
          quantity: Number(item.quantity) || 0,
          warehouseQuantity: item.warehouseQuantity,
          shelfQuantity: item.shelfQuantity,
          remark: item.remark
        }))
      }
      if (props.shelfUpId) {
        await fetchUpdateShelfUp(props.shelfUpId, payload)
        ElMessage.success('上架单已更新')
      } else {
        await fetchCreateShelfUp(payload)
        ElMessage.success('上架单已创建，可确认上架')
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
