<!-- 库存查询 -->
<template>
  <div class="warehouse-stock-page art-full-height">
    <StockSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
      <ElCard shadow="never" class="stock-stat-card">
        <p class="text-sm text-g-500">预警商品总数</p>
        <p class="mt-2 text-2xl font-semibold text-warning">{{ warnStats.total }}</p>
        <p class="mt-1 text-xs text-g-500">货架库存低于预警线的商品</p>
      </ElCard>
      <ElCard shadow="never" class="stock-stat-card">
        <p class="text-sm text-g-500">紧急商品</p>
        <p class="mt-2 text-2xl font-semibold text-danger">{{ warnStats.urgent }}</p>
        <p class="mt-1 text-xs text-g-500">货架库存已触及紧急线</p>
      </ElCard>
      <ElCard shadow="never" class="stock-stat-card">
        <p class="text-sm text-g-500">缺货商品</p>
        <p class="mt-2 text-2xl font-semibold text-danger">{{ warnStats.outOfStock }}</p>
        <p class="mt-1 text-xs text-g-500">货架库存为 0，收银台无法销售</p>
      </ElCard>
    </div>

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="handleRefresh" />

      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import { fetchGetStockList } from '@/api/warehouse'
  import StockSearch from './modules/stock-search.vue'
  import { ElTag } from 'element-plus'
  import { REPLENISH_TYPE, STOCK_STATUS } from '@/views/warehouse/modules/shelf-status'

  defineOptions({ name: 'WarehouseStock' })

  type StockItem = Api.Warehouse.StockItem

  const searchForm = ref<Api.Warehouse.StockSearchParams>({
    productName: undefined,
    barcode: undefined,
    warehouseId: undefined,
    categoryId: undefined,
    warnLevel: undefined
  })

  const warnStats = reactive({
    total: 0,
    urgent: 0,
    outOfStock: 0
  })

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
      apiFn: fetchGetStockList,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        {
          prop: 'productName',
          label: '商品信息',
          minWidth: 220,
          formatter: (row: StockItem) =>
            h('div', { class: 'leading-5' }, [
              h('p', { class: 'font-medium' }, row.productName),
              h('p', { class: 'text-xs text-gray-400' }, row.barcode)
            ])
        },
        { prop: 'warehouseName', label: '仓库', width: 130 },
        {
          prop: 'pendingInQuantity',
          label: '在途',
          width: 80,
          align: 'right'
        },
        {
          prop: 'warehouseQuantity',
          label: '仓库',
          width: 80,
          align: 'right',
          sortable: true
        },
        {
          prop: 'shelfQuantity',
          label: '货架',
          width: 90,
          align: 'right',
          sortable: true,
          formatter: (row: StockItem) =>
            h(
              'span',
              { class: 'font-semibold text-primary' },
              `${row.shelfQuantity}${row.unit ? ` ${row.unit}` : ''}`
            )
        },
        {
          prop: 'totalQuantity',
          label: '合计',
          width: 90,
          align: 'right',
          sortable: true
        },
        {
          prop: 'warnThreshold',
          label: '预警线/紧急线',
          width: 120,
          align: 'center',
          formatter: (row: StockItem) => `${row.warnThreshold} / ${row.urgentThreshold}`
        },
        {
          prop: 'stockStatus',
          label: '状态',
          width: 120,
          formatter: (row: StockItem) => renderStockStatus(row)
        },
        {
          prop: 'purchasePrice',
          label: '进价',
          width: 100,
          formatter: (row: StockItem) => `¥ ${row.purchasePrice.toFixed(2)}`
        }
      ]
    }
  })

  /** 状态标签 + 补货方式提示 */
  const renderStockStatus = (row: StockItem) => {
    const status = STOCK_STATUS[row.stockStatus] ?? STOCK_STATUS.normal
    const children = [
      h(
        ElTag,
        { type: status.type, effect: 'plain', size: 'small', style: status.style },
        () => status.text
      )
    ]
    if (row.replenishType) {
      children.push(
        h(
          'p',
          { class: 'mt-0.5 text-xs text-g-500' },
          REPLENISH_TYPE[row.replenishType]?.text ?? ''
        )
      )
    }
    return h('div', { class: 'leading-5' }, children)
  }

  const loadWarnStats = async () => {
    try {
      const [all, urgent, outOfStock] = await Promise.all([
        fetchGetStockList({ warnLevel: 'warning', current: 1, size: 1 }),
        fetchGetStockList({ warnLevel: 'urgent', current: 1, size: 1 }),
        fetchGetStockList({ warnLevel: 'out_of_stock', current: 1, size: 1 })
      ])
      warnStats.total = all.total
      warnStats.urgent = urgent.total
      warnStats.outOfStock = outOfStock.total
    } catch (error) {
      console.error(error)
    }
  }

  const handleRefresh = async () => {
    await refreshData()
    loadWarnStats()
  }

  const handleSearch = (params: Api.Warehouse.StockSearchParams) => {
    replaceSearchParams({ ...params, warnLevel: params.warnLevel || undefined })
    getData()
  }

  onMounted(loadWarnStats)

  // keep-alive 返回页面时刷新库存与统计（上架 / 收银后库存可能已变化）
  let activatedOnce = false
  onActivated(() => {
    if (!activatedOnce) {
      activatedOnce = true
      return
    }
    handleRefresh()
  })
</script>

<style lang="scss" scoped>
  .stock-stat-card {
    :deep(.el-card__body) {
      padding: 14px 18px;
    }
  }
</style>
