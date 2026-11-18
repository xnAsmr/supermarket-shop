<!-- 销售订单 -->
<template>
  <div class="order-sales-page art-full-height">
    <SalesSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

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

      <ReturnDialog
        v-model:visible="returnVisible"
        :order-data="currentOrder"
        @success="handleReturnSuccess"
      />
    </ElCard>

    <ElDrawer v-model="drawerVisible" title="订单详情" size="680px">
      <div v-loading="detailLoading" class="min-h-40">
        <template v-if="detail">
          <div class="mb-4 grid grid-cols-2 gap-y-3 text-sm">
            <div>
              <span class="text-g-500">订单号：</span>
              <span>{{ detail.orderNo }}</span>
            </div>
            <div>
              <span class="text-g-500">状态：</span>
              <ElTag :type="ORDER_STATUS[detail.status].type" effect="plain" size="small">
                {{ ORDER_STATUS[detail.status].text }}
              </ElTag>
            </div>
            <div>
              <span class="text-g-500">门店：</span>
              <span>{{ detail.warehouseName || '-' }}</span>
            </div>
            <div>
              <span class="text-g-500">收银员：</span>
              <span>{{ detail.cashier }}</span>
            </div>
            <div>
              <span class="text-g-500">会员：</span>
              <span>{{ detail.memberName || '-' }}</span>
            </div>
            <div>
              <span class="text-g-500">下单时间：</span>
              <span>{{ detail.createTime }}</span>
            </div>
            <div v-if="detail.cancelReason" class="col-span-2">
              <span class="text-g-500">取消原因：</span>
              <span class="text-danger">{{ detail.cancelReason }}</span>
            </div>
            <div v-if="detail.cancelTime" class="col-span-2">
              <span class="text-g-500">取消时间：</span>
              <span>{{ detail.cancelTime }}</span>
            </div>
          </div>

          <p class="mb-2 font-medium">商品明细</p>
          <ElTable :data="detail.items" size="small" border>
            <ElTableColumn prop="name" label="商品" min-width="140" show-overflow-tooltip />
            <ElTableColumn prop="unit" label="单位" width="64" />
            <ElTableColumn label="单价" width="92" align="right">
              <template #default="{ row }">¥ {{ row.price.toFixed(2) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="quantity" label="数量" width="70" align="right" />
            <ElTableColumn label="已退" width="70" align="right">
              <template #default="{ row }">{{ row.refundedQty || 0 }}</template>
            </ElTableColumn>
            <ElTableColumn label="金额" width="100" align="right">
              <template #default="{ row }">¥ {{ row.amount.toFixed(2) }}</template>
            </ElTableColumn>
          </ElTable>

          <div class="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div>
              <span class="text-g-500">原价：</span>
              <span>¥ {{ detail.totalAmount.toFixed(2) }}</span>
            </div>
            <div>
              <span class="text-g-500">优惠：</span>
              <span>¥ {{ detail.discountAmount.toFixed(2) }}</span>
            </div>
            <div>
              <span class="text-g-500">实收：</span>
              <span class="text-danger font-medium">¥ {{ detail.payAmount.toFixed(2) }}</span>
            </div>
          </div>

          <p class="mt-4 mb-2 font-medium">支付记录</p>
          <div
            v-for="(payment, index) in detail.payments"
            :key="index"
            class="flex-c justify-between py-1 text-sm"
          >
            <span>{{ PAY_LABEL[payment.method] }}</span>
            <span>¥ {{ payment.amount.toFixed(2) }}</span>
          </div>
          <ElEmpty v-if="!detail.payments.length" description="暂无支付记录" :image-size="80" />
        </template>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchGetSalesList,
    fetchGetSalesDetail,
    fetchCancelSalesOrder,
    fetchRestoreSalesOrder,
    fetchDeleteSalesOrder
  } from '@/api/order'
  import { ORDER_STATUS_MAP, PAY_METHOD_LABEL } from '@/mock/service/order.service'
  import { ElMessage, ElMessageBox, ElTag, ElTooltip } from 'element-plus'
  import SalesSearch from './modules/sales-search.vue'
  import ReturnDialog from './modules/return-dialog.vue'

  defineOptions({ name: 'OrderSales' })

  type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'
  type SalesOrder = Api.Order.SalesOrder
  type SalesSearchFormParams = Api.Order.SalesSearchParams & {
    daterange?: string[]
  }

  const ORDER_STATUS = ORDER_STATUS_MAP as Record<
    Api.Order.OrderStatus,
    { type: TagType; text: string }
  >
  const PAY_LABEL = PAY_METHOD_LABEL

  const searchForm = ref<SalesSearchFormParams>({
    keyword: undefined,
    status: undefined,
    warehouseId: undefined,
    daterange: undefined
  })

  const returnVisible = ref(false)
  const currentOrder = ref<Partial<SalesOrder>>({})
  const drawerVisible = ref(false)
  const detailLoading = ref(false)
  const detail = ref<SalesOrder | null>(null)

  /** 可发起退货：已支付或部分退款 */
  const canReturn = (row: SalesOrder) => row.status === 'paid' || row.status === 'partial_refund'
  /** 可取消：未取消且未全额退款 */
  const canCancel = (row: SalesOrder) => row.status !== 'cancelled' && row.status !== 'refunded'
  /** 可恢复：已取消 */
  const canRestore = (row: SalesOrder) => row.status === 'cancelled'
  /** 可删除：已取消（取消后才允许彻底删除） */
  const canDelete = (row: SalesOrder) => row.status === 'cancelled'

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
    refreshUpdate
  } = useTable({
    core: {
      apiFn: fetchGetSalesList,
      apiParams: { current: 1, size: 20 },
      excludeParams: ['daterange'],
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'orderNo', label: '订单号', minWidth: 170 },
        { prop: 'quantity', label: '商品数', width: 90, align: 'right' },
        {
          prop: 'totalAmount',
          label: '原价',
          width: 110,
          align: 'right',
          formatter: (row: SalesOrder) => `¥ ${row.totalAmount.toFixed(2)}`
        },
        {
          prop: 'discountAmount',
          label: '优惠',
          width: 100,
          align: 'right',
          formatter: (row: SalesOrder) => `¥ ${row.discountAmount.toFixed(2)}`
        },
        {
          prop: 'payAmount',
          label: '实收',
          width: 110,
          align: 'right',
          formatter: (row: SalesOrder) =>
            h('span', { class: 'font-medium' }, `¥ ${row.payAmount.toFixed(2)}`)
        },
        {
          prop: 'payments',
          label: '支付方式',
          minWidth: 130,
          formatter: (row: SalesOrder) =>
            row.payments.map((item) => PAY_LABEL[item.method]).join(' + ') || '-'
        },
        {
          prop: 'status',
          label: '状态',
          width: 110,
          formatter: (row: SalesOrder) =>
            h(
              ElTag,
              { type: ORDER_STATUS[row.status].type, effect: 'plain' },
              () => ORDER_STATUS[row.status].text
            )
        },
        { prop: 'warehouseName', label: '门店', minWidth: 120 },
        { prop: 'cashier', label: '收银员', width: 90 },
        { prop: 'createTime', label: '下单时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 210,
          fixed: 'right',
          formatter: (row: SalesOrder) =>
            h('div', { class: 'flex-c' }, [
              h(ElTooltip, { content: '订单详情', placement: 'top' }, () =>
                h(ArtButtonTable, { type: 'view', onClick: () => openDetail(row) })
              ),
              canReturn(row)
                ? h(ElTooltip, { content: '发起退货', placement: 'top' }, () =>
                    h(ArtButtonTable, {
                      icon: 'ri:arrow-go-back-line',
                      iconClass: 'bg-warning/12 text-warning',
                      onClick: () => openReturn(row)
                    })
                  )
                : null,
              canCancel(row)
                ? h(ElTooltip, { content: '取消订单', placement: 'top' }, () =>
                    h(ArtButtonTable, {
                      icon: 'ri:close-circle-line',
                      iconClass: 'bg-secondary/12 text-secondary',
                      onClick: () => handleCancel(row)
                    })
                  )
                : null,
              canRestore(row)
                ? h(ElTooltip, { content: '恢复订单', placement: 'top' }, () =>
                    h(ArtButtonTable, {
                      icon: 'ri:refresh-line',
                      iconClass: 'bg-success/12 text-success',
                      onClick: () => handleRestore(row)
                    })
                  )
                : null,
              canDelete(row)
                ? h(ElTooltip, { content: '删除订单', placement: 'top' }, () =>
                    h(ArtButtonTable, {
                      type: 'delete',
                      onClick: () => handleDelete(row)
                    })
                  )
                : null
            ])
        }
      ]
    }
  })

  const handleSearch = (params: SalesSearchFormParams) => {
    const { daterange, ...filtersParams } = params
    const [startTime, endTime] = Array.isArray(daterange) ? daterange : [undefined, undefined]

    replaceSearchParams({ ...filtersParams, startTime, endTime })
    getData()
  }

  const openDetail = async (row: SalesOrder) => {
    detail.value = null
    drawerVisible.value = true
    detailLoading.value = true
    try {
      detail.value = await fetchGetSalesDetail(row.id)
    } catch (error) {
      console.error(error)
    } finally {
      detailLoading.value = false
    }
  }

  const openReturn = (row: SalesOrder) => {
    currentOrder.value = row
    nextTick(() => {
      returnVisible.value = true
    })
  }

  const handleReturnSuccess = () => {
    returnVisible.value = false
    refreshUpdate()
  }

  /** 取消订单：回滚库存、支付账户与会员累计消费，可恢复 */
  const handleCancel = async (row: SalesOrder) => {
    try {
      const { value } = await ElMessageBox.prompt(
        `取消订单「${row.orderNo}」后将回补库存、冲减支付账户金额，并可再次恢复。确定继续吗？`,
        '取消订单',
        {
          confirmButtonText: '确定取消',
          cancelButtonText: '再想想',
          inputPlaceholder: '可填写取消原因（选填）',
          inputValidator: (val: string) =>
            val && val.length > 100 ? '取消原因不能超过 100 字' : true,
          type: 'warning'
        }
      )
      await fetchCancelSalesOrder(row.id, value?.trim() || undefined)
      ElMessage.success('订单已取消，库存与支付账户已同步回滚')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  /** 恢复已取消的订单：重新扣减库存、恢复支付账户与会员累计消费 */
  const handleRestore = async (row: SalesOrder) => {
    try {
      await ElMessageBox.confirm(
        `恢复订单「${row.orderNo}」后将重新扣减库存、恢复支付账户金额。确定继续吗？`,
        '恢复订单',
        {
          confirmButtonText: '确定恢复',
          cancelButtonText: '取消',
          type: 'info'
        }
      )
      await fetchRestoreSalesOrder(row.id)
      ElMessage.success('订单已恢复，库存与支付账户已同步恢复')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  /** 彻底删除订单：物理删除记录，不可恢复 */
  const handleDelete = async (row: SalesOrder) => {
    try {
      await ElMessageBox.confirm(
        `删除订单「${row.orderNo}」将彻底删除该订单记录，且无法恢复。确定继续吗？`,
        '删除订单',
        {
          confirmButtonText: '确定删除',
          cancelButtonText: '取消',
          type: 'error'
        }
      )
      await fetchDeleteSalesOrder(row.id)
      ElMessage.success('订单已删除')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }
</script>
