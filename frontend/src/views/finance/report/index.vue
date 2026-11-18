<!-- 经营报表 -->
<template>
  <div v-loading="loading" class="finance-report-page pb-4">
    <div class="mb-4 flex-c justify-between">
      <span class="font-medium">经营报表</span>
      <ElSegmented v-model="days" :options="dayOptions" />
    </div>

    <ElRow :gutter="16">
      <ElCol v-for="card in statCards" :key="card.title" :xs="12" :sm="12" :md="6">
        <ArtStatsCard class="mb-4" v-bind="card" />
      </ElCol>
    </ElRow>

    <ElRow :gutter="16">
      <ElCol :sm="24" :lg="12">
        <ElCard class="mb-4 h-full" shadow="never">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">收入趋势</span>
              <span class="text-xs text-g-500">金额（元）</span>
            </div>
          </template>
          <ArtLineChart
            :data="trendIncome"
            :x-axis-data="trendDates"
            height="300px"
            show-area-color
          />
        </ElCard>
      </ElCol>

      <ElCol :sm="24" :lg="12">
        <ElCard class="mb-4 h-full" shadow="never">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">支出趋势</span>
              <span class="text-xs text-g-500">金额（元）</span>
            </div>
          </template>
          <ArtBarChart
            :data="trendExpense"
            :x-axis-data="trendDates"
            height="300px"
            bar-width="40%"
          />
        </ElCard>
      </ElCol>
    </ElRow>

    <ElRow :gutter="16">
      <ElCol :sm="24" :lg="12">
        <ElCard class="mb-4 h-full" shadow="never">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">收入构成</span>
              <span class="text-xs text-g-500">共 {{ report.incomeCategory.length }} 项</span>
            </div>
          </template>
          <ElTable v-if="report.incomeCategory.length" :data="report.incomeCategory" size="small">
            <ElTableColumn prop="name" label="分类" min-width="100" show-overflow-tooltip />
            <ElTableColumn label="金额" width="120" align="right">
              <template #default="{ row }">¥ {{ formatMoney(row.amount) }}</template>
            </ElTableColumn>
            <ElTableColumn label="占比" width="180">
              <template #default="{ row }">
                <div class="flex-c gap-2">
                  <ElProgress :percentage="row.ratio" :stroke-width="6" class="flex-1" />
                  <span class="w-10 shrink-0 text-right text-xs">{{ row.ratio }}%</span>
                </div>
              </template>
            </ElTableColumn>
          </ElTable>
          <ElEmpty v-else description="暂无收入数据" :image-size="80" />
        </ElCard>
      </ElCol>

      <ElCol :sm="24" :lg="12">
        <ElCard class="mb-4 h-full" shadow="never">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">支出构成</span>
              <span class="text-xs text-g-500">共 {{ report.expenseCategory.length }} 项</span>
            </div>
          </template>
          <ElTable v-if="report.expenseCategory.length" :data="report.expenseCategory" size="small">
            <ElTableColumn prop="name" label="分类" min-width="100" show-overflow-tooltip />
            <ElTableColumn label="金额" width="120" align="right">
              <template #default="{ row }">¥ {{ formatMoney(row.amount) }}</template>
            </ElTableColumn>
            <ElTableColumn label="占比" width="180">
              <template #default="{ row }">
                <div class="flex-c gap-2">
                  <ElProgress :percentage="row.ratio" :stroke-width="6" class="flex-1" />
                  <span class="w-10 shrink-0 text-right text-xs">{{ row.ratio }}%</span>
                </div>
              </template>
            </ElTableColumn>
          </ElTable>
          <ElEmpty v-else description="暂无支出数据" :image-size="80" />
        </ElCard>
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
  import { fetchGetFinanceReport } from '@/api/finance'

  defineOptions({ name: 'FinanceReport' })

  const dayOptions = [
    { label: '近 7 天', value: 7 },
    { label: '近 30 天', value: 30 },
    { label: '近 90 天', value: 90 }
  ]

  const loading = ref(true)
  const days = ref(30)

  const report = ref<Api.Finance.ReportData>({
    summary: {
      income: 0,
      expense: 0,
      net: 0,
      orderCount: 0,
      refundAmount: 0,
      avgOrderAmount: 0
    },
    trend: [],
    incomeCategory: [],
    expenseCategory: []
  })

  const statCards = computed(() => {
    const { summary } = report.value
    const netRate = summary.income ? ((summary.net / summary.income) * 100).toFixed(1) : '0.0'
    return [
      {
        title: '总收入',
        count: summary.income,
        decimals: 2,
        icon: 'ri:money-cny-circle-line',
        iconStyle: 'bg-primary',
        description: '统计周期内全部收入合计'
      },
      {
        title: '总支出',
        count: summary.expense,
        decimals: 2,
        icon: 'ri:shopping-cart-2-line',
        iconStyle: 'bg-warning',
        description: `含退款 ¥ ${formatMoney(summary.refundAmount)}`
      },
      {
        title: '净利',
        count: summary.net,
        decimals: 2,
        icon: 'ri:line-chart-line',
        iconStyle: 'bg-success',
        description: `净利率 ${netRate}%`
      },
      {
        title: '订单数',
        count: summary.orderCount,
        icon: 'ri:file-list-3-line',
        iconStyle: 'bg-danger',
        description: `客单价 ¥ ${formatMoney(summary.avgOrderAmount)}`
      }
    ]
  })

  const trendDates = computed(() => report.value.trend.map((item) => item.date))
  const trendIncome = computed(() => report.value.trend.map((item) => item.income))
  const trendExpense = computed(() => report.value.trend.map((item) => item.expense))

  const formatMoney = (value: number) =>
    (Number(value) || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

  const loadData = async () => {
    loading.value = true
    try {
      report.value = await fetchGetFinanceReport(days.value)
    } catch (error) {
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  watch(days, loadData)

  onMounted(loadData)
</script>
