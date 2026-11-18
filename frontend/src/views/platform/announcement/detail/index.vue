<!-- 平台公告详情（整页）
     版式对齐 Art Design Pro X 通知详情页（ArtNotifyDetail）：
     标题 + 生效时间（左）｜返回 / 公告管理（右）→ 分隔线 → 标签行 + 发布人 → 正文。
     管理侧只做纯展示：发布/撤回/已读统计/反馈处理仍留在列表页，详情页只保证可直链、可刷新。 -->
<template>
  <div v-loading="loading" class="announcement-detail-page">
    <ArtNotifyDetail
      v-if="row"
      :title="row.title"
      :time="`生效时间：${row.effectiveAt || '立即'}`"
      :tags="tags"
      :source="row.publisherName"
      :content="row.content"
    >
      <template #actions>
        <ElButton v-ripple @click="goBack">返回</ElButton>
        <ElButton type="primary" v-ripple @click="goList">公告管理</ElButton>
      </template>

      <div class="nd-extra-line">
        <span>定向范围：{{ scopeText(row.targetScope) }}</span>
        <span>失效时间：{{ row.expireAt || '长期有效' }}</span>
        <span>创建时间：{{ row.createTime || '—' }}</span>
      </div>
    </ArtNotifyDetail>

    <ElEmpty v-else-if="!loading" :description="loadError || '公告不存在'">
      <ElButton type="primary" v-ripple @click="goList">返回公告管理</ElButton>
    </ElEmpty>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { fetchAnnouncementAdminDetail } from '@/api/notify'
  import ArtNotifyDetail from '@/components/core/notify/art-notify-detail/index.vue'

  defineOptions({ name: 'PlatformAnnouncementDetail' })

  type Row = Api.Notify.AnnouncementAdmin
  type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

  const route = useRoute()
  const router = useRouter()

  const id = computed(() => String(route.query.id ?? ''))
  const loading = ref(false)
  const loadError = ref('')
  const row = ref<Row | null>(null)

  /** 公告类型文案（功能更新/系统维护/规则变更） */
  const typeText = (t?: number) => (t === 2 ? '系统维护' : t === 3 ? '规则变更' : '功能更新')
  /** 定向范围文案（全部租户/按套餐/指定租户） */
  const scopeText = (s?: string) =>
    s === 'PLAN' ? '按套餐' : s === 'ASSIGN' ? '指定租户' : '全部租户'
  /** 状态徽章：0草稿 1已发布 2已撤回 */
  const statusMeta = (s?: number): { text: string; type: TagType } =>
    s === 1
      ? { text: '已发布', type: 'success' }
      : s === 2
        ? { text: '已撤回', type: 'info' }
        : { text: '草稿', type: 'warning' }

  /** 标签行：类型 + 状态 + 定向 + 定向人群 + 确认要求 + 触达统计 */
  const tags = computed<{ text: string; type?: TagType }[]>(() => {
    const data = row.value
    if (!data) return []
    const status = statusMeta(data.status)
    const list: { text: string; type?: TagType }[] = [
      { text: typeText(data.noticeType), type: 'primary' },
      { text: status.text, type: status.type },
      { text: scopeText(data.targetScope), type: 'info' }
    ]
    if (data.targetUserType === 2) list.push({ text: '仅管理员', type: 'warning' })
    if (data.requireAck) list.push({ text: '需确认', type: 'danger' })
    // 触达统计：草稿尚未发布，统计无意义
    if (data.status === 1) {
      list.push({ text: `已读 ${data.readCount ?? 0}`, type: 'info' })
      if (data.requireAck) list.push({ text: `已确认 ${data.ackCount ?? 0}`, type: 'success' })
      const pending = data.pendingFeedbackCount ?? 0
      if (pending > 0) list.push({ text: `${pending} 条反馈待处理`, type: 'warning' })
    }
    return list
  })

  const load = async () => {
    if (!id.value) {
      row.value = null
      loadError.value = '缺少公告 ID，无法查看详情'
      return
    }
    loading.value = true
    loadError.value = ''
    try {
      row.value = await fetchAnnouncementAdminDetail(id.value)
    } catch (e: any) {
      row.value = null
      loadError.value = e?.message || '公告不存在'
    } finally {
      loading.value = false
    }
  }

  /** 返回：优先回上一页（保留列表筛选与分页），无历史记录时回列表页 */
  const goBack = () => {
    if (window.history.length > 1) router.back()
    else goList()
  }

  const goList = () => router.push('/platform/announcement')

  // 同一路由切换不同 id 时组件不重建，需按 query 重新取数
  watch(id, load, { immediate: true })
</script>

<style scoped>
  @reference '@styles/core/tailwind.css';

  /* 高度随内容自适应，长正文由布局 #app-main 滚动 */
  .announcement-detail-page {
    min-height: 200px;
    padding-bottom: 16px;
  }

  .nd-extra-line {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    padding-top: 16px;
    border-top: 1px solid var(--art-card-border);
    font-size: 12px;
    line-height: 1.7;
    color: var(--art-gray-500);
  }
</style>
