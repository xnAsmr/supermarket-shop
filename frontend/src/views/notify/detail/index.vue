<!-- 消息中心详情（整页）
     系统公告 / 我的通知 / 事件提醒三类共用：type 取自 query，id 取自 query，因此可直链、可刷新。
     进入即自动标记已读；系统公告支持「我已知晓」确认；PURCHASE_ORDER 类事件可跳业务页。
     留言区仅公告/通知展示（公告=私密反馈，通知=公告内公开留言），事件提醒没有留言。 -->
<template>
  <div v-loading="loading" class="notify-detail-page">
    <ArtNotifyDetail
      v-if="item"
      :title="item.title"
      :time="timeText"
      :tags="tags"
      :source="sourceText"
      :source-label="sourceLabel"
      :content="item.content"
    >
      <template #actions>
        <ElButton v-ripple @click="goBack">返回</ElButton>
        <ElButton type="primary" v-ripple @click="goList">消息中心</ElButton>
      </template>

      <div v-if="hasActions || !isEvent" class="nd-footer">
        <div v-if="hasActions" class="nd-footer-actions">
          <ElButton v-if="!item.read" v-ripple @click="markRead">标记已读</ElButton>
          <ElButton v-if="needAck" type="primary" v-ripple @click="handleAck">我已知晓</ElButton>
          <ElButton v-if="canGoBiz" v-ripple @click="goBiz">前往处理</ElButton>
        </div>

        <ArtMessageThread
          v-if="!isEvent && item"
          :key="`${type}-${item.id}`"
          :target-type="type === 'announcement' ? 'ANNOUNCEMENT' : 'NOTICE'"
          :target-id="String(item.id)"
          @read="notifyListsRefresh"
        />
      </div>
    </ArtNotifyDetail>

    <ElEmpty v-else-if="!loading" :description="loadError || '消息不存在或无权查看'">
      <ElButton type="primary" v-ripple @click="goList">返回消息中心</ElButton>
    </ElEmpty>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { ElMessage } from 'element-plus'
  import {
    ackAnnouncement,
    fetchAnnouncementDetail,
    fetchEventDetail,
    fetchNoticeDetail,
    readAnnouncement,
    readEvent,
    readNotice
  } from '@/api/notify'
  import { mittBus } from '@/utils/sys'
  import ArtNotifyDetail from '@/components/core/notify/art-notify-detail/index.vue'
  import ArtMessageThread from '@/components/core/notify/art-message-thread/index.vue'

  defineOptions({ name: 'NotifyDetail' })

  type DetailType = 'announcement' | 'notice' | 'event'
  type AnyItem = Api.Notify.AnnouncementItem | Api.Notify.NoticeItem | Api.Notify.EventItem

  const route = useRoute()
  const router = useRouter()

  /** 详情类型：缺省按系统公告处理，非法值也回落公告（不留白屏） */
  const type = computed<DetailType>(() => {
    const raw = String(route.query.type ?? 'announcement')
    return raw === 'notice' || raw === 'event' ? raw : 'announcement'
  })
  const id = computed(() => String(route.query.id ?? ''))
  const isEvent = computed(() => type.value === 'event')

  const loading = ref(false)
  const loadError = ref('')
  const item = ref<AnyItem | null>(null)

  /** 详情时间：公告=生效时间 通知=发送时间 事件=创建时间 */
  const timeText = computed(() => {
    const row = item.value as (AnyItem & { effectiveAt?: string; sendTime?: string }) | null
    return (
      row?.effectiveAt || row?.sendTime || (row as Api.Notify.EventItem | null)?.createTime || ''
    )
  })
  const sourceLabel = computed(() =>
    isEvent.value ? '来源' : type.value === 'notice' ? '发送人' : '发布人'
  )
  const sourceText = computed(() => {
    const row = item.value as (AnyItem & { publisherName?: string; senderName?: string }) | null
    if (isEvent.value) return ''
    return type.value === 'notice' ? row?.senderName || '' : row?.publisherName || ''
  })

  /** 公告类型文案（功能更新/系统维护/规则变更） */
  const annTypeText = (t?: number) => (t === 2 ? '系统维护' : t === 3 ? '规则变更' : '功能更新')
  /** 通知类型文案（门店通知/制度规范/活动安排） */
  const noticeTypeText = (t?: number) => (t === 2 ? '制度规范' : t === 3 ? '活动安排' : '门店通知')

  const tags = computed<
    { text: string; type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' }[]
  >(() => {
    const row = item.value
    if (!row) return []
    const list: { text: string; type?: 'primary' | 'success' | 'warning' | 'danger' | 'info' }[] =
      []
    if (type.value === 'announcement') {
      const ann = row as Api.Notify.AnnouncementItem
      list.push({ text: annTypeText(ann.noticeType), type: 'success' })
      if (ann.targetUserType === 2) list.push({ text: '仅管理员', type: 'warning' })
      if (ann.needAck) list.push({ text: '待确认', type: 'danger' })
      else if (ann.ackAt) list.push({ text: '已确认', type: 'success' })
    } else if (type.value === 'notice') {
      const notice = row as Api.Notify.NoticeItem
      list.push({ text: noticeTypeText(notice.noticeType), type: 'primary' })
    } else {
      list.push({ text: '事件提醒', type: 'warning' })
    }
    list.push(row.read ? { text: '已读', type: 'info' } : { text: '未读', type: 'warning' })
    return list
  })

  const needAck = computed(
    () => type.value === 'announcement' && !!(item.value as Api.Notify.AnnouncementItem)?.needAck
  )
  const canGoBiz = computed(() => {
    const row = item.value as Api.Notify.EventItem | null
    return isEvent.value && row?.bizType === 'PURCHASE_ORDER' && !!row?.bizId
  })
  const hasActions = computed(
    () => !!item.value && (!item.value.read || needAck.value || canGoBiz.value)
  )

  const load = async () => {
    if (!id.value) {
      item.value = null
      loadError.value = '缺少消息 ID，无法查看详情'
      return
    }
    loading.value = true
    loadError.value = ''
    try {
      if (type.value === 'announcement') item.value = await fetchAnnouncementDetail(id.value)
      else if (type.value === 'notice') item.value = await fetchNoticeDetail(id.value)
      else item.value = await fetchEventDetail(id.value)
      await markReadSilently()
    } catch (e: any) {
      item.value = null
      loadError.value = e?.message || '消息不存在或无权查看'
    } finally {
      loading.value = false
    }
  }

  /** 标记已读（静默）：失败不阻断阅读，只是列表未读态可能不复位 */
  const markReadSilently = async () => {
    const row = item.value
    if (!row || row.read) return
    try {
      if (type.value === 'announcement') await readAnnouncement(row.id)
      else if (type.value === 'notice') await readNotice(row.id)
      else await readEvent(row.id)
      row.read = true
      mittBus.emit('notify:refresh')
    } catch {
      /* 忽略 */
    }
  }

  const markRead = () => {
    void markReadSilently()
  }

  /** 留言区已读水位已推进：通知列表刷新，让「N 条新留言」红点消失 */
  const notifyListsRefresh = () => mittBus.emit('notify:refresh')

  const handleAck = async () => {
    const ann = item.value as Api.Notify.AnnouncementItem | null
    if (!ann) return
    try {
      await ackAnnouncement(ann.id)
      ann.read = true
      ann.needAck = false
      ann.ackAt = ann.ackAt || new Date().toISOString()
      ElMessage.success('已确认，感谢您的配合')
      mittBus.emit('notify:refresh')
    } catch (e: any) {
      ElMessage.error(e?.message || '确认失败')
    }
  }

  /** 返回：优先回上一页（保持列表筛选/分页），无历史记录时回消息中心对应 Tab */
  const goBack = () => {
    if (window.history.length > 1) router.back()
    else goList()
  }

  const goList = () => {
    router.push({ path: '/notify/center', query: { tab: String(route.query.tab ?? type.value) } })
  }

  const goBiz = () => {
    const row = item.value as Api.Notify.EventItem | null
    if (!row?.bizId) return
    router.push({ path: '/purchase/order', query: { id: row.bizId } })
  }

  // 同一路由切换不同 id（如从列表连续打开两条）时组件不重建，需按 query 重新取数
  watch(() => [type.value, id.value], load, { immediate: true })
</script>

<style scoped>
  @reference '@styles/core/tailwind.css';

  /* 高度随内容自适应，长正文/留言由布局 #app-main 滚动 */
  .notify-detail-page {
    min-height: 200px;
    padding-bottom: 16px;
  }

  .nd-footer-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-bottom: 16px;
  }

  .nd-footer-actions:empty {
    display: none;
  }
</style>
