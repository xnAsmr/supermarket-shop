<!-- 租户通知详情（整页）
     版式对齐 Art Design Pro X 通知详情页（ArtNotifyDetail）：
     标题 + 发送时间（左）｜返回 / 通知管理（右）→ 分隔线 → 标签行 + 发送人 → 正文。
     管理侧只做纯展示：撤回/重新发布/已读统计/查看留言仍在列表页，详情页只保证可直链、可刷新。 -->
<template>
  <div v-loading="loading" class="notice-detail-page">
    <ArtNotifyDetail
      v-if="row"
      :title="row.title"
      :time="`发送时间：${row.sendTime || '—'}`"
      :tags="tags"
      :source="row.senderName"
      source-label="发送人"
      :content="row.content"
    >
      <template #actions>
        <ElButton v-ripple @click="goBack">返回</ElButton>
        <ElButton type="primary" v-ripple @click="goList">通知管理</ElButton>
      </template>

      <div class="nd-extra-line">
        <span>接收范围：{{ scopeSummary(row) }}</span>
        <span>已读率：{{ readRate(row) }}</span>
        <span>留言：{{ row.commentCount ?? 0 }} 条</span>
        <span>创建时间：{{ row.createTime || '—' }}</span>
      </div>
    </ArtNotifyDetail>

    <ElEmpty v-else-if="!loading" :description="loadError || '通知不存在或无权查看'">
      <ElButton type="primary" v-ripple @click="goList">返回通知管理</ElButton>
    </ElEmpty>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { fetchNoticeAdminDetail } from '@/api/notify'
  import ArtNotifyDetail from '@/components/core/notify/art-notify-detail/index.vue'

  defineOptions({ name: 'TenantNoticeDetail' })

  type Row = Api.Notify.NoticeAdmin
  type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

  const route = useRoute()
  const router = useRouter()

  const id = computed(() => String(route.query.id ?? ''))
  const loading = ref(false)
  const loadError = ref('')
  const row = ref<Row | null>(null)

  /** 通知类型徽章文案与配色（门店通知/制度规范/活动安排） */
  const typeMeta = (t?: number): { text: string; type: TagType } => {
    if (t === 2) return { text: '制度规范', type: 'info' }
    if (t === 3) return { text: '活动安排', type: 'warning' }
    return { text: '门店通知', type: 'primary' }
  }

  /** 接收范围摘要（带命中数量，便于判断定向是否符合预期） */
  const scopeSummary = (data: Row) => {
    if (data.targetScope === 'STORE')
      return `指定门店（${(data.targetStoreIds || '').split(',').filter(Boolean).length}）`
    if (data.targetScope === 'ROLE')
      return `指定角色（${(data.targetRoleIds || '').split(',').filter(Boolean).length}）`
    if (data.targetScope === 'USER')
      return `指定人员（${(data.targetUserIds || '').split(',').filter(Boolean).length}）`
    return '全员'
  }

  /** 已读率（应读为 0 时无意义，直接占位） */
  const readRate = (data: Row) =>
    data.audienceCount > 0 ? `${Math.round((data.readCount / data.audienceCount) * 100)}%` : '-'

  /** 标签行：类型 + 状态 + 接收范围 + 已读/留言统计 */
  const tags = computed<{ text: string; type?: TagType }[]>(() => {
    const data = row.value
    if (!data) return []
    const type = typeMeta(data.noticeType)
    const withdrawn = data.status === 1
    const list: { text: string; type?: TagType }[] = [
      { text: type.text, type: type.type },
      withdrawn ? { text: '已撤回', type: 'danger' } : { text: '已发送', type: 'success' },
      { text: scopeSummary(data), type: 'info' }
    ]
    list.push({ text: `已读 ${data.readCount ?? 0}/${data.audienceCount ?? 0}`, type: 'info' })
    const comments = data.commentCount ?? 0
    if (comments > 0) list.push({ text: `${comments} 条留言`, type: 'warning' })
    else if (!withdrawn && data.audienceCount > 0 && data.readCount >= data.audienceCount)
      list.push({ text: '全员已读', type: 'success' })
    return list
  })

  const load = async () => {
    if (!id.value) {
      row.value = null
      loadError.value = '缺少通知 ID，无法查看详情'
      return
    }
    loading.value = true
    loadError.value = ''
    try {
      row.value = await fetchNoticeAdminDetail(id.value)
    } catch (e: any) {
      row.value = null
      loadError.value = e?.message || '通知不存在或无权查看'
    } finally {
      loading.value = false
    }
  }

  /** 返回：优先回上一页（保留列表筛选与分页），无历史记录时回列表页 */
  const goBack = () => {
    if (window.history.length > 1) router.back()
    else goList()
  }

  const goList = () => router.push('/tenant/notice')

  // 同一路由切换不同 id 时组件不重建，需按 query 重新取数
  watch(id, load, { immediate: true })
</script>

<style scoped>
  @reference '@styles/core/tailwind.css';

  /* 高度随内容自适应，长正文由布局 #app-main 滚动 */
  .notice-detail-page {
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
