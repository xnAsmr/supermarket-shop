<!-- 库存预警中心 -->
<template>
  <div class="stock-warning-page art-full-height">
    <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
      <ElCard shadow="never" class="warning-stat-card">
        <p class="text-sm text-g-500">缺货商品</p>
        <p class="mt-2 text-2xl font-semibold text-danger">{{ stats.outOfStock }}</p>
        <p class="mt-1 text-xs text-g-500">货架库存为 0，需立即补货</p>
      </ElCard>
      <ElCard shadow="never" class="warning-stat-card">
        <p class="text-sm text-g-500">紧急商品</p>
        <p class="mt-2 text-2xl font-semibold text-danger">{{ stats.urgent }}</p>
        <p class="mt-1 text-xs text-g-500">货架库存已触及紧急线</p>
      </ElCard>
      <ElCard shadow="never" class="warning-stat-card">
        <p class="text-sm text-g-500">预警商品</p>
        <p class="mt-2 text-2xl font-semibold text-warning">{{ stats.warning }}</p>
        <p class="mt-1 text-xs text-g-500">货架库存低于预警线</p>
      </ElCard>
    </div>

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="handleRefresh">
        <template #left>
          <ElButton v-if="hasAuth('settings')" v-ripple @click="settingsVisible = true">
            批量设置预警线/紧急线
          </ElButton>
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
    </ElCard>

    <WarningSettingsDialog v-model:visible="settingsVisible" @success="handleRefresh" />
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import { useAuth } from '@/hooks/core/useAuth'
  import { fetchGetStockList } from '@/api/warehouse'
  import { ElButton, ElTag } from 'element-plus'
  import WarningSettingsDialog from './modules/warning-settings-dialog.vue'
  import {
    REPLENISH_TYPE,
    STOCK_STATUS,
    STOCK_STATUS_WEIGHT
  } from '@/views/warehouse/modules/shelf-status'

  defineOptions({ name: 'StockWarning' })

  type StockItem = Api.Warehouse.StockItem

  const { hasAuth } = useAuth()
  const settingsVisible = ref(false)

  const stats = reactive({
    outOfStock: 0,
    urgent: 0,
    warning: 0
  })

  /** 预警中心一次性取全量预警商品，前端按严重程度排序后分页 */
  const fetchWarningPage = async (
    params: Api.Warehouse.StockSearchParams
  ): Promise<Api.Warehouse.StockList> => {
    const current = Math.max(1, Number(params.current) || 1)
    const size = Math.max(1, Number(params.size) || 20)
    const page = await fetchGetStockList({
      ...params,
      warnLevel: 'warning',
      current: 1,
      size: 500
    })
    const sorted = [...page.records].sort(
      (a, b) =>
        (STOCK_STATUS_WEIGHT[a.stockStatus] ?? 3) - (STOCK_STATUS_WEIGHT[b.stockStatus] ?? 3) ||
        a.shelfQuantity - b.shelfQuantity ||
        a.productName.localeCompare(b.productName)
    )
    const start = (current - 1) * size
    return {
      records: sorted.slice(start, start + size),
      current,
      size,
      total: sorted.length
    }
  }

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    handleSizeChange,
    handleCurrentChange,
    refreshData
  } = useTable({
    core: {
      apiFn: fetchWarningPage,
      apiParams: { current: 1, size: 20 },
      columnsFactory: () => [
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
          prop: 'shelfQuantity',
          label: '货架库存',
          width: 100,
          align: 'right',
          sortable: true,
          formatter: (row: StockItem) =>
            h(
              'span',
              { class: 'font-semibold text-danger' },
              `${row.shelfQuantity}${row.unit ? ` ${row.unit}` : ''}`
            )
        },
        { prop: 'warnThreshold', label: '预警线', width: 90, align: 'right' },
        { prop: 'urgentThreshold', label: '紧急线', width: 90, align: 'right' },
        { prop: 'warehouseQuantity', label: '仓库库存', width: 100, align: 'right' },
        { prop: 'pendingInQuantity', label: '在途', width: 80, align: 'right' },
        {
          prop: 'stockStatus',
          label: '状态',
          width: 90,
          formatter: (row: StockItem) => {
            const status = STOCK_STATUS[row.stockStatus] ?? STOCK_STATUS.normal
            return h(
              ElTag,
              { type: status.type, effect: 'plain', size: 'small', style: status.style },
              () => status.text
            )
          }
        },
        {
          prop: 'replenishType',
          label: '补货方式',
          width: 110,
          formatter: (row: StockItem) =>
            row.replenishType ? (REPLENISH_TYPE[row.replenishType]?.text ?? '-') : '-'
        }
      ]
    }
  })

  const loadStats = async () => {
    try {
      const [outOfStock, urgent, all] = await Promise.all([
        fetchGetStockList({ warnLevel: 'out_of_stock', current: 1, size: 1 }),
        fetchGetStockList({ warnLevel: 'urgent', current: 1, size: 1 }),
        fetchGetStockList({ warnLevel: 'warning', current: 1, size: 1 })
      ])
      stats.outOfStock = outOfStock.total
      stats.urgent = urgent.total
      stats.warning = Math.max(0, all.total - outOfStock.total - urgent.total)
    } catch (error) {
      console.error(error)
    }
  }

  const handleRefresh = async () => {
    await refreshData()
    loadStats()
  }

  onMounted(loadStats)

  // keep-alive 返回页面时刷新预警数据（收银 / 出入库后库存可能已变化）
  let activatedOnce = false
  onActivated(() => {
    if (!activatedOnce) {
      activatedOnce = true
      return
    }
    refreshData()
    loadStats()
  })
</script>

<style lang="scss" scoped>
  .warning-stat-card {
    :deep(.el-card__body) {
      padding: 14px 18px;
    }
  }
</style>
