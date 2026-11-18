<!-- 预警设置：按商品设置库存预警线 / 紧急线（商品级阈值，支持多选批量应用） -->
<template>
  <ElDialog
    :model-value="visible"
    title="批量设置预警线/紧急线"
    width="800px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="mb-3 flex-c justify-between">
      <ElInput
        v-model="keyword"
        placeholder="搜索商品名称 / 条码"
        clearable
        class="w-64"
        :prefix-icon="'ri:search-line'"
      />
      <span class="text-xs text-g-500"> 货架库存低于预警线进入预警、低于紧急线进入紧急状态 </span>
    </div>

    <div
      class="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-gray-300 p-2"
    >
      <span class="text-xs text-g-500">批量设置</span>
      <span class="text-xs text-g-500">预警线</span>
      <ElInputNumber
        v-model="batchWarn"
        :min="0"
        :precision="0"
        controls-position="right"
        class="w-32"
        size="small"
      />
      <span class="text-xs text-g-500">紧急线</span>
      <ElInputNumber
        v-model="batchUrgent"
        :min="0"
        :max="batchWarn"
        :precision="0"
        controls-position="right"
        class="w-32"
        size="small"
      />
      <ElButton size="small" type="primary" plain @click="applyBatch">
        应用到{{ selectionCount ? `选中（${selectionCount}）` : `全部（${filteredRows.length}）` }}
      </ElButton>
      <span class="text-xs text-g-500">未勾选商品时应用到当前搜索结果</span>
    </div>

    <ElTable
      v-loading="loading"
      :data="filteredRows"
      border
      stripe
      max-height="460"
      @selection-change="handleSelectionChange"
    >
      <ElTableColumn type="selection" width="48" />
      <ElTableColumn label="商品" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="leading-5">
            <p class="font-medium">{{ row.name }}</p>
            <p class="text-xs text-gray-400">{{ row.barcode }}</p>
          </div>
        </template>
      </ElTableColumn>
      <ElTableColumn label="预警线" width="170">
        <template #default="{ row }">
          <ElInputNumber
            v-model="row.draftWarn"
            :min="0"
            :precision="0"
            controls-position="right"
            class="w-full"
            size="small"
          />
        </template>
      </ElTableColumn>
      <ElTableColumn label="紧急线" width="170">
        <template #default="{ row }">
          <ElInputNumber
            v-model="row.draftUrgent"
            :min="0"
            :max="row.draftWarn"
            :precision="0"
            controls-position="right"
            class="w-full"
            size="small"
          />
        </template>
      </ElTableColumn>
      <ElTableColumn label="状态" width="90" align="center">
        <template #default="{ row }">
          <ElTag v-if="isDirty(row)" type="warning" effect="plain" size="small">已修改</ElTag>
          <span v-else class="text-xs text-g-500">-</span>
        </template>
      </ElTableColumn>
    </ElTable>

    <p class="mt-2 text-xs text-g-500">
      共 {{ filteredRows.length }} 个商品<template v-if="dirtyCount">
        ，{{ dirtyCount }} 个待保存</template
      >
    </p>

    <template #footer>
      <ElButton @click="emit('update:visible', false)">取消</ElButton>
      <ElButton type="primary" :loading="saving" :disabled="!dirtyCount" @click="handleSave">
        保存修改{{ dirtyCount ? `（${dirtyCount}）` : '' }}
      </ElButton>
    </template>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchGetProductList } from '@/api/product'
  import { fetchBatchUpdateWarningThresholds } from '@/api/warehouse'
  import { ElButton, ElDialog, ElInput, ElInputNumber, ElMessage, ElTag } from 'element-plus'

  type SettingsRow = Api.Product.ProductItem & {
    draftWarn: number
    draftUrgent: number
  }

  const props = defineProps<{ visible: boolean }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
    (e: 'success'): void
  }>()

  const loading = ref(false)
  const saving = ref(false)
  const keyword = ref('')
  const rows = ref<SettingsRow[]>([])
  const selectedRows = ref<SettingsRow[]>([])

  const batchWarn = ref(10)
  const batchUrgent = ref(3)

  const filteredRows = computed(() => {
    const kw = keyword.value.trim().toLowerCase()
    if (!kw) return rows.value
    return rows.value.filter(
      (row) => row.name.toLowerCase().includes(kw) || row.barcode.toLowerCase().includes(kw)
    )
  })

  const selectionCount = computed(() => selectedRows.value.length)

  const isDirty = (row: SettingsRow) =>
    row.draftWarn !== row.warningStock || row.draftUrgent !== (row.stockUrgentThreshold ?? 3)

  const dirtyRows = computed(() => rows.value.filter(isDirty))
  const dirtyCount = computed(() => dirtyRows.value.length)

  const load = async () => {
    loading.value = true
    try {
      const page = await fetchGetProductList({ current: 1, size: 1000 })
      rows.value = page.records.map((item) => ({
        ...item,
        draftWarn: item.warningStock,
        draftUrgent: item.stockUrgentThreshold ?? 3
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
      if (visible) {
        keyword.value = ''
        selectedRows.value = []
        batchWarn.value = 10
        batchUrgent.value = 3
        load()
      }
    }
  )

  const handleSelectionChange = (selection: SettingsRow[]) => {
    selectedRows.value = selection
  }

  /** 批量应用阈值：优先应用到勾选行，未勾选则应用到当前搜索结果 */
  const applyBatch = () => {
    if (batchUrgent.value > batchWarn.value) {
      ElMessage.warning('紧急线不能大于预警线')
      return
    }
    const targets = selectedRows.value.length ? selectedRows.value : filteredRows.value
    if (!targets.length) {
      ElMessage.info('没有可应用的商品')
      return
    }
    targets.forEach((row) => {
      row.draftWarn = batchWarn.value
      row.draftUrgent = batchUrgent.value
    })
    ElMessage.success(`已应用到 ${targets.length} 个商品`)
  }

  const handleSave = async () => {
    for (const row of dirtyRows.value) {
      if (row.draftUrgent > row.draftWarn) {
        ElMessage.warning(`「${row.name}」的紧急线不能大于预警线`)
        return
      }
    }
    saving.value = true
    try {
      const payload: Api.Product.ProductItem[] = dirtyRows.value.map((row) => ({
        ...row,
        warningStock: row.draftWarn,
        stockUrgentThreshold: row.draftUrgent
      }))
      await fetchBatchUpdateWarningThresholds(payload)
      ElMessage.success(`已保存 ${dirtyCount.value} 个商品的预警设置`)
      emit('update:visible', false)
      emit('success')
    } catch (error) {
      console.error(error)
    } finally {
      saving.value = false
    }
  }
</script>
