<!-- 日结管理 -->
<template>
  <div class="finance-daily-page art-full-height">
    <DailySearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton type="primary" v-ripple :loading="generating" @click="handleGenerate">
              生成今日日结
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
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import { fetchGetDailyList, fetchGenerateDaily } from '@/api/finance'
  import { ElTag } from 'element-plus'
  import DailySearch from './modules/daily-search.vue'

  defineOptions({ name: 'FinanceDaily' })

  type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger'
  type DailyItem = Api.Finance.DailyItem

  const DAILY_STATUS = {
    settled: { type: 'success' as TagType, text: '已日结' },
    pending: { type: 'warning' as TagType, text: '待日结' }
  }

  const searchForm = ref<Api.Finance.DailySearchParams>({
    date: undefined,
    status: undefined
  })

  const generating = ref(false)

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
      apiFn: fetchGetDailyList,
      apiParams: { current: 1, size: 20 },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'date', label: '日期', width: 120 },
        {
          prop: 'salesAmount',
          label: '销售额',
          width: 120,
          align: 'right',
          sortable: true,
          formatter: (row: DailyItem) => `¥ ${row.salesAmount.toFixed(2)}`
        },
        {
          prop: 'refundAmount',
          label: '退款额',
          width: 120,
          align: 'right',
          formatter: (row: DailyItem) => `¥ ${row.refundAmount.toFixed(2)}`
        },
        {
          prop: 'incomeAmount',
          label: '收入',
          width: 120,
          align: 'right',
          formatter: (row: DailyItem) => `¥ ${row.incomeAmount.toFixed(2)}`
        },
        {
          prop: 'expenseAmount',
          label: '支出',
          width: 120,
          align: 'right',
          formatter: (row: DailyItem) => `¥ ${row.expenseAmount.toFixed(2)}`
        },
        {
          prop: 'netAmount',
          label: '结余',
          width: 120,
          align: 'right',
          formatter: (row: DailyItem) =>
            h(
              'span',
              {
                class: row.netAmount >= 0 ? 'text-success font-medium' : 'text-danger font-medium'
              },
              `¥ ${row.netAmount.toFixed(2)}`
            )
        },
        { prop: 'orderCount', label: '订单数', width: 90, align: 'right' },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: DailyItem) =>
            h(
              ElTag,
              { type: DAILY_STATUS[row.status].type, effect: 'plain' },
              () => DAILY_STATUS[row.status].text
            )
        },
        {
          prop: 'operator',
          label: '操作人',
          width: 110,
          formatter: (row: DailyItem) => row.operator || '-'
        },
        {
          prop: 'createTime',
          label: '生成时间',
          minWidth: 170,
          sortable: true,
          formatter: (row: DailyItem) => row.createTime || '-'
        }
      ]
    }
  })

  const handleSearch = (params: Api.Finance.DailySearchParams) => {
    replaceSearchParams(params)
    getData()
  }

  const handleGenerate = async () => {
    generating.value = true
    try {
      await fetchGenerateDaily()
      ElMessage.success('今日日结已生成')
      refreshCreate()
    } catch (error) {
      console.error(error)
    } finally {
      generating.value = false
    }
  }
</script>
