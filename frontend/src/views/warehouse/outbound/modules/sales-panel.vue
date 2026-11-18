<!-- 销售出库面板（仓库 → 货架，原上架单） -->
<template>
  <div class="shelf-up-page art-full-height">
    <ShelfUpSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="showDialog()">
              新建销售出库
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

      <ShelfUpDialog
        v-model:visible="dialogVisible"
        :shelf-up-id="editingId"
        :preset-store-id="presetStoreId"
        :preset-items="presetItems"
        @success="handleDialogSuccess"
      />
    </ElCard>

    <ElDrawer v-model="drawerVisible" title="上架单详情" size="920px">
      <div v-loading="detailLoading" class="min-h-40">
        <template v-if="detail">
          <div class="mb-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <p>上架单号：{{ detail.shelfUpNo }}</p>
            <p>
              状态：
              <ElTag :type="SHELF_UP_STATUS[detail.status].type" effect="plain" size="small">
                {{ SHELF_UP_STATUS[detail.status].text }}
              </ElTag>
            </p>
            <p>上架门店：{{ detail.storeName || '-' }}</p>
            <p>上架数量：{{ detail.totalQuantity }}</p>
            <p>制单人：{{ detail.operatorName || '-' }}</p>
            <p>上架人：{{ detail.shelfUpUserName || '-' }}</p>
            <p>上架时间：{{ detail.shelfUpTime || '-' }}</p>
            <p>创建时间：{{ detail.createTime || '-' }}</p>
            <p class="col-span-2">备注：{{ detail.remark || '-' }}</p>
          </div>

          <p class="mb-2 font-medium">上架明细</p>
          <ElTable :data="detail.items" border stripe>
            <ElTableColumn
              prop="productName"
              label="商品名称"
              min-width="160"
              show-overflow-tooltip
            />
            <ElTableColumn prop="barcode" label="条码" width="130" />
            <ElTableColumn prop="spec" label="规格" width="100" />
            <ElTableColumn prop="unit" label="单位" width="70" />
            <ElTableColumn prop="quantity" label="本次上架" width="100" align="right" />
            <ElTableColumn label="当前仓库库存" width="120" align="right">
              <template #default="{ row }">
                <span
                  :class="
                    row.warehouseQuantity < row.quantity ? 'font-medium text-danger' : 'font-medium'
                  "
                >
                  {{ row.warehouseQuantity }}
                </span>
                <p v-if="row.warehouseQuantity < row.quantity" class="mt-0.5 text-xs text-danger">
                  库存不足
                </p>
              </template>
            </ElTableColumn>
            <ElTableColumn label="当前货架库存" width="120" align="right">
              <template #default="{ row }">{{ row.shelfQuantity }}</template>
            </ElTableColumn>
            <ElTableColumn prop="remark" label="备注" min-width="120" show-overflow-tooltip />
          </ElTable>
          <div class="mt-2 text-right text-sm text-gray-500">
            共 {{ detail.items.length }} 项，本次上架数量合计：{{ detail.totalQuantity }}
          </div>
        </template>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { useRoute, useRouter } from 'vue-router'
  import { useTable } from '@/hooks/core/useTable'
  import { useAuth } from '@/hooks/core/useAuth'
  import {
    fetchConfirmShelfUp,
    fetchDeleteShelfUp,
    fetchGetShelfUpDetail,
    fetchGetShelfUpList,
    fetchRollbackShelfUp
  } from '@/api/shelf-up'
  import { ElButton, ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import ShelfUpDialog from './shelf-up-dialog.vue'
  import ShelfUpSearch from './shelf-up-search.vue'
  import { SHELF_UP_STATUS } from '@/views/warehouse/modules/shelf-status'

  defineOptions({ name: 'OutboundSalesPanel' })

  const { hasAuth } = useAuth()
  const route = useRoute()
  const router = useRouter()

  type ShelfUpOrder = Api.Warehouse.ShelfUpOrder
  type SearchFormParams = Partial<Api.Warehouse.ShelfUpSearchParams> & {
    daterange?: string[]
  }

  interface PresetShelfUpItem {
    productId: string
    quantity: number
    productName?: string
    barcode?: string
    unit?: string
    spec?: string
  }

  const PRESET_STORAGE_KEY = 'shelf-up-preset'

  const searchForm = ref<SearchFormParams>({
    shelfUpNo: undefined,
    storeId: undefined,
    status: undefined,
    daterange: undefined
  })

  const dialogVisible = ref(false)
  const editingId = ref('')
  const presetStoreId = ref('')
  const presetItems = ref<PresetShelfUpItem[]>([])
  const drawerVisible = ref(false)
  const detailLoading = ref(false)
  const detail = ref<ShelfUpOrder | null>(null)

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
      apiFn: fetchGetShelfUpList,
      apiParams: { current: 1, size: 20 },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'shelfUpNo', label: '上架单号', minWidth: 180 },
        { prop: 'storeName', label: '门店', minWidth: 140 },
        { prop: 'totalQuantity', label: '上架数量', width: 100, align: 'right' },
        {
          prop: 'status',
          label: '状态',
          width: 100,
          formatter: (row: ShelfUpOrder) =>
            h(
              ElTag,
              { type: SHELF_UP_STATUS[row.status].type, effect: 'plain' },
              () => SHELF_UP_STATUS[row.status].text
            )
        },
        { prop: 'operatorName', label: '制单人', width: 110 },
        { prop: 'shelfUpUserName', label: '上架人', width: 110 },
        { prop: 'shelfUpTime', label: '上架时间', width: 170, sortable: true },
        { prop: 'createTime', label: '创建时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 270,
          fixed: 'right',
          formatter: (row: ShelfUpOrder) => renderActions(row)
        }
      ]
    }
  })

  const renderActions = (row: ShelfUpOrder) => {
    const viewButton = h(
      ElButton,
      { type: 'primary', link: true, onClick: () => openDetail(row) },
      () => '详情'
    )

    // 草稿：编辑 / 确认上架 / 删除 / 详情
    if (row.status === 'draft') {
      const buttons = []
      if (hasAuth('edit')) {
        buttons.push(
          h(
            ElButton,
            { type: 'primary', link: true, onClick: () => showDialog(row.id) },
            () => '编辑'
          ),
          h(
            ElButton,
            { type: 'success', link: true, onClick: () => handleConfirm(row) },
            () => '确认上架'
          )
        )
      }
      if (hasAuth('delete')) {
        buttons.push(
          h(
            ElButton,
            { type: 'danger', link: true, onClick: () => handleDelete(row) },
            () => '删除'
          )
        )
      }
      buttons.push(viewButton)
      return h('div', { class: 'flex-c' }, buttons)
    }

    // 已上架：撤销上架 / 详情
    if (row.status === 'confirmed') {
      const buttons = []
      if (hasAuth('delete')) {
        buttons.push(
          h(
            ElButton,
            { type: 'warning', link: true, onClick: () => handleRollback(row) },
            () => '撤销上架'
          )
        )
      }
      buttons.push(viewButton)
      return h('div', { class: 'flex-c' }, buttons)
    }

    // 已撤销：仅详情
    return h('div', { class: 'flex-c' }, [viewButton])
  }

  const showDialog = (id?: string, keepPreset = false) => {
    if (!keepPreset) {
      presetStoreId.value = ''
      presetItems.value = []
    }
    editingId.value = id ?? ''
    // 若弹窗仍开着（keep-alive 返回页面），先关闭再打开以重新初始化数据
    dialogVisible.value = false
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const handleDialogSuccess = () => {
    if (editingId.value) {
      refreshUpdate()
    } else {
      refreshCreate()
    }
  }

  const openDetail = async (row: ShelfUpOrder) => {
    detail.value = null
    drawerVisible.value = true
    detailLoading.value = true
    try {
      detail.value = await fetchGetShelfUpDetail(row.id)
    } catch (error) {
      console.error(error)
    } finally {
      detailLoading.value = false
    }
  }

  const handleConfirm = async (row: ShelfUpOrder) => {
    try {
      await ElMessageBox.confirm(
        `确认上架单「${row.shelfUpNo}」？确认后仓库库存将减少 ${row.totalQuantity}，货架库存将增加 ${row.totalQuantity}，商品即可在收银台销售。`,
        '确认上架',
        { confirmButtonText: '确认上架', cancelButtonText: '取消', type: 'warning' }
      )
      await fetchConfirmShelfUp(row.id)
      ElMessage.success('上架成功，货架库存已增加')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  const handleRollback = async (row: ShelfUpOrder) => {
    try {
      await ElMessageBox.confirm(
        `撤销上架单「${row.shelfUpNo}」？撤销后货架库存将减少 ${row.totalQuantity}，仓库库存将增加 ${row.totalQuantity}。若商品已在收银台售出导致货架库存不足，将无法撤销。`,
        '撤销上架',
        { confirmButtonText: '确认撤销', cancelButtonText: '取消', type: 'warning' }
      )
      await fetchRollbackShelfUp(row.id)
      ElMessage.success('已撤销上架，库存已回退至仓库')
      refreshUpdate()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  const handleDelete = async (row: ShelfUpOrder) => {
    try {
      await ElMessageBox.confirm(
        `删除上架单「${row.shelfUpNo}」将彻底删除该单据，且无法恢复。确定继续吗？`,
        '删除上架单',
        { confirmButtonText: '确定删除', cancelButtonText: '取消', type: 'error' }
      )
      await fetchDeleteShelfUp(row.id)
      ElMessage.success('上架单已删除')
      refreshRemove()
    } catch (error) {
      if (error === 'cancel' || error === 'close') return
      console.error(error)
    }
  }

  /** 搜索：合并日期区间并重新取数 */
  const handleSearch = (params: SearchFormParams) => {
    const { daterange, ...rest } = params
    const [startTime, endTime] = Array.isArray(daterange) ? daterange : [undefined, undefined]
    replaceSearchParams({ ...rest, startTime, endTime })
    getData()
  }

  /** 读取库存预警页 / 批量生成写入的预置明细 */
  const consumePreset = (): { storeId: string; items: PresetShelfUpItem[] } | null => {
    try {
      const raw = sessionStorage.getItem(PRESET_STORAGE_KEY)
      if (!raw) return null
      sessionStorage.removeItem(PRESET_STORAGE_KEY)
      const parsed = JSON.parse(raw) as {
        storeId?: string
        items?: PresetShelfUpItem[]
      }
      if (!Array.isArray(parsed.items) || !parsed.items.length) return null
      return { storeId: String(parsed.storeId ?? ''), items: parsed.items }
    } catch {
      return null
    }
  }

  /** 从库存预警页带入商品 / 批量明细（首次进入与 keep-alive 再激活均生效） */
  let lastPresetAt = 0
  const applyRoutePreset = () => {
    if (route.name !== 'WarehouseOutbound' || route.query.type === 'transfer') return
    const now = Date.now()
    if (now - lastPresetAt < 300) return
    lastPresetAt = now
    const query = route.query
    const preset = query.preset === 'batch' ? consumePreset() : null
    if (preset) {
      presetStoreId.value = preset.storeId
      presetItems.value = preset.items
      showDialog(undefined, true)
      // 清理 query，避免 keep-alive 返回页面时重复弹出预置弹窗
      router.replace({ name: 'WarehouseOutbound' })
      return
    }
    const productId = String(query.productId ?? '')
    if (!productId) return
    const quantity = Number(query.quantity)
    presetStoreId.value = String(query.storeId ?? '')
    presetItems.value = [
      {
        productId,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        productName: query.productName ? String(query.productName) : undefined,
        barcode: query.barcode ? String(query.barcode) : undefined,
        unit: query.unit ? String(query.unit) : undefined,
        spec: query.spec ? String(query.spec) : undefined
      }
    ]
    showDialog(undefined, true)
    // 清理 query，避免 keep-alive 返回页面时重复弹出预置弹窗
    router.replace({ name: 'WarehouseOutbound' })
  }

  watch(() => route.fullPath, applyRoutePreset)
  onMounted(applyRoutePreset)
  onActivated(applyRoutePreset)
  onDeactivated(() => {
    dialogVisible.value = false
    drawerVisible.value = false
  })
</script>
