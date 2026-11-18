<!-- 退货退款 -->
<template>
  <div class="order-returns-page art-full-height">
    <ReturnsSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />

      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <ElDrawer v-model="drawerVisible" title="退货单详情" size="680px">
      <template v-if="currentRow">
        <div class="mb-4 grid grid-cols-2 gap-y-3 text-sm">
          <div>
            <span class="text-g-500">退货单号：</span>
            <span>{{ currentRow.returnNo }}</span>
          </div>
          <div>
            <span class="text-g-500">状态：</span>
            <ElTag :type="RETURN_STATUS[currentRow.status].type" effect="plain" size="small">
              {{ RETURN_STATUS[currentRow.status].text }}
            </ElTag>
          </div>
          <div>
            <span class="text-g-500">原订单号：</span>
            <span>{{ currentRow.orderNo }}</span>
          </div>
          <div>
            <span class="text-g-500">门店：</span>
            <span>{{ currentRow.warehouseName }}</span>
          </div>
          <div>
            <span class="text-g-500">退款金额：</span>
            <span class="text-danger font-medium">¥ {{ currentRow.refundAmount.toFixed(2) }}</span>
          </div>
          <div>
            <span class="text-g-500">退款方式：</span>
            <span>{{ PAY_LABEL[currentRow.refundMethod] }}</span>
          </div>
          <div>
            <span class="text-g-500">操作人：</span>
            <span>{{ currentRow.operator || '-' }}</span>
          </div>
          <div>
            <span class="text-g-500">退货时间：</span>
            <span>{{ currentRow.createTime }}</span>
          </div>
          <div class="col-span-2">
            <span class="text-g-500">退货原因：</span>
            <span>{{ currentRow.reason }}</span>
          </div>
        </div>

        <p class="mb-2 font-medium">退货明细</p>
        <ElTable :data="currentRow.items" size="small" border>
          <ElTableColumn prop="name" label="商品" min-width="140" show-overflow-tooltip />
          <ElTableColumn prop="unit" label="单位" width="64" />
          <ElTableColumn label="单价" width="92" align="right">
            <template #default="{ row }">¥ {{ row.price.toFixed(2) }}</template>
          </ElTableColumn>
          <ElTableColumn prop="quantity" label="退货数量" width="90" align="right" />
          <ElTableColumn label="退款金额" width="110" align="right">
            <template #default="{ row }">¥ {{ row.amount.toFixed(2) }}</template>
          </ElTableColumn>
        </ElTable>
      </template>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchGetReturnList, fetchCancelReturn } from '@/api/order'
  import { RETURN_STATUS_MAP, PAY_METHOD_LABEL } from '@/mock/service/order.service'
  import { ElMessage, ElMessageBox, ElTag, ElTooltip } from 'element-plus'
  import ReturnsSearch from './modules/returns-search.vue'

  defineOptions({ name: 'OrderReturns' })

  type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'
  type ReturnOrder = Api.Order.ReturnOrder

  const RETURN_STATUS = RETURN_STATUS_MAP as Record<
    Api.Order.ReturnStatus,
    { type: TagType; text: string }
  >
  const PAY_LABEL = PAY_METHOD_LABEL

  const searchForm = ref<Api.Order.ReturnSearchParams>({
    returnNo: undefined,
    orderNo: undefined,
    status: undefined
  })

  const drawerVisible = ref(false)
  const currentRow = ref<ReturnOrder | null>(null)

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
    refreshData
  } = useTable({
    core: {
      apiFn: fetchGetReturnList,
      apiParams: { current: 1, size: 20 },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'returnNo', label: '退货单号', minWidth: 170 },
        { prop: 'orderNo', label: '原订单号', minWidth: 170 },
        { prop: 'warehouseName', label: '门店', minWidth: 120 },
        {
          prop: 'refundAmount',
          label: '退款金额',
          width: 110,
          align: 'right',
          formatter: (row: ReturnOrder) =>
            h('span', { class: 'text-danger font-medium' }, `¥ ${row.refundAmount.toFixed(2)}`)
        },
        {
          prop: 'refundMethod',
          label: '退款方式',
          width: 90,
          formatter: (row: ReturnOrder) => PAY_LABEL[row.refundMethod]
        },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: ReturnOrder) =>
            h(
              ElTag,
              { type: RETURN_STATUS[row.status].type, effect: 'plain' },
              () => RETURN_STATUS[row.status].text
            )
        },
        {
          prop: 'reason',
          label: '退货原因',
          minWidth: 150,
          showOverflowTooltip: true,
          formatter: (row: ReturnOrder) => row.reason || '-'
        },
        {
          prop: 'operator',
          label: '操作人',
          width: 100,
          formatter: (row: ReturnOrder) => row.operator || '-'
        },
        { prop: 'createTime', label: '退货时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 140,
          fixed: 'right',
          formatter: (row: ReturnOrder) =>
            h('div', { class: 'flex-c' }, [
              h(ElTooltip, { content: '退货单详情', placement: 'top' }, () =>
                h(ArtButtonTable, { type: 'view', onClick: () => openDetail(row) })
              ),
              row.status === 'completed'
                ? h(ElTooltip, { content: '作废退货单', placement: 'top' }, () =>
                    h(ArtButtonTable, {
                      icon: 'ri:close-circle-line',
                      iconClass: 'bg-error/12 text-error',
                      onClick: () => handleCancel(row)
                    })
                  )
                : null
            ])
        }
      ]
    }
  })

  const handleSearch = (params: Api.Order.ReturnSearchParams) => {
    replaceSearchParams(params)
    getData()
  }

  const openDetail = (row: ReturnOrder) => {
    currentRow.value = row
    drawerVisible.value = true
  }

  /** 作废退货单：扣回回补的库存、恢复支付账户与会员累计消费 */
  const handleCancel = async (row: ReturnOrder) => {
    try {
      await ElMessageBox.confirm(
        `作废退货单「${row.returnNo}」后将扣回已回补的库存、恢复支付账户金额，并恢复原订单的退款状态。确定继续吗？`,
        '作废退货单',
        {
          confirmButtonText: '确定作废',
          cancelButtonText: '取消',
          type: 'warning'
        }
      )
      await fetchCancelReturn(row.id)
      ElMessage.success('退货单已作废，原订单已恢复')
      refreshData()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }
</script>
