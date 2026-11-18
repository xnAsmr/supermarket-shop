<template>
  <ElDialog
    v-model="dialogVisible"
    title="收货入库"
    width="900px"
    align-center
    destroy-on-close
    top="8vh"
  >
    <div v-loading="loading" class="min-h-40">
      <template v-if="order">
        <div class="mb-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <p>采购单号：{{ order.orderNo }}</p>
          <p>供应商：{{ order.supplierName || '-' }}</p>
          <p>收货门店：{{ order.storeName || '-' }}</p>
          <p>已收数量：{{ order.totalReceivedQty }} / 订购 {{ order.totalOrderedQty }}</p>
        </div>
      </template>

      <ElTable :data="items" border stripe>
        <ElTableColumn prop="productName" label="商品名称" min-width="150" show-overflow-tooltip />
        <ElTableColumn prop="barcode" label="条码" width="130" />
        <ElTableColumn prop="unit" label="单位" width="70" />
        <ElTableColumn label="单价" width="90" align="right">
          <template #default="{ row }">¥ {{ row.purchasePrice.toFixed(2) }}</template>
        </ElTableColumn>
        <ElTableColumn label="可收数量" width="90" align="right">
          <template #default="{ row }">{{ receivableQty(row) }}</template>
        </ElTableColumn>
        <ElTableColumn label="本次实收" width="150">
          <template #default="{ row }">
            <ElInputNumber
              v-model="row.quantity"
              :min="0"
              :max="receivableQty(row)"
              :precision="0"
              size="small"
            />
          </template>
        </ElTableColumn>
        <ElTableColumn label="批次号" width="150">
          <template #default="{ row }">
            <ElInput v-model="row.batchNo" size="small" placeholder="选填" />
          </template>
        </ElTableColumn>
      </ElTable>

      <div class="mt-3 text-right text-sm text-gray-500">
        本次收货数量 {{ totalQuantity }}，合计金额：
        <span class="text-base font-medium text-theme">¥ {{ totalAmount }}</span>
      </div>
      <p class="mt-1 text-xs text-gray-400">
        确认后直接完成入库并更新库存（入库管理页可见），本次实收可小于可收数量进行部分收货。
      </p>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="handleSubmit">确认收货入库</ElButton>
      </div>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import {
    fetchGetPurchaseOrderDetail,
    fetchGetReceivableItems,
    fetchReceivePurchaseOrder
  } from '@/api/purchase-order'

  type PurchaseOrder = Api.Purchase.PurchaseOrderDetail

  interface ReceiveItemRow {
    orderItemId: string
    productId: string
    productName: string
    barcode: string
    unit: string
    purchasePrice: number
    orderedQty: number
    receivedQty: number
    quantity: number
    batchNo: string
  }

  interface Props {
    visible: boolean
    /** 来源采购订单ID */
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

  const loading = ref(false)
  const submitting = ref(false)
  const order = ref<PurchaseOrder | null>(null)
  const items = ref<ReceiveItemRow[]>([])

  /** 明细行可收数量 */
  const receivableQty = (row: Pick<ReceiveItemRow, 'orderedQty' | 'receivedQty'>) =>
    Math.max(0, Number(row.orderedQty || 0) - Number(row.receivedQty || 0))

  const totalQuantity = computed(() =>
    items.value.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0)
  )

  const totalAmount = computed(() =>
    items.value
      .reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.purchasePrice) || 0), 0)
      .toFixed(2)
  )

  const loadReceiveItems = async (orderId: string) => {
    loading.value = true
    order.value = null
    items.value = []
    try {
      const [detail, receivableItems] = await Promise.all([
        fetchGetPurchaseOrderDetail(orderId),
        fetchGetReceivableItems(orderId)
      ])
      order.value = detail
      // 预填全部可收数量，可下调做部分收货
      items.value = receivableItems.map((it) => ({
        orderItemId: it.id,
        productId: it.productId,
        productName: it.productName,
        barcode: it.barcode,
        unit: it.unit,
        purchasePrice: it.purchasePrice,
        orderedQty: it.orderedQty,
        receivedQty: it.receivedQty,
        quantity: Math.max(0, it.orderedQty - it.receivedQty),
        batchNo: ''
      }))
    } catch (error) {
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible && props.orderId) {
        loadReceiveItems(props.orderId)
      }
    },
    { immediate: true }
  )

  const handleSubmit = async () => {
    const rows = items.value.filter((row) => (Number(row.quantity) || 0) > 0)
    if (!rows.length) {
      ElMessage.warning('请填写本次实收数量')
      return
    }
    if (!props.orderId) return

    submitting.value = true
    try {
      await fetchReceivePurchaseOrder(props.orderId, {
        items: rows.map((row) => ({
          orderItemId: row.orderItemId,
          quantity: Number(row.quantity) || 0,
          batchNo: row.batchNo?.trim() || undefined
        }))
      })
      ElMessage.success('收货入库成功，库存已更新')
      dialogVisible.value = false
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      submitting.value = false
    }
  }
</script>
