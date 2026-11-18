<template>
  <div class="stock-doc-table">
    <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData" />

    <ArtTable
      :loading="loading"
      :data="data"
      :columns="columns"
      :pagination="pagination"
      @pagination:size-change="handleSizeChange"
      @pagination:current-change="handleCurrentChange"
    />

    <ElDrawer v-model="drawerVisible" title="单据详情" size="680px">
      <template v-if="currentDoc">
        <ElDescriptions :column="2" border>
          <ElDescriptionsItem label="单据号">{{ currentDoc.docNo }}</ElDescriptionsItem>
          <ElDescriptionsItem label="类型">
            <ElTag :type="TYPE_MAP[currentDoc.type].tagType" effect="plain">
              {{ TYPE_MAP[currentDoc.type].label }}
            </ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem v-if="currentDoc.supplierName" label="供应商">
            {{ currentDoc.supplierName }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="来源仓库">{{ currentDoc.warehouseName }}</ElDescriptionsItem>
          <ElDescriptionsItem v-if="currentDoc.sourceOrderNo" label="来源采购订单">
            {{ currentDoc.sourceOrderNo }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="目标仓库">
            {{ currentDoc.type === 'transfer' ? currentDoc.targetWarehouseName || '-' : '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="总数量">{{ currentDoc.totalQty }}</ElDescriptionsItem>
          <ElDescriptionsItem v-if="currentDoc.totalAmount" label="总金额">
            ¥ {{ currentDoc.totalAmount.toFixed(2) }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="状态">
            <ElTag :type="STATUS_MAP[currentDoc.status].tagType" effect="plain">
              {{ STATUS_MAP[currentDoc.status].label }}
            </ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="制单人">{{ currentDoc.operator || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem v-if="currentDoc.reviewerName" label="审核人">
            {{ currentDoc.reviewerName }}
          </ElDescriptionsItem>
          <ElDescriptionsItem v-if="currentDoc.reviewTime" label="审核时间">
            {{ currentDoc.reviewTime }}
          </ElDescriptionsItem>
          <ElDescriptionsItem v-if="currentDoc.stockInUserName" label="入库人">
            {{ currentDoc.stockInUserName }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="创建时间">{{ currentDoc.createTime }}</ElDescriptionsItem>
          <ElDescriptionsItem label="完成时间">{{
            currentDoc.finishTime || '-'
          }}</ElDescriptionsItem>
          <ElDescriptionsItem label="备注" :span="2">
            {{ currentDoc.remark || '-' }}
          </ElDescriptionsItem>
        </ElDescriptions>

        <div class="mt-4 mb-2 text-sm font-medium">商品明细</div>
        <ElTable
          :data="currentDoc.items"
          border
          size="small"
          show-summary
          :summary-method="summaryMethod"
        >
          <ElTableColumn prop="productName" label="商品名称" min-width="140" />
          <ElTableColumn prop="barcode" label="条码" width="120" />
          <ElTableColumn prop="unit" label="单位" width="60" />
          <ElTableColumn prop="quantity" label="数量" width="80" align="right" />
          <ElTableColumn
            v-if="currentDoc.type === 'stocktake'"
            prop="actualQuantity"
            label="实盘数量"
            width="90"
            align="right"
          />
          <ElTableColumn label="单价" width="100" align="right">
            <template #default="{ row }">¥ {{ row.price.toFixed(2) }}</template>
          </ElTableColumn>
          <ElTableColumn label="金额" width="110" align="right">
            <template #default="{ row }">¥ {{ (row.price * row.quantity).toFixed(2) }}</template>
          </ElTableColumn>
        </ElTable>

        <ElAlert
          v-if="currentDoc.status === 'draft' || currentDoc.status === 'reviewed'"
          class="mt-3"
          type="info"
          :closable="false"
          show-icon
          :title="
            currentDoc.status === 'reviewed'
              ? '该单据已审核待入库，请核对明细后点击「确认入库」'
              : '该单据尚未审核，完成后系统将自动审核并入库'
          "
        />
      </template>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { fetchGetStockDocList, fetchFinishStockDoc, fetchCancelStockDoc } from '@/api/warehouse'
  import { ElTag, ElButton, ElMessageBox } from 'element-plus'

  type StockDoc = Api.Warehouse.StockDoc
  type StockDocType = Api.Warehouse.StockDocType
  type StockDocStatus = Api.Warehouse.StockDocStatus

  const TYPE_MAP: Record<
    StockDocType,
    { label: string; tagType: 'success' | 'warning' | 'primary' | 'danger' }
  > = {
    inbound: { label: '入库', tagType: 'success' },
    outbound: { label: '出库', tagType: 'warning' },
    transfer: { label: '调拨', tagType: 'primary' },
    stocktake: { label: '盘点', tagType: 'danger' }
  }

  const STATUS_MAP: Record<
    StockDocStatus,
    { label: string; tagType: 'success' | 'warning' | 'info' | 'primary' }
  > = {
    draft: { label: '待审核', tagType: 'warning' },
    reviewed: { label: '待入库', tagType: 'primary' },
    done: { label: '已完成', tagType: 'success' },
    canceled: { label: '已取消', tagType: 'info' }
  }

  interface Props {
    type: StockDocType
  }

  const props = defineProps<Props>()

  const drawerVisible = ref(false)
  const currentDoc = ref<StockDoc>()

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
    refreshCreate
  } = useTable({
    core: {
      apiFn: fetchGetStockDocList,
      apiParams: { current: 1, size: 20, type: props.type },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'docNo', label: '单据号', minWidth: 180 },
        {
          prop: 'type',
          label: '类型',
          width: 80,
          formatter: (row: StockDoc) =>
            h(
              ElTag,
              { type: TYPE_MAP[row.type].tagType, effect: 'plain' },
              () => TYPE_MAP[row.type].label
            )
        },
        { prop: 'warehouseName', label: '来源仓库', minWidth: 120 },
        ...(props.type === 'inbound'
          ? [
              {
                prop: 'sourceOrderNo',
                label: '来源采购订单',
                minWidth: 150,
                formatter: (row: StockDoc) => row.sourceOrderNo || '-'
              }
            ]
          : []),
        {
          prop: 'targetWarehouseName',
          label: '目标仓库',
          minWidth: 120,
          formatter: (row: StockDoc) =>
            row.type === 'transfer' ? row.targetWarehouseName || '-' : '-'
        },
        { prop: 'totalQty', label: '总数量', width: 90 },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: StockDoc) =>
            h(
              ElTag,
              { type: STATUS_MAP[row.status].tagType, effect: 'plain' },
              () => STATUS_MAP[row.status].label
            )
        },
        { prop: 'operator', label: '制单人', width: 100 },
        { prop: 'createTime', label: '创建时间', width: 170, sortable: true },
        {
          prop: 'finishTime',
          label: '完成时间',
          width: 170,
          formatter: (row: StockDoc) => row.finishTime || '-'
        },
        {
          prop: 'operation',
          label: '操作',
          width: 180,
          fixed: 'right',
          formatter: (row: StockDoc) =>
            h('div', { class: 'flex-c' }, [
              // 详情：所有状态都可查看（入库前需要核对单据内容）
              h(ArtButtonTable, { type: 'view', onClick: () => openDetail(row) }),
              // 完成：草稿/已审核的单据可执行（入库单为「审核 → 入库」两步）
              row.status === 'draft' || row.status === 'reviewed'
                ? h(
                    ElButton,
                    {
                      type: 'primary',
                      link: true,
                      size: 'small',
                      onClick: () => handleFinish(row)
                    },
                    () => (row.status === 'reviewed' ? '确认入库' : '完成')
                  )
                : null,
              row.status === 'draft'
                ? h(
                    ElButton,
                    { type: 'danger', link: true, size: 'small', onClick: () => handleCancel(row) },
                    () => '取消'
                  )
                : null
            ])
        }
      ]
    }
  })

  const openDetail = (row: StockDoc) => {
    currentDoc.value = row
    drawerVisible.value = true
  }

  /** 商品明细合计（数量与金额） */
  const summaryMethod = ({
    columns: cols,
    data: rows
  }: {
    columns: any[]
    data: Api.Warehouse.StockDocItem[]
  }) => {
    const sums: string[] = []
    cols.forEach((column, index) => {
      if (index === 0) {
        sums[0] = '合计'
        return
      }
      if (column.property === 'quantity') {
        sums[index] = String(rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0))
      } else if (column.property === 'salePrice' || column.property === 'totalPrice') {
        const total = rows.reduce(
          (sum, row) => sum + (Number(row.price) || 0) * (Number(row.quantity) || 0),
          0
        )
        sums[index] = `¥ ${total.toFixed(2)}`
      } else {
        sums[index] = ''
      }
    })
    return sums
  }

  const handleFinish = (row: StockDoc) => {
    // 采购入库单为「审核 → 入库」两步，已审核的单据直接执行入库
    const isReviewed = row.status === 'reviewed'
    const text = isReviewed
      ? `确定对单据「${row.docNo}」执行入库吗？入库后库存将立即增加，请先核对商品明细。`
      : `确定完成单据「${row.docNo}」吗？完成后将立即生效。`
    ElMessageBox.confirm(text, isReviewed ? '确认入库' : '完成单据', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        await fetchFinishStockDoc(row.id)
        ElMessage.success(isReviewed ? '入库完成，库存已增加' : '单据已完成，库存已更新')
        refreshData()
      })
      .catch(() => undefined)
  }

  const handleCancel = (row: StockDoc) => {
    ElMessageBox.confirm(`确定取消单据「${row.docNo}」吗？取消后不可恢复。`, '取消单据', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        await fetchCancelStockDoc(row.id)
        ElMessage.success('单据已取消')
        refreshData()
      })
      .catch(() => undefined)
  }

  const refresh = () => {
    refreshCreate()
  }

  defineExpose({ refresh })
</script>
