<!-- 经营分析 -->
<template>
  <div v-loading="loading" class="dashboard-analysis pb-4">
    <ElRow :gutter="16">
      <ElCol v-for="card in statCards" :key="card.title" :xs="12" :sm="12" :md="6">
        <ArtStatsCard class="mb-4" v-bind="card" />
      </ElCol>
    </ElRow>

    <ElRow :gutter="16">
      <ElCol :sm="24" :lg="14">
        <ElCard class="mb-4 h-full" shadow="never">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">收入趋势</span>
              <ElRadioGroup v-model="days" size="small">
                <ElRadioButton :value="7">近 7 天</ElRadioButton>
                <ElRadioButton :value="30">近 30 天</ElRadioButton>
                <ElRadioButton :value="90">近 90 天</ElRadioButton>
              </ElRadioGroup>
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

      <ElCol :sm="24" :lg="10">
        <ElCard class="mb-4 h-full" shadow="never">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">支出趋势</span>
              <span class="text-xs text-g-500">近 {{ days }} 天</span>
            </div>
          </template>
          <ArtBarChart
            :data="trendExpense"
            :x-axis-data="trendDates"
            height="300px"
            bar-width="40%"
            :loading="loading"
          />
        </ElCard>
      </ElCol>
    </ElRow>

    <ElRow :gutter="16">
      <ElCol :sm="24" :md="12">
        <ArtHotProducts
          :list="overview.hotProducts"
          title="热销商品排行"
          subtitle="本月销售情况"
        />
      </ElCol>

      <ElCol :sm="24" :md="12">
        <ElCard class="mb-4 h-full" shadow="never">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">收入构成</span>
              <span class="text-xs text-g-500">近 {{ days }} 天</span>
            </div>
          </template>
          <div v-if="report.incomeCategory.length" class="category-list">
            <div v-for="item in report.incomeCategory" :key="item.name" class="mb-4">
              <div class="mb-1 flex-c justify-between text-sm">
                <span class="truncate">{{ item.name }}</span>
                <span class="ml-2 shrink-0 text-g-500">
                  ¥ {{ formatMoney(item.amount) }} · {{ item.ratio }}%
                </span>
              </div>
              <ElProgress :percentage="item.ratio" :stroke-width="8" />
            </div>
          </div>
          <ElEmpty v-else description="暂无收入数据" :image-size="80" />
        </ElCard>
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
  import { fetchGetFinanceReport } from '@/api/finance'
  import { fetchDashboardOverview } from '@/api/dashboard'

  defineOptions({ name: 'Analysis' })

  const loading = ref(true)
  const days = ref(30)

  const emptySummary: Api.Finance.ReportSummary = {
    income: 0,
    expense: 0,
    net: 0,
    orderCount: 0,
    refundAmount: 0,
    avgOrderAmount: 0
  }

  const report = ref<Api.Finance.ReportData>({
    summary: { ...emptySummary },
    trend: [],
    incomeCategory: [],
    expenseCategory: []
  })

  const overview = ref<Api.Dashboard.Overview>({
    stats: {
      todaySales: 0,
      todayOrders: 0,
      todayProfit: 0,
      todayAov: 0,
      monthSales: 0,
      monthGrowth: 0,
      lowStockCount: 0,
      returnCount: 0
    },
    trend: [],
    hotProducts: [],
    rankList: [],
    lowStock: [],
    recentOrders: []
  })

  const statCards = computed(() => {
    const s = report.value.summary
    return [
      {
        title: '总收入',
        count: s.income,
        decimals: 2,
        icon: 'ri:money-cny-circle-line',
        iconStyle: 'bg-primary',
        description: `客单价 ¥ ${formatMoney(s.avgOrderAmount)}`
      },
      {
        title: '总支出',
        count: s.expense,
        decimals: 2,
        icon: 'ri:wallet-3-line',
        iconStyle: 'bg-warning',
        description: `含销售退款 ¥ ${formatMoney(s.refundAmount)}`
      },
      {
        title: '净利',
        count: s.net,
        decimals: 2,
        icon: 'ri:line-chart-line',
        iconStyle: 'bg-success',
        description: `近 ${days.value} 天经营净收入`
      },
      {
        title: '订单数',
        count: s.orderCount,
        icon: 'ri:file-list-3-line',
        iconStyle: 'bg-danger',
        description: `客单价 ¥ ${formatMoney(s.avgOrderAmount)}`
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

  const loadReport = async () => {
    loading.value = true
    try {
      report.value = await fetchGetFinanceReport(days.value)
    } catch (error) {
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  const loadOverview = async () => {
    try {
      overview.value = await fetchDashboardOverview()
    } catch (error) {
      console.error(error)
    }
  }

  watch(days, loadReport)

  onMounted(() => {
    loadReport()
    loadOverview()
  })
</script>
