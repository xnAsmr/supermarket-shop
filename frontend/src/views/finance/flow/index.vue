<!-- 收支流水 -->
<template>
  <div class="finance-flow-page art-full-height">
    <FlowSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton type="primary" v-ripple @click="dialogVisible = true">记一笔</ElButton>
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

      <FlowDialog v-model:visible="dialogVisible" @success="handleDialogSuccess" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import { fetchGetFlowList } from '@/api/finance'
  import { ElTag } from 'element-plus'
  import FlowSearch from './modules/flow-search.vue'
  import FlowDialog from './modules/flow-dialog.vue'

  defineOptions({ name: 'FinanceFlow' })

  type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'
  type FlowItem = Api.Finance.FlowItem
  type FlowSearchFormParams = Api.Finance.FlowSearchParams & {
    daterange?: string[]
  }

  const TYPE_TAG = {
    income: { type: 'success' as TagType, text: '收入' },
    expense: { type: 'danger' as TagType, text: '支出' }
  }

  const searchForm = ref<FlowSearchFormParams>({
    type: undefined,
    category: undefined,
    flowNo: undefined,
    relatedNo: undefined,
    daterange: undefined
  })

  const dialogVisible = ref(false)

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
    refreshCreate
  } = useTable({
    core: {
      apiFn: fetchGetFlowList,
      apiParams: { current: 1, size: 20 },
      excludeParams: ['daterange'],
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'flowNo', label: '流水号', minWidth: 180 },
        {
          prop: 'type',
          label: '类型',
          width: 80,
          formatter: (row: FlowItem) =>
            h(
              ElTag,
              { type: TYPE_TAG[row.type].type, effect: 'plain' },
              () => TYPE_TAG[row.type].text
            )
        },
        { prop: 'category', label: '分类', width: 110 },
        {
          prop: 'amount',
          label: '金额',
          width: 120,
          align: 'right',
          formatter: (row: FlowItem) =>
            h(
              'span',
              {
                class:
                  row.type === 'income' ? 'text-success font-medium' : 'text-danger font-medium'
              },
              `¥ ${row.amount.toFixed(2)}`
            )
        },
        {
          prop: 'method',
          label: '方式',
          width: 100,
          formatter: (row: FlowItem) => row.method || '-'
        },
        {
          prop: 'relatedNo',
          label: '关联单号',
          minWidth: 150,
          formatter: (row: FlowItem) => row.relatedNo || '-'
        },
        {
          prop: 'operator',
          label: '操作人',
          width: 100,
          formatter: (row: FlowItem) => row.operator || '-'
        },
        { prop: 'createTime', label: '发生时间', width: 170, sortable: true },
        {
          prop: 'remark',
          label: '备注',
          minWidth: 160,
          showOverflowTooltip: true,
          formatter: (row: FlowItem) => row.remark || '-'
        }
      ]
    }
  })

  const handleSearch = (params: FlowSearchFormParams) => {
    const { daterange, ...filtersParams } = params
    const [startTime, endTime] = Array.isArray(daterange) ? daterange : [undefined, undefined]

    replaceSearchParams({ ...filtersParams, startTime, endTime })
    getData()
  }

  const handleDialogSuccess = () => {
    dialogVisible.value = false
    refreshCreate()
  }
</script>
