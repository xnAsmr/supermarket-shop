<!-- 操作日志（sys_operation_log：@LogOperation AOP 采集的业务操作记录） -->
<template>
  <div class="operation-log-page art-full-height">
    <!-- 筛选区独立成卡：表格卡片是固定一屏高，筛选栏放在卡片内会把表格和分页一起挤出可视区 -->
    <ElCard class="mb-3">
      <ElSpace wrap>
        <ElInput
          v-model="searchForm.module"
          placeholder="模块（如 商品管理）"
          clearable
          class="!w-44"
          @keyup.enter="handleSearch"
        />
        <ElInput
          v-model="searchForm.username"
          placeholder="操作用户"
          clearable
          class="!w-36"
          @keyup.enter="handleSearch"
        />
        <ElSelect v-model="searchForm.status" placeholder="状态" clearable class="!w-28">
          <ElOption label="成功" :value="1" />
          <ElOption label="失败" :value="0" />
        </ElSelect>
        <ElDatePicker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          class="!w-64"
        />
        <ElButton type="primary" v-ripple @click="handleSearch">查询</ElButton>
        <ElButton v-ripple @click="handleReset">重置</ElButton>
        <ElButton v-ripple :loading="loading" @click="loadList">刷新</ElButton>
      </ElSpace>
    </ElCard>

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="loadList">
        <template #left>
          <ElSpace wrap>
            <!-- 导出：先选字段再生成文件；权限控制与清理按钮同一套 hasAuth 判定 -->
            <ElButton
              v-if="hasAuth('operation:export')"
              type="primary"
              plain
              v-ripple
              :loading="preparing"
              @click="openExport"
            >
              导出
            </ElButton>
            <ElButton
              v-if="hasAuth('operation:clean')"
              type="danger"
              plain
              v-ripple
              @click="cleanVisible = true"
            >
              清理日志
            </ElButton>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <!-- ArtTable 内部接管滚动与分页：表体滚动、分页固定在卡片底部，长列表也不会被裁掉 -->
      <ArtTable
        :loading="loading"
        :data="list"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <!-- 导出弹窗：数据为当前筛选条件下的全量记录，选好字段并确认后才真正下载 -->
    <ArtExportFieldsDialog
      v-model="exportVisible"
      title="导出操作日志"
      sheet-name="操作日志"
      filename-prefix="操作日志"
      :fields="exportFields"
      :rows="exportRows"
      :default-selected="visibleExportProps"
    />

    <!-- 详情抽屉：请求参数（已脱敏）/ 返回结果 / 报错信息 -->
    <ElDrawer
      v-model="detailVisible"
      size="560px"
      :title="`操作详情 - ${currentRow?.operation ?? ''}`"
    >
      <template v-if="currentRow">
        <ElDescriptions :column="1" border size="small">
          <ElDescriptionsItem label="模块">{{ currentRow.module }}</ElDescriptionsItem>
          <ElDescriptionsItem label="操作">{{ currentRow.operation }}</ElDescriptionsItem>
          <ElDescriptionsItem v-if="currentRow.description" label="描述">
            {{ currentRow.description }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="用户">{{ currentRow.username }}</ElDescriptionsItem>
          <ElDescriptionsItem v-if="currentRow.tenantName" label="租户">
            {{ currentRow.tenantName }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="状态">
            <ElTag
              :type="currentRow.status === 1 ? 'success' : 'danger'"
              effect="plain"
              size="small"
            >
              {{ currentRow.status === 1 ? '成功' : '失败' }}
            </ElTag>
          </ElDescriptionsItem>
          <ElDescriptionsItem label="方法">{{ currentRow.method }}</ElDescriptionsItem>
          <ElDescriptionsItem label="URL">{{ currentRow.url }}</ElDescriptionsItem>
          <ElDescriptionsItem label="IP">{{ currentRow.ip }}</ElDescriptionsItem>
          <ElDescriptionsItem label="耗时">{{ currentRow.duration ?? 0 }} ms</ElDescriptionsItem>
          <ElDescriptionsItem label="时间">{{ currentRow.createTime }}</ElDescriptionsItem>
        </ElDescriptions>

        <div v-if="currentRow.errorMsg" class="mt-4">
          <p class="mb-1 text-sm font-medium text-danger">报错信息</p>
          <pre class="log-json">{{ currentRow.errorMsg }}</pre>
        </div>

        <div class="mt-4">
          <p class="mb-1 text-sm font-medium">请求参数（敏感字段已脱敏）</p>
          <pre class="log-json">{{ formatJson(currentRow.params) }}</pre>
        </div>

        <div class="mt-4">
          <p class="mb-1 text-sm font-medium">返回结果</p>
          <pre class="log-json">{{ formatJson(currentRow.result) }}</pre>
        </div>
      </template>
    </ElDrawer>

    <!-- 清理日志：按保留天数删除或清空全部（仅平台超级管理员可见） -->
    <ArtLogCleanDialog
      v-model="cleanVisible"
      label="操作日志"
      :loading="cleaning"
      @confirm="handleCleanConfirm"
    />
  </div>
</template>

<script setup lang="ts">
  import { clearOperationLogs, fetchGetOperationLogList } from '@/api/log'
  import ArtLogCleanDialog from '@/components/core/others/art-log-clean-dialog/index.vue'
  import ArtExportFieldsDialog from '@/components/core/others/art-export-fields-dialog/index.vue'
  import { useAuth } from '@/hooks/core/useAuth'
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { ElMessage, ElOption, ElTag } from 'element-plus'
  import type { ColumnOption } from '@/types/component'

  defineOptions({ name: 'OperationLog' })

  const { hasAuth } = useAuth()

  type OperationLogItem = Api.Log.OperationLogItem

  const loading = ref(false)
  const list = ref<OperationLogItem[]>([])
  const pagination = reactive({ current: 1, size: 20, total: 0 })

  /** 列配置统一交给 useTableColumns，表头「列设置」里的显隐与拖拽排序才会真正生效 */
  const { columns, columnChecks } = useTableColumns<OperationLogItem>(() => [
    { type: 'index', label: '序号', width: 60 },
    { prop: 'module', label: '模块', width: 110, showOverflowTooltip: true },
    {
      prop: 'description',
      label: '操作',
      minWidth: 180,
      showOverflowTooltip: true,
      formatter: (row: OperationLogItem) => row.description || row.operation
    },
    { prop: 'username', label: '用户', width: 110, showOverflowTooltip: true },
    {
      prop: 'tenantName',
      label: '租户',
      width: 130,
      showOverflowTooltip: true,
      formatter: (row: OperationLogItem) => row.tenantName || '-'
    },
    {
      prop: 'status',
      label: '状态',
      width: 80,
      align: 'center',
      formatter: (row: OperationLogItem) =>
        h(
          ElTag,
          { effect: 'plain', size: 'small', type: row.status === 1 ? 'success' : 'danger' },
          () => (row.status === 1 ? '成功' : '失败')
        ),
      // 导出用纯文本：formatter 返回的是 VNode，无法直接写进单元格
      exportText: (row: OperationLogItem) => (row.status === 1 ? '成功' : '失败')
    },
    { prop: 'ip', label: 'IP', width: 130 },
    {
      prop: 'duration',
      label: '耗时',
      width: 90,
      align: 'right',
      formatter: (row: OperationLogItem) => `${row.duration ?? 0} ms`
    },
    { prop: 'createTime', label: '操作时间', width: 170, sortable: true },
    {
      prop: 'operation',
      label: '详情',
      width: 90,
      fixed: 'right',
      align: 'center',
      // 按钮列不参与导出
      exportable: false,
      formatter: (row: OperationLogItem) =>
        h(
          ElButton,
          { link: true, type: 'primary', size: 'small', onClick: () => openDetail(row) },
          () => '详情'
        )
    }
  ])

  const searchForm = reactive<{
    module: string
    username: string
    status: number | undefined
  }>({ module: '', username: '', status: undefined })
  const dateRange = ref<[string, string] | null>(null)

  const detailVisible = ref(false)
  const currentRow = ref<OperationLogItem | null>(null)

  /* ------------------------------ 清理日志 ------------------------------ */

  const cleanVisible = ref(false)
  const cleaning = ref(false)

  /** 清理日志：beforeDate 为空表示清空全部（后端仅平台超级管理员可执行） */
  const handleCleanConfirm = async ({ beforeDate }: { beforeDate?: string }) => {
    cleaning.value = true
    try {
      const count = await clearOperationLogs({ beforeDate })
      ElMessage.success(`已清理 ${count} 条操作日志`)
      cleanVisible.value = false
      pagination.current = 1
      loadList()
    } catch (error) {
      console.error(error)
    } finally {
      cleaning.value = false
    }
  }

  /* ------------------------------ 导出 Excel ------------------------------ */

  /** 单页拉取条数：后端分页插件 maxLimit=500，超过会被截断 */
  const EXPORT_PAGE_SIZE = 500
  /** 导出上限：避免一次性渲染过多行拖慢页面，超出提示收窄筛选条件 */
  const EXPORT_MAX_ROWS = 20000

  const preparing = ref(false)
  const exportVisible = ref(false)
  const exportRows = ref<OperationLogItem[]>([])

  /** 可导出字段：沿用表格列的 prop / label 与顺序；text 负责把徽章列转成纯文本 */
  const exportFields = computed(() =>
    columnChecks.value
      .filter((col: ColumnOption) => col.prop && !col.type && col.exportable !== false)
      .map((col: ColumnOption) => ({
        prop: col.prop as string,
        label: (col.label as string) || (col.prop as string),
        text: (row: OperationLogItem) => {
          if (typeof col.exportText === 'function') return String(col.exportText(row) ?? '')
          const value = col.formatter ? col.formatter(row) : (row as any)[col.prop as string]
          return value === null || value === undefined || typeof value === 'object'
            ? ''
            : String(value)
        }
      }))
  )

  /** 默认勾选当前可见列，保证弹窗初始状态与表格列设置一致 */
  const visibleExportProps = computed(() =>
    columns.value
      .filter((col: ColumnOption) => col.prop && !col.type)
      .map((col: ColumnOption) => col.prop as string)
  )

  /** 导出为分页循环拉全量：日志接口只提供分页查询，按当前筛选条件逐页取满 total */
  const openExport = async () => {
    preparing.value = true
    try {
      const rows: OperationLogItem[] = []
      let current = 1
      for (;;) {
        const res = await fetchGetOperationLogList({
          ...searchForm,
          startDate: dateRange.value?.[0] ?? '',
          endDate: dateRange.value?.[1] ?? '',
          current,
          size: EXPORT_PAGE_SIZE
        })
        rows.push(...res.records)
        // 空页 / 已取满总数 / 触达上限即停止，避免空转
        if (!res.records.length || rows.length >= res.total || rows.length >= EXPORT_MAX_ROWS) break
        current += 1
      }
      if (!rows.length) {
        ElMessage.warning('当前筛选条件下没有可导出的数据')
        return
      }
      if (rows.length >= EXPORT_MAX_ROWS) {
        ElMessage.warning(`数据量超过 ${EXPORT_MAX_ROWS} 条，本次仅导出前 ${EXPORT_MAX_ROWS} 条`)
      }
      exportRows.value = rows
      exportVisible.value = true
    } catch (error) {
      console.error(error)
    } finally {
      preparing.value = false
    }
  }

  const loadList = async () => {
    loading.value = true
    try {
      const res = await fetchGetOperationLogList({
        ...searchForm,
        startDate: dateRange.value?.[0] ?? '',
        endDate: dateRange.value?.[1] ?? '',
        current: pagination.current,
        size: pagination.size
      })
      list.value = res.records
      pagination.total = res.total
    } catch (error) {
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  const handleSearch = () => {
    pagination.current = 1
    loadList()
  }

  const handleReset = () => {
    searchForm.module = ''
    searchForm.username = ''
    searchForm.status = undefined
    dateRange.value = null
    handleSearch()
  }

  /** 每页条数变化：回到第 1 页重新取数 */
  const handleSizeChange = (size: number) => {
    pagination.size = size
    pagination.current = 1
    loadList()
  }

  /** 页码变化 */
  const handleCurrentChange = (current: number) => {
    pagination.current = current
    loadList()
  }

  const openDetail = (row: OperationLogItem) => {
    currentRow.value = row
    detailVisible.value = true
  }

  /** JSON 字符串美化展示（非法 JSON 原样返回） */
  const formatJson = (text?: string): string => {
    if (!text) return '—'
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return text
    }
  }

  onMounted(loadList)
</script>

<style lang="scss" scoped>
  .log-json {
    max-height: 260px;
    margin: 0;
    padding: 10px 12px;
    overflow: auto;
    font-family: Consolas, Monaco, monospace;
    font-size: 12px;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-all;
    background: var(--art-gray-100);
    border: 1px solid var(--art-gray-200);
    border-radius: 8px;
  }
</style>
