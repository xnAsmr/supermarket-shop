<!-- 平台管理工作台（系统管理员） -->
<template>
  <div v-loading="loading" class="platform-workbench pb-4">
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
              <span class="font-medium">近 6 个月租户开通趋势</span>
              <span class="text-xs text-g-500">累计开通租户数</span>
            </div>
          </template>
          <ArtLineChart
            :data="monthlyTrendData"
            :x-axis-data="monthlyTrendDates"
            height="300px"
            show-area-color
          />
        </ElCard>
      </ElCol>

      <ElCol :sm="24" :lg="10">
        <ElCard class="mb-4 h-full" shadow="never">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">套餐分布</span>
              <span class="text-xs text-g-500">按开通套餐</span>
            </div>
          </template>
          <ArtRingChart
            :data="planPieData"
            height="300px"
            show-legend
            legend-position="right"
            :center-text="`${stats.totalTenants}`"
          />
        </ElCard>
      </ElCol>
    </ElRow>

    <ElRow :gutter="16">
      <ElCol :sm="24" :md="10">
        <ElCard class="mb-4 h-full" shadow="never">
          <template #header>
            <span class="font-medium">租户状态分布</span>
          </template>
          <div v-if="stats.statusDistribution.length" class="status-list">
            <div v-for="item in stats.statusDistribution" :key="item.name" class="mb-4">
              <div class="mb-1 flex-c justify-between text-sm">
                <span>{{ item.name }}</span>
                <span class="text-g-500">{{ item.count }} 家</span>
              </div>
              <ElProgress :percentage="statusPercent(item.count)" :stroke-width="8" />
            </div>
          </div>
          <ElEmpty v-else description="暂无数据" :image-size="80" />
        </ElCard>
      </ElCol>

      <ElCol :sm="24" :md="14">
        <ElCard class="mb-4 h-full" shadow="never">
          <template #header>
            <div class="flex-c justify-between">
              <span class="font-medium">30 天内到期租户</span>
              <span class="text-xs text-g-500">请及时处理续费</span>
            </div>
          </template>
          <ElTable v-if="stats.expiringTenants.length" :data="stats.expiringTenants" size="small">
            <ElTableColumn type="index" width="50" label="#" />
            <ElTableColumn prop="tenantName" label="租户名称" show-overflow-tooltip />
            <ElTableColumn prop="planType" label="套餐" width="120" align="right" />
            <ElTableColumn label="到期时间" width="160" align="right">
              <template #default="{ row }">{{ formatDate(row.expireTime) }}</template>
            </ElTableColumn>
          </ElTable>
          <ElEmpty v-else description="暂无即将到期租户" :image-size="80" />
        </ElCard>
      </ElCol>
    </ElRow>
  </div>
</template>

<script setup lang="ts">
  import { fetchPlatformStats } from '@/api/tenant'

  defineOptions({ name: 'PlatformWorkbench' })

  const loading = ref(true)
  const stats = ref<Api.Platform.Stats>({
    totalTenants: 0,
    activeTenants: 0,
    totalStores: 0,
    totalUsers: 0,
    planTypeDistribution: [],
    statusDistribution: [],
    monthlyTrend: [],
    expiringTenants: []
  })

  const statCards = computed(() => [
    {
      title: '租户总数',
      count: stats.value.totalTenants,
      icon: 'ri:building-2-line',
      iconStyle: 'bg-primary',
      description: '开通租户单位总数'
    },
    {
      title: '活跃租户',
      count: stats.value.activeTenants,
      icon: 'ri:macbook-line',
      iconStyle: 'bg-success',
      description: '当前状态正常的租户'
    },
    {
      title: '门店总数',
      count: stats.value.totalStores,
      icon: 'ri:store-3-line',
      iconStyle: 'bg-warning',
      description: '全部租户下的门店合计'
    },
    {
      title: '系统用户',
      count: stats.value.totalUsers,
      icon: 'ri:team-line',
      iconStyle: 'bg-danger',
      description: '所有租户的用户合计'
    }
  ])

  const monthlyTrendDates = computed(() => stats.value.monthlyTrend.map((item) => item.month))
  const monthlyTrendData = computed(() => stats.value.monthlyTrend.map((item) => item.count))

  const planPieData = computed(() =>
    stats.value.planTypeDistribution.map((item) => ({ name: item.name, value: item.count }))
  )

  const statusMax = computed(() =>
    Math.max(...stats.value.statusDistribution.map((item) => item.count), 1)
  )
  const statusPercent = (count: number) => Math.max(4, Math.round((count / statusMax.value) * 100))

  const formatDate = (value: string) => {
    if (!value) return '-'
    const date = new Date(value.replace(/-/g, '/'))
    if (Number.isNaN(date.getTime())) return value
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate()
    ).padStart(2, '0')}`
  }

  const loadData = async () => {
    loading.value = true
    try {
      stats.value = await fetchPlatformStats()
    } catch (error) {
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  onMounted(loadData)
</script>
