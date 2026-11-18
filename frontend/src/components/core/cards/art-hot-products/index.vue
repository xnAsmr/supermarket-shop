<!-- 热销商品卡片（经营驾驶舱 / 经营分析共用）
     样式对标用户提供的参考图：卡片头 = 标题 + 右侧「查看全部 →」；
     列表行 = 商品缩略图（44px 圆角）+ 商品名 + 售价·库存状态（充足=绿/紧张=橙/缺货=红），
     右侧 = 销量大数字（千分位加粗）+「销量」小字；行间细分隔线，无表格线、无进度条。
     库存状态由 shelfQuantity + warehouseQuantity 推导（0=暂时缺货，<=10=库存紧张，其余充足）。 -->
<template>
  <ElCard class="hot-products-card mb-4 h-full" shadow="never">
    <template #header>
      <div class="flex-c justify-between">
        <div>
          <span class="text-[15px] font-semibold">{{ title }}</span>
          <p v-if="subtitle" class="mt-1 text-xs text-g-500">{{ subtitle }}</p>
        </div>
        <span v-if="showViewAll" class="view-all" @click="goProductList">查看全部 →</span>
      </div>
    </template>

    <div v-if="list.length" class="hot-list">
      <div
        v-for="(item, index) in list"
        :key="item.productId || index"
        class="hot-item"
        @click="goProductList"
      >
        <div class="hot-thumb">
          <img v-if="item.image" :src="item.image" :alt="item.name" @error="onThumbError" />
          <span v-else class="hot-thumb-text">{{ item.name?.slice(0, 1) || '商品' }}</span>
        </div>
        <div class="hot-info">
          <p class="hot-name">{{ item.name }}</p>
          <p class="hot-sub">
            <span class="hot-price">¥ {{ formatPrice(item.price) }}</span>
            <span class="hot-dot">·</span>
            <span :style="{ color: stockInfo(item).color }">{{ stockInfo(item).text }}</span>
          </p>
        </div>
        <div class="hot-sales">
          <span class="hot-quantity">{{ formatQuantity(item.quantity) }}</span>
          <span class="hot-unit">销量</span>
        </div>
      </div>
    </div>
    <ElEmpty v-else description="暂无销售数据" :image-size="80" />
  </ElCard>
</template>

<script setup lang="ts">
  import { useRouter } from 'vue-router'
  import type { PropType } from 'vue'

  defineOptions({ name: 'ArtHotProducts' })

  const props = defineProps({
    /** 热销商品列表（按销量降序，由后端保证） */
    list: { type: Array as PropType<Api.Dashboard.HotItem[]>, default: () => [] },
    title: { type: String, default: '热销商品' },
    subtitle: { type: String, default: '' },
    /** 是否显示右上角「查看全部」入口 */
    showViewAll: { type: Boolean, default: true },
    /** 「查看全部」跳转路径（商品列表页） */
    viewAllPath: { type: String, default: '/product/list' }
  })

  const router = useRouter()

  /** 库存预警口径：与驾驶舱「库存预警」一致，总库存 <= 10 视为紧张 */
  const STOCK_WARN_LIMIT = 10

  /** 库存状态：0=暂时缺货(红) / <=10=库存紧张(橙) / 其余=库存充足(绿)；
      后端未返回库存字段（旧接口）时按未知处理，避免误判缺货 */
  const stockInfo = (item: Api.Dashboard.HotItem) => {
    const shelf = item.shelfQuantity
    const warehouse = item.warehouseQuantity
    if (shelf == null && warehouse == null) {
      return { text: '库存未知', color: 'var(--art-gray-500)' }
    }
    const total = (Number(shelf) || 0) + (Number(warehouse) || 0)
    if (total <= 0) return { text: '暂时缺货', color: 'var(--art-danger)' }
    if (total <= STOCK_WARN_LIMIT) return { text: '库存紧张', color: 'var(--art-warning)' }
    return { text: '库存充足', color: 'var(--art-success)' }
  }

  /** 售价：整数不带小数，非整数保留两位 */
  const formatPrice = (value?: number) => {
    const n = Number(value ?? 0) || 0
    return Number.isInteger(n) ? n.toLocaleString('zh-CN') : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  /** 销量：千分位整数 */
  const formatQuantity = (value: number) => (Number(value) || 0).toLocaleString('zh-CN')

  const goProductList = () => {
    router.push(props.viewAllPath)
  }

  /** 缩略图加载失败时隐藏 img，回退首字占位 */
  const onThumbError = (e: Event) => {
    ;(e.target as HTMLImageElement).style.display = 'none'
  }
</script>

<style scoped lang="scss">
  .hot-products-card {
    .view-all {
      font-size: 13px;
      color: var(--theme-color);
      cursor: pointer;
      white-space: nowrap;

      &:hover {
        opacity: 0.8;
      }
    }

    .hot-list {
      .hot-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 8px;
        margin: 0 -8px;
        border-bottom: 1px solid var(--art-card-border);
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.2s;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background: var(--art-hover-color);
        }
      }

      .hot-thumb {
        width: 44px;
        height: 44px;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        border-radius: 8px;
        background: var(--art-gray-100);

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .hot-thumb-text {
        font-size: 16px;
        font-weight: 600;
        color: var(--art-gray-500);
      }

      .hot-info {
        flex: 1;
        min-width: 0;
      }

      .hot-name {
        font-size: 14px;
        font-weight: 500;
        line-height: 1.4;
        color: var(--art-text-color);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .hot-sub {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 3px;
        font-size: 12px;
        line-height: 1.3;
      }

      .hot-price {
        color: var(--art-gray-500);
      }

      .hot-dot {
        color: var(--art-gray-400);
      }

      .hot-sales {
        flex-shrink: 0;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 2px;
      }

      .hot-quantity {
        font-size: 17px;
        font-weight: 700;
        line-height: 1.1;
        color: var(--art-text-color);
      }

      .hot-unit {
        font-size: 12px;
        color: var(--art-gray-500);
      }
    }
  }
</style>
