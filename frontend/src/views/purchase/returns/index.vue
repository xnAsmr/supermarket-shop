<!-- 采购退货单 -->
<template>
  <div class="purchase-returns-page art-full-height">
    <ReturnSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="showDialog()">
              新建采购退货单
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

      <ReturnDialog
        v-model:visible="dialogVisible"
        :return-id="editingId"
        :order-id="presetOrderId"
        @success="refreshCreate"
      />
    </ElCard>

    <ElDrawer v-model="drawerVisible" title="采购退货单详情" size="900px">
      <div v-loading="detailLoading" class="min-h-40">
        <template v-if="detail">
          <div class="mb-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <p>退货单号：{{ detail.returnNo }}</p>
            <p>
              状态：
              <ElTag :type="RETURN_STATUS[detail.status].type" effect="plain" size="small">
                {{ RETURN_STATUS[detail.status].text }}
              </ElTag>
            </p>
            <p>来源采购单：{{ detail.orderNo || '-' }}</p>
            <p>供应商：{{ detail.supplierName || '-' }}</p>
            <p>退货门店：{{ detail.storeName || '-' }}</p>
            <p>操作人：{{ detail.operatorName || '-' }}</p>
            <p>创建时间：{{ detail.createTime || '-' }}</p>
            <p>审核人：{{ detail.reviewerName || '-' }}</p>
            <p>审核时间：{{ detail.reviewTime || '-' }}</p>
            <p>退货时间：{{ detail.returnTime || '-' }}</p>
            <p>退货数量：{{ detail.totalQuantity }}</p>
            <p>
              退货金额：
              <span class="font-medium text-theme">{{ formatMoney(detail.totalAmount) }}</span>
            </p>
            <p class="col-span-2">退货原因：{{ detail.reason || '-' }}</p>
            <p class="col-span-2">备注：{{ detail.remark || '-' }}</p>
          </div>

          <p class="mb-2 font-medium">退货明细</p>
          <ElTable :data="detail.items" border stripe show-summary :summary-method="summaryMethod">
            <ElTableColumn
              prop="productName"
              label="商品名称"
              min-width="150"
              show-overflow-tooltip
            />
            <ElTableColumn prop="barcode" label="条码" width="130" />
            <ElTableColumn prop="unit" label="单位" width="70" />
            <ElTableColumn prop="quantity" label="退货数量" width="90" align="right" />
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
  import { useRoute } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { useAuth } from '@/hooks/core/useAuth'
  import {
    fetchCancelPurchaseReturn,
    fetchConfirmPurchaseReturn,
    fetchDeletePurchaseReturn,
    fetchGetPurchaseReturnDetail,
    fetchGetPurchaseReturnList,
    fetchReviewPurchaseReturn,
    fetchSubmitPurchaseReturn
  } from '@/api/purchase-order'
  import { ElButton, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import ReturnDialog from './modules/return-dialog.vue'
  import ReturnSearch from './modules/return-search.vue'
  import { formatMoney, PURCHASE_RETURN_STATUS } from '../modules/purchase-status'

  defineOptions({ name: 'PurchaseReturns' })

  const { hasAuth } = useAuth()
  const route = useRoute()

  type PurchaseReturn = Api.Purchase.PurchaseReturn
  type SearchFormParams = Api.Purchase.PurchaseReturnSearchParams & { daterange?: string[] }

  const RETURN_STATUS = PURCHASE_RETURN_STATUS

  const searchForm = ref<SearchFormParams>({
    returnNo: undefined,
    orderNo: undefined,
    supplierId: undefined,
    storeId: undefined,
    status: undefined
  })

  const dialogVisible = ref(false)
  const editingId = ref('')
  const presetOrderId = ref('')
  const drawerVisible = ref(false)
  const detailLoading = ref(false)
  const detail = ref<PurchaseReturn | null>(null)

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
      apiFn: fetchGetPurchaseReturnList,
      apiParams: { current: 1, size: 20 },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'returnNo', label: '退货单号', minWidth: 180 },
        { prop: 'orderNo', label: '来源采购单号', minWidth: 170 },
        { prop: 'supplierName', label: '供应商', minWidth: 130 },
        { prop: 'totalQuantity', label: '退货数量', width: 100, align: 'right' },
        {
          prop: 'totalAmount',
          label: '退货金额',
          width: 120,
          align: 'right',
          sortable: true,
          formatter: (row: PurchaseReturn) => formatMoney(row.totalAmount)
        },
        {
          prop: 'status',
          label: '状态',
          width: 110,
          formatter: (row: PurchaseReturn) =>
            h(
              ElTag,
              { type: RETURN_STATUS[row.status].type, effect: 'plain' },
              () => RETURN_STATUS[row.status].text
            )
        },
        { prop: 'reason', label: '退货原因', minWidth: 160, showOverflowTooltip: true },
        { prop: 'operatorName', label: '操作人', width: 110 },
        { prop: 'createTime', label: '创建时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 220,
          fixed: 'right',
          formatter: (row: PurchaseReturn) => renderActions(row)
        }
      ]
    }
  })

  const renderActions = (row: PurchaseReturn) => {
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

    // 待审核：审核通过 / 详情
    if (row.status === 'pending_review') {
      return h('div', { class: 'flex-c' }, [
        h(
          ElButton,
          { type: 'success', link: true, onClick: () => handleReview(row) },
          () => '审核通过'
        ),
        viewButton
      ])
    }

    // 已审核（待退货）：确认退货 / 详情
    if (row.status === 'reviewed') {
      return h('div', { class: 'flex-c' }, [
        h(
          ElButton,
          { type: 'primary', link: true, onClick: () => handleConfirm(row) },
          () => '确认退货'
        ),
        viewButton
      ])
    }

    // 已退货：作废 / 详情
    if (row.status === 'returned') {
      return h('div', { class: 'flex-c' }, [
        h(ElButton, { type: 'danger', link: true, onClick: () => handleCancel(row) }, () => '作废'),
        viewButton
      ])
    }

    // 已作废：仅详情
    return h('div', { class: 'flex-c' }, [viewButton])
  }

  const summaryMethod = ({
    columns: cols,
    data: rows
  }: {
    columns: any[]
    data: Api.Purchase.PurchaseReturnItem[]
  }) => {
    const sums: string[] = []
    cols.forEach((column, index) => {
      if (index === 0) {
        sums[0] = '合计'
        return
      }
      if (column.property === 'quantity') {
        sums[index] = String(rows.reduce((sum, row) => sum + row.quantity, 0))
      } else if (column.property === 'totalPrice') {
        const total = rows.reduce((sum, row) => sum + row.totalPrice, 0)
        sums[index] = `¥ ${total.toFixed(2)}`
      } else {
        sums[index] = ''
      }
    })
    return sums
  }

  const showDialog = (id?: string) => {
    editingId.value = id ?? ''
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const openDetail = async (row: PurchaseReturn) => {
    detail.value = null
    drawerVisible.value = true
    detailLoading.value = true
    try {
      detail.value = await fetchGetPurchaseReturnDetail(row.id)
    } catch (error) {
      console.error(error)
    } finally {
      detailLoading.value = false
    }
  }

  const handleSubmit = async (row: PurchaseReturn) => {
    try {
      await ElMessageBox.confirm(
        `提交采购退货单「${row.returnNo}」后进入待审核状态，确定继续吗？`,
        '提交审核',
        { confirmButtonText: '确定提交', cancelButtonText: '取消', type: 'info' }
      )
      await fetchSubmitPurchaseReturn(row.id)
      ElMessage.success('采购退货单已提交审核')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  const handleReview = async (row: PurchaseReturn) => {
    try {
      const { value } = await ElMessageBox.prompt(
        `审核采购退货单「${row.returnNo}」，审核通过后需确认退货才会扣减库存。`,
        '审核通过',
        {
          confirmButtonText: '审核通过',
          cancelButtonText: '取消',
          inputPlaceholder: '审核备注（选填）',
          inputValue: ''
        }
      )
      await fetchReviewPurchaseReturn(row.id, value?.trim() || undefined)
      ElMessage.success('采购退货单审核通过，待确认退货')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  const handleConfirm = async (row: PurchaseReturn) => {
    try {
      await ElMessageBox.confirm(
        `确认采购退货单「${row.returnNo}」生效？生效后库存将扣减，且不可再修改明细。`,
        '确认退货',
        { confirmButtonText: '确认退货', cancelButtonText: '取消', type: 'warning' }
      )
      await fetchConfirmPurchaseReturn(row.id)
      ElMessage.success('采购退货单已生效，库存与采购订单已同步更新')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  const handleCancel = async (row: PurchaseReturn) => {
    try {
      await ElMessageBox.confirm(
        `作废采购退货单「${row.returnNo}」将恢复已扣减的库存与采购订单的已退数量。确定继续吗？`,
        '作废采购退货单',
        { confirmButtonText: '确定作废', cancelButtonText: '再想想', type: 'warning' }
      )
      await fetchCancelPurchaseReturn(row.id)
      ElMessage.success('采购退货单已作废，库存已恢复')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  const handleDelete = async (row: PurchaseReturn) => {
    try {
      await ElMessageBox.confirm(
        `删除采购退货单「${row.returnNo}」将彻底删除该单据，且无法恢复。确定继续吗？`,
        '删除采购退货单',
        { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'error' }
      )
      await fetchDeletePurchaseReturn(row.id)
      ElMessage.success('采购退货单已删除')
      refreshRemove()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  /** 从采购订单页面跳转过来时自动打开新建对话框并带出来源采购单 */
  onMounted(() => {
    const orderId = String(route.query.orderId ?? '')
    if (orderId) {
      presetOrderId.value = orderId
      showDialog()
    }
  })

  /** 搜索：合并日期区间并重新取数 */
  const handleSearch = (params: SearchFormParams) => {
    const { daterange, ...rest } = params
    const [startTime, endTime] = Array.isArray(daterange) ? daterange : [undefined, undefined]
    replaceSearchParams({ ...rest, startTime, endTime })
    getData()
  }
</script>
