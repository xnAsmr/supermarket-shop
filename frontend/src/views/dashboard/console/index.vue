<!-- 经营驾驶舱 -->
<template>
  <div v-loading="loading" class="dashboard-console pb-4">
    <ElRow :gutter="16" data-tour="dashboard-stats">
      <ElCol v-for="card in statCards" :key="card.title" :xs="12" :sm="12" :md="6">
        <ArtStatsCard class="mb-4" v-bind="card" />
      </ElCol>
    </ElRow>

    <!-- 排班紧跟核心指标卡，登录后首屏即可看到本周人力安排与自己的班次 -->
    <ElRow :gutter="16">
      <ElCol :span="24">
        <ScheduleOverview />
      </ElCol>
    </ElRow>

    <ElRow :gutter="16">
      <ElCol :sm="24" :lg="16">
        <ElCard class="mb-4 h-full" shadow="never" data-tour="dashboard-trend">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">销售总览</span>
              <!-- 日/周/月/年时间范围切换（对齐 Art Design Pro X 销售总览） -->
              <div class="range-tabs">
                <button
                  v-for="opt in rangeOptions"
                  :key="opt.value"
                  type="button"
                  class="range-tab"
                  :class="{ active: trendRange === opt.value }"
                  @click="switchTrendRange(opt.value)"
                >
                  {{ opt.label }}
                </button>
              </div>
            </div>
          </template>
          <ArtMixedChart
            :x-axis-data="trendLabels"
            :order-data="trendOrders"
            :sales-data="trendSales"
            :profit-data="trendProfit"
            height="300px"
            :loading="trendLoading"
          />
        </ElCard>
      </ElCol>

      <ElCol :sm="24" :lg="8">
        <ElCard class="mb-4 h-full" shadow="never" data-tour="dashboard-member-rank">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">会员客户</span>
              <span class="text-xs text-g-500">累计消费 TOP</span>
            </div>
          </template>
          <div v-if="memberRank.length" class="member-list">
            <div v-for="(m, index) in memberRank" :key="m.id" class="member-item">
              <span class="rank-index" :class="`rank-index-${index + 1}`">{{ index + 1 }}</span>
              <div class="member-avatar" :style="{ background: avatarColor(index) }">
                {{ initial(m.name) }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex-c justify-between mb-1">
                  <span class="truncate">{{ m.name }}</span>
                  <span class="ml-2 shrink-0 font-medium">¥ {{ formatMoney(m.totalConsume) }}</span>
                </div>
                <div class="flex-c justify-between">
                  <span class="text-xs text-g-500 truncate">{{ m.phone }}</span>
                  <span v-if="m.levelName" class="member-level">{{ m.levelName }}</span>
                </div>
                <ElProgress
                  class="mt-2"
                  :percentage="memberPercent(m.totalConsume)"
                  :stroke-width="6"
                  :show-text="false"
                />
              </div>
            </div>
          </div>
          <ElEmpty v-else description="暂无会员消费数据" :image-size="80" />
        </ElCard>
      </ElCol>
    </ElRow>

    <ElRow :gutter="16">
      <ElCol :sm="24" :md="12" :lg="8">
        <ArtHotProducts
          :list="overview.hotProducts"
          title="近 7 天热销商品"
          subtitle="本周销售排行"
        />
      </ElCol>

      <ElCol :sm="24" :md="12" :lg="8">
        <ElCard class="mb-4 h-full" shadow="never" data-tour="dashboard-low-stock">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">库存预警</span>
              <ElTag v-if="overview.stats.lowStockCount" type="danger" effect="plain">
                {{ overview.stats.lowStockCount }} 个 SKU
              </ElTag>
            </div>
          </template>
          <div v-if="overview.lowStock.length" class="stock-list">
            <div v-for="item in overview.lowStock" :key="item.id" class="stock-item">
              <div class="flex-1 min-w-0">
                <p class="truncate font-medium">{{ item.productName }}</p>
                <p class="mt-1 text-xs text-g-500">{{ item.warehouseName }}</p>
              </div>
              <div class="ml-3 text-right">
                <p class="font-medium text-red-500">{{ item.shelfQuantity }}</p>
                <p class="mt-1 text-xs text-g-500">预警线 {{ item.warnThreshold }}</p>
              </div>
            </div>
          </div>
          <ElEmpty v-else description="库存充足" :image-size="80" />
        </ElCard>
      </ElCol>

      <ElCol :sm="24" :md="24" :lg="8">
        <ElCard class="mb-4 h-full" shadow="never" data-tour="dashboard-recent-orders">
          <template #header>
            <span class="font-medium">最近订单</span>
          </template>
          <ElTable v-if="overview.recentOrders.length" :data="overview.recentOrders" size="small">
            <ElTableColumn prop="orderNo" label="订单号" width="150" show-overflow-tooltip />
            <ElTableColumn prop="cashier" label="收银员" width="90" />
            <ElTableColumn label="金额" width="100" align="right">
              <template #default="{ row }">¥ {{ formatMoney(row.payAmount) }}</template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="90">
              <template #default="{ row }">
                <ElTag
                  :type="(statusMap[row.status]?.type || 'info') as any"
                  effect="plain"
                  size="small"
                >
                  {{ statusMap[row.status]?.text }}
                </ElTag>
              </template>
            </ElTableColumn>
          </ElTable>
          <ElEmpty v-else description="暂无订单" :image-size="80" />
        </ElCard>
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
  import { fetchDashboardOverview, fetchSalesTrend, fetchMemberConsumeRank, type SalesTrendRange } from '@/api/dashboard'
  import { ORDER_STATUS_MAP } from '@/mock/service/order.service'
  import ArtMixedChart from '@/components/core/charts/art-mixed-chart/index.vue'
  import ScheduleOverview from '../modules/ScheduleOverview.vue'

  defineOptions({ name: 'Console' })

  const loading = ref(true)
  const statusMap = ORDER_STATUS_MAP as unknown as Record<string, { type: string; text: string }>
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
    const { stats } = overview.value
    const growthText =
      stats.monthGrowth >= 0
        ? `较上月同期 +${stats.monthGrowth}%`
        : `较上月同期 ${stats.monthGrowth}%`
    return [
      {
        title: '今日销售额',
        count: stats.todaySales,
        decimals: 2,
        icon: 'ri:money-cny-circle-line',
        iconStyle: 'bg-primary',
        description: `本月累计 ¥ ${formatMoney(stats.monthSales)}（${growthText}）`
      },
      {
        title: '今日订单数',
        count: stats.todayOrders,
        icon: 'ri:file-list-3-line',
        iconStyle: 'bg-warning',
        description: `本月产生退货单 ${stats.returnCount} 笔`
      },
      {
        title: '今日毛利',
        count: stats.todayProfit,
        decimals: 2,
        icon: 'ri:line-chart-line',
        iconStyle: 'bg-success',
        description: `今日客单价 ¥ ${formatMoney(stats.todayAov)}`
      },
      {
        title: '库存预警',
        count: stats.lowStockCount,
        icon: 'ri:alert-line',
        iconStyle: 'bg-danger',
        description: '低于安全库存的商品数，请及时补货'
      }
    ]
  })

  /* ------------------------ 销售总览（日/周/月/年） ------------------------ */
  type RangeKey = SalesTrendRange
  const rangeOptions: { label: string; value: RangeKey }[] = [
    { label: '日', value: 'day' },
    { label: '周', value: 'week' },
    { label: '月', value: 'month' },
    { label: '年', value: 'year' }
  ]
  const trendRange = ref<RangeKey>('day')
  const trendLoading = ref(false)
  const salesTrend = ref<Api.Dashboard.SalesTrendPoint[]>([])

  const loadSalesTrend = async () => {
    trendLoading.value = true
    try {
      salesTrend.value = await fetchSalesTrend(trendRange.value)
    } catch (error) {
      console.error(error)
    } finally {
      trendLoading.value = false
    }
  }

  const switchTrendRange = (value: RangeKey) => {
    if (trendRange.value === value) return
    trendRange.value = value
    loadSalesTrend()
  }

  const trendLabels = computed(() => salesTrend.value.map((item) => item.label))
  const trendOrders = computed(() => salesTrend.value.map((item) => item.orders))
  const trendSales = computed(() => salesTrend.value.map((item) => item.sales))
  const trendProfit = computed(() => salesTrend.value.map((item) => item.profit))

  /* ------------------------ 会员客户（累计消费排行 TOP） ------------------------ */
  const memberRank = ref<Api.Dashboard.MemberRankItem[]>([])

  const loadMemberRank = async () => {
    try {
      memberRank.value = await fetchMemberConsumeRank(8)
    } catch (error) {
      console.error(error)
    }
  }

  // 取姓名首字符作为头像（中文取首字，英文取首字母）
  const initial = (name: string): string => (name ? name.trim().charAt(0).toUpperCase() : '?')
  // 头像配色（柔和 Art Design Pro 色板）
  const AVATAR_COLORS = ['#3D7FFF', '#2ED3B7', '#FFB200', '#FF7D5C', '#7C5CFF', '#36CFC9', '#F0709A', '#5B8FF9']
  const avatarColor = (index: number) => AVATAR_COLORS[index % AVATAR_COLORS.length]
  // 进度条以最高累计消费为基准
  const memberMax = computed(() => Math.max(...memberRank.value.map((m) => m.totalConsume), 1))
  const memberPercent = (amount: number) => Math.max(6, Math.round((amount / memberMax.value) * 100))

  const formatMoney = (value: number) =>
    (Number(value) || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

  const loadData = async () => {
    loading.value = true
    try {
      await Promise.all([
        fetchDashboardOverview().then((data) => (overview.value = data)),
        loadSalesTrend(),
        loadMemberRank()
      ])
    } catch (error) {
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)
</script>

<style lang="scss" scoped>
  /* 日/周/月/年时间范围切换（对齐 Art Design Pro X 销售总览样式） */
  .range-tabs {
    display: inline-flex;
    align-items: center;
    padding: 3px;
    background: var(--art-gray-100, #f5f7fa);
    border: 1px solid var(--art-gray-200);
    border-radius: 10px;

    .range-tab {
      padding: 5px 18px;
      border: none;
      border-radius: 8px;
      background: transparent;
      font-size: 14px;
      line-height: 1;
      color: var(--art-gray-600);
      cursor: pointer;
      transition:
        background-color 0.2s,
        color 0.2s;

      &:hover {
        color: var(--el-color-primary);
      }

      &.active {
        background: var(--el-color-primary);
        color: #fff;
        font-weight: 500;
      }
    }
  }

  .rank-item {
    display: flex;
    align-items: center;
    padding: 8px 0;

    & + .rank-item {
      border-top: 1px solid var(--art-gray-200);
    }

    .rank-index {
      width: 22px;
      height: 22px;
      margin-right: 10px;
      flex-shrink: 0;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      background: var(--art-gray-200);
      color: var(--art-gray-600);

      &-1,
      &-2,
      &-3 {
        color: #fff;
        background: var(--el-color-primary);
      }
    }
  }

  .member-item {
    display: flex;
    align-items: center;
    padding: 8px 0;

    & + .member-item {
      border-top: 1px solid var(--art-gray-200);
    }

    .rank-index {
      width: 22px;
      height: 22px;
      margin-right: 10px;
      flex-shrink: 0;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      background: var(--art-gray-200);
      color: var(--art-gray-600);

      &-1,
      &-2,
      &-3 {
        color: #fff;
        background: var(--el-color-primary);
      }
    }

    .member-avatar {
      width: 36px;
      height: 36px;
      margin-right: 12px;
      flex-shrink: 0;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 600;
      color: #fff;
      user-select: none;
    }

    .member-level {
      flex-shrink: 0;
      margin-left: 8px;
      padding: 1px 8px;
      border-radius: 4px;
      font-size: 11px;
      line-height: 18px;
      color: var(--el-color-primary);
      background: var(--el-color-primary-light-9, #ecf5ff);
    }
  }

  .stock-item {
    display: flex;
    align-items: center;
    padding: 8px 0;

    & + .stock-item {
      border-top: 1px solid var(--art-gray-200);
    }
  }
</style>
