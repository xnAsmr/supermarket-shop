<!-- 价格走势：进价 / 售价 / 会员价 历史折线图（数据来自建档与调价快照） -->
<template>
  <ElDialog
    :model-value="visible"
    :title="`价格走势 · ${product?.name ?? ''}`"
    width="820px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:visible', $event)"
  >
    <div v-loading="loading" class="min-h-[300px]">
      <template v-if="history.length">
        <ArtLineChart :data="chartData" :x-axis-data="xAxisData" height="360px" show-legend />
        <p class="mt-2 text-xs text-g-500">
          记录建档与每次调价后的三价快照（最多 {{ MAX_POINTS }} 条），会员价为 0 表示未设置
        </p>
      </template>
      <ElEmpty
        v-else-if="!loading"
        :image-size="80"
        description="暂无价格记录（新增建档后即可查看走势）"
      />
    </div>
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchGetPriceHistory } from '@/api/product'
  import { ElDialog } from 'element-plus'
  import type { LineDataItem } from '@/types/component/chart'

  defineOptions({ name: 'PriceTrendDialog' })

  const MAX_POINTS = 500

  const props = defineProps<{
    visible: boolean
    product?: Partial<Api.Product.ProductItem> | null
  }>()
  const emit = defineEmits<{
    (e: 'update:visible', value: boolean): void
  }>()

  const loading = ref(false)
  const history = ref<Api.Product.PriceHistoryItem[]>([])

  /** X 轴：记录时间（yyyy-MM-dd HH:mm） */
  const xAxisData = computed(() => history.value.map((item) => item.createTime.slice(0, 16)))

  /** 三条折线：进价 / 售价 / 会员价 */
  const chartData = computed<LineDataItem[]>(() => [
    { name: '进价', data: history.value.map((item) => item.purchasePrice) },
    { name: '售价', data: history.value.map((item) => item.salePrice) },
    { name: '会员价', data: history.value.map((item) => item.memberPrice) }
  ])

  const load = async () => {
    const id = props.product?.id
    if (!id) return
    loading.value = true
    history.value = []
    try {
      history.value = await fetchGetPriceHistory(id)
    } catch (error) {
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible) load()
    }
  )
</script>
