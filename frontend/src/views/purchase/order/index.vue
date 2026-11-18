<!-- 采购订单 -->
<template>
  <div class="purchase-order-page art-full-height">
    <OrderSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="showDialog()">
              新建采购订单
            </ElButton>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />

      <OrderDialog v-model:visible="dialogVisible" :order-id="editingId" @success="refreshCreate" />
      <ReceiveDialog
        v-model:visible="receiveVisible"
        :order-id="receiveOrderId"
        @success="refreshData"
      />
    </ElCard>

    <ElDrawer v-model="drawerVisible" title="采购订单详情" size="900px">
      <div v-loading="detailLoading" class="min-h-40">
        <template v-if="detail">
          <div class="mb-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <p>采购单号：{{ detail.orderNo }}</p>
            <p>
              状态：
              <ElTag :type="ORDER_STATUS[detail.status].type" effect="plain" size="small">
                {{ ORDER_STATUS[detail.status].text }}
              </ElTag>
            </p>
            <p>供应商：{{ detail.supplierName || '-' }}</p>
            <p>收货门店：{{ detail.storeName || '-' }}</p>
            <p>制单人：{{ detail.operatorName || '-' }}</p>
            <p>创建时间：{{ detail.createTime || '-' }}</p>
            <p>审核人：{{ detail.reviewerName || '-' }}</p>
            <p>审核时间：{{ detail.reviewTime || '-' }}</p>
            <p>订购数量：{{ detail.totalOrderedQty }}</p>
            <p>已收数量：{{ detail.totalReceivedQty }}</p>
            <p>已退数量：{{ detail.totalReturnedQty }}</p>
            <p>完成时间：{{ detail.finishTime || '-' }}</p>
            <p class="col-span-2">
              总金额：<span class="font-medium text-theme">{{
                formatMoney(detail.totalAmount)
              }}</span>
            </p>
            <p class="col-span-2">备注：{{ detail.remark || '-' }}</p>
          </div>

          <p class="mb-2 font-medium">采购明细</p>
          <ElTable :data="detail.items" border stripe show-summary :summary-method="summaryMethod">
            <ElTableColumn
              prop="productName"
              label="商品名称"
              min-width="150"
              show-overflow-tooltip
            />
            <ElTableColumn prop="barcode" label="条码" width="130" />
            <ElTableColumn prop="unit" label="单位" width="70" />
            <ElTableColumn prop="orderedQty" label="订购数量" width="90" align="right" />
            <ElTableColumn prop="receivedQty" label="已收数量" width="90" align="right" />
            <ElTableColumn label="未收数量" width="90" align="right">
              <template #default="{ row }">{{ receivableQty(row) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="returnedQty" label="已退数量" width="90" align="right" />
            <ElTableColumn label="单价" width="100" align="right">
              <template #default="{ row }">¥ {{ row.purchasePrice.toFixed(2) }}</template>
            </ElTableColumn>
            <ElTableColumn label="金额" width="110" align="right">
              <template #default="{ row }">¥ {{ row.totalPrice.toFixed(2) }}</template>
            </ElTableColumn>
          </ElTable>
        </template>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { useAuth } from '@/hooks/core/useAuth'
  import {
    fetchCancelPurchaseOrder,
    fetchDeletePurchaseOrder,
    fetchGetPurchaseOrderDetail,
    fetchGetPurchaseOrderList,
    fetchReviewPurchaseOrder,
    fetchRevokePurchaseOrderReview,
    fetchSubmitPurchaseOrder
  } from '@/api/purchase-order'
  import { ElButton, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import OrderSearch from './modules/order-search.vue'
  import OrderDialog from './modules/order-dialog.vue'
  import ReceiveDialog from './modules/receive-dialog.vue'
  import { formatMoney, PURCHASE_ORDER_STATUS } from '../modules/purchase-status'

  defineOptions({ name: 'PurchaseOrder' })

  const { hasAuth } = useAuth()
  const router = useRouter()

  type PurchaseOrder = Api.Purchase.PurchaseOrderDetail
  type SearchFormParams = Api.Purchase.PurchaseOrderSearchParams & { daterange?: string[] }

  const ORDER_STATUS = PURCHASE_ORDER_STATUS

  const searchForm = ref<SearchFormParams>({
    orderNo: undefined,
    supplierId: undefined,
    storeId: undefined,
    status: undefined
  })

  const dialogVisible = ref(false)
  const editingId = ref('')
  const receiveVisible = ref(false)
  const receiveOrderId = ref('')
  const drawerVisible = ref(false)
  const detailLoading = ref(false)
  const detail = ref<PurchaseOrder | null>(null)

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    replaceSearchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
    refreshCreate,
    refreshUpdate,
    refreshRemove
  } = useTable({
    core: {
      apiFn: fetchGetPurchaseOrderList,
      apiParams: {
        current: 1,
        size: 20,
        orderNo: undefined,
        supplierId: undefined,
        storeId: undefined,
        status: undefined
      },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'orderNo', label: '采购单号', minWidth: 180 },
        { prop: 'supplierName', label: '供应商', minWidth: 130 },
        { prop: 'storeName', label: '收货门店', width: 130 },
        { prop: 'totalOrderedQty', label: '订购数量', width: 90, align: 'right' },
        { prop: 'totalReceivedQty', label: '已收数量', width: 90, align: 'right' },
        { prop: 'totalReturnedQty', label: '已退数量', width: 90, align: 'right' },
        {
          prop: 'totalAmount',
          label: '总金额',
          width: 120,
          align: 'right',
          sortable: true,
          formatter: (row: PurchaseOrder) => formatMoney(row.totalAmount)
        },
        {
          prop: 'status',
          label: '状态',
          width: 100,
          formatter: (row: PurchaseOrder) =>
            h(
              ElTag,
              { type: ORDER_STATUS[row.status].type, effect: 'plain' },
              () => ORDER_STATUS[row.status].text
            )
        },
        { prop: 'operatorName', label: '制单人', width: 110 },
        { prop: 'createTime', label: '创建时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 245,
          fixed: 'right',
          formatter: (row: PurchaseOrder) => renderActions(row)
        }
      ]
    }
  })

  /** 明细行未收数量 */
  const receivableQty = (row: Api.Purchase.PurchaseOrderItem) =>
    Math.max(0, Number(row.orderedQty || 0) - Number(row.receivedQty || 0))

  const renderActions = (row: PurchaseOrder) => {
    const viewButton = h(
      ElButton,
      { type: 'primary', link: true, onClick: () => openDetail(row) },
      () => '详情'
    )

    // 草稿：编辑 / 删除 / 提交审核 / 详情
    if (row.status === 'draft') {
      return h('div', { class: 'flex-c' }, [
        h(
          ElButton,
          { type: 'primary', link: true, onClick: () => showDialog(row.id) },
          () => '编辑'
        ),
        h(ElButton, { type: 'danger', link: true, onClick: () => handleDelete(row) }, () => '删除'),
        h(
          ElButton,
          { type: 'success', link: true, onClick: () => handleSubmit(row) },
          () => '提交审核'
        ),
        viewButton
      ])
    }

    // 待审核：审核通过 / 撤销审核 / 详情
    if (row.status === 'pending_review') {
      return h('div', { class: 'flex-c' }, [
        h(
          ElButton,
          { type: 'success', link: true, onClick: () => handleReview(row) },
          () => '审核通过'
        ),
        h(
          ElButton,
          { type: 'warning', link: true, onClick: () => handleRevokeReview(row) },
          () => '撤销审核'
        ),
        viewButton
      ])
    }

    // 已审核 / 部分收货：收货入库 / 退货 / 取消 / 详情
    if (row.status === 'approved' || row.status === 'partially_received') {
      return h('div', { class: 'flex-c' }, [
        h(
          ElButton,
          { type: 'primary', link: true, onClick: () => goReceive(row) },
          () => '收货入库'
        ),
        h(ElButton, { type: 'warning', link: true, onClick: () => goReturn(row) }, () => '退货'),
        h(ElButton, { type: 'danger', link: true, onClick: () => handleCancel(row) }, () => '取消'),
        viewButton
      ])
    }

    // 已完成 / 部分退货 / 已退货 / 已取消：仅详情
    return h('div', { class: 'flex-c' }, [viewButton])
  }

  const summaryMethod = ({
    columns: cols,
    data: rows
  }: {
    columns: any[]
    data: Api.Purchase.PurchaseOrderItem[]
  }) => {
    const sums: string[] = []
    cols.forEach((column, index) => {
      if (index === 0) {
        sums[0] = '合计'
        return
      }
      if (column.property === 'orderedQty') {
        sums[index] = String(rows.reduce((sum, row) => sum + row.orderedQty, 0))
      } else if (column.property === 'receivedQty') {
        sums[index] = String(rows.reduce((sum, row) => sum + row.receivedQty, 0))
      } else if (column.property === 'returnedQty') {
        sums[index] = String(rows.reduce((sum, row) => sum + row.returnedQty, 0))
      } else if (column.property === 'totalPrice') {
        const total = rows.reduce((sum, row) => sum + row.totalPrice, 0)
        sums[index] = `¥ ${total.toFixed(2)}`
      } else {
        sums[index] = ''
      }
    })
    return sums
  }

  const handleSearch = (params: Api.Purchase.PurchaseOrderSearchParams) => {
    replaceSearchParams(params)
    getData()
  }

  const showDialog = (id?: string) => {
    editingId.value = id ?? ''
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const openDetail = async (row: PurchaseOrder) => {
    detail.value = null
    drawerVisible.value = true
    detailLoading.value = true
    try {
      detail.value = await fetchGetPurchaseOrderDetail(row.id)
    } catch (error) {
      console.error(error)
    } finally {
      detailLoading.value = false
    }
  }

  /** 打开收货入库弹窗（直接加库存并生成入库单，不再跳转收货单） */
  const goReceive = (row: PurchaseOrder) => {
    receiveOrderId.value = row.id
    receiveVisible.value = true
  }

  /** 跳转到采购退货单页面并带上来源采购订单 */
  const goReturn = (row: PurchaseOrder) => {
    router.push({ name: 'PurchaseReturns', query: { orderId: row.id } })
  }

  const handleSubmit = async (row: PurchaseOrder) => {
    try {
      await ElMessageBox.confirm(
        `提交采购订单「${row.orderNo}」后进入待审核状态，确定继续吗？`,
        '提交审核',
        { confirmButtonText: '确定提交', cancelButtonText: '取消', type: 'info' }
      )
      await fetchSubmitPurchaseOrder(row.id)
      ElMessage.success('采购订单已提交审核')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  const handleReview = async (row: PurchaseOrder) => {
    try {
      const { value } = await ElMessageBox.prompt(
        `审核采购订单「${row.orderNo}」，审核通过后可执行收货。`,
        '审核通过',
        {
          confirmButtonText: '审核通过',
          cancelButtonText: '取消',
          inputPlaceholder: '审核备注（选填）',
          inputValue: ''
        }
      )
      await fetchReviewPurchaseOrder(row.id, value?.trim() || undefined)
      ElMessage.success('采购订单审核通过')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  const handleRevokeReview = async (row: PurchaseOrder) => {
    try {
      await ElMessageBox.confirm(
        `撤销采购订单「${row.orderNo}」的审核，撤销后回到草稿状态。确定继续吗？`,
        '撤销审核',
        { confirmButtonText: '确定撤销', cancelButtonText: '取消', type: 'warning' }
      )
      await fetchRevokePurchaseOrderReview(row.id)
      ElMessage.success('已撤销审核，采购订单回到草稿状态')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  const handleCancel = async (row: PurchaseOrder) => {
    try {
      await ElMessageBox.confirm(
        `取消采购订单「${row.orderNo}」，取消后不可再收货。确定继续吗？`,
        '取消采购订单',
        { confirmButtonText: '确定取消', cancelButtonText: '再想想', type: 'warning' }
      )
      await fetchCancelPurchaseOrder(row.id)
      ElMessage.success('采购订单已取消')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  const handleDelete = async (row: PurchaseOrder) => {
    try {
      await ElMessageBox.confirm(
        `删除采购订单「${row.orderNo}」将彻底删除该订单及其明细，且无法恢复。确定继续吗？`,
        '删除采购订单',
        { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'error' }
      )
      await fetchDeletePurchaseOrder(row.id)
      ElMessage.success('采购订单已删除')
      refreshRemove()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  /**
   * 本页 keepAlive 缓存，从「采购退货」返回时不会重新取数，
   * 会导致已收 / 已退数量显示为旧值。这里在页面重新激活时刷新一次。
   */
  const hasActivated = ref(false)
  onActivated(() => {
    if (!hasActivated.value) {
      hasActivated.value = true
      return
    }
    refreshData()
  })
</script>
