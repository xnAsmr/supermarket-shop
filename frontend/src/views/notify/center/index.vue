<!-- 消息中心 -->
<template>
  <div class="notify-center-page art-full-height">
    <ElCard class="art-table-card">
      <!-- 概览 -->
      <div class="overview flex-wrap gap-4 mb-4">
        <div
          class="overview-item"
          :class="{ active: activeTab === 'announcement' }"
          @click="activeTab = 'announcement'"
        >
          <div class="overview-title">系统公告</div>
          <div class="overview-num">{{ annUnread }}<span class="overview-unit">条未读</span></div>
        </div>
        <div
          class="overview-item"
          :class="{ active: activeTab === 'notice' }"
          @click="activeTab = 'notice'"
        >
          <div class="overview-title">我的通知</div>
          <div class="overview-num"
            >{{ noticeUnread }}<span class="overview-unit">条未读</span></div
          >
        </div>
        <div
          class="overview-item"
          :class="{ active: activeTab === 'event' }"
          @click="activeTab = 'event'"
        >
          <div class="overview-title">事件提醒</div>
          <div class="overview-num">{{ eventUnread }}<span class="overview-unit">条未读</span></div>
        </div>
      </div>

      <ElTabs v-model="activeTab" class="notify-tabs">
        <!-- 系统公告 -->
        <ElTabPane label="系统公告" name="announcement">
          <div class="tab-head flex-cb">
            <span class="tab-hint">来自平台总部的功能更新、系统维护与规则变更公告</span>
            <ElButton
              v-if="annUnread > 0"
              size="small"
              link
              type="primary"
              v-ripple
              @click="markAllAnnouncements"
              >全部标记已读</ElButton
            >
          </div>
          <div v-loading="loadingAnn" class="list-box">
            <div v-if="!announcements.length" class="empty">
              <ArtSvgIcon icon="system-uicons:inbox" class="text-5xl" />
              <p>暂无系统公告</p>
            </div>
            <div
              v-for="item in announcements"
              :key="item.id"
              class="list-row"
              :class="{ unread: !item.read }"
              @click="openDetail('announcement', item)"
            >
              <div class="list-row-icon" :class="annTypeClass(item.noticeType)">
                <ArtSvgIcon :icon="annTypeIcon(item.noticeType)" />
              </div>
              <div class="list-row-main">
                <div class="list-row-title">
                  {{ item.title }}
                  <ElTag v-if="item.targetUserType === 2" size="small" type="info" effect="plain"
                    >仅管理员</ElTag
                  >
                  <ElTag v-if="item.requireAck" size="small" type="warning" effect="plain"
                    >需确认</ElTag
                  >
                  <!-- 留言未读红点：打开详情后由留言区推进已读水位并自动消失 -->
                  <ElTag v-if="item.unreadComments" size="small" type="danger" effect="dark" round
                    >{{ item.unreadComments }} 条新留言</ElTag
                  >
                  <ElTag v-if="item.needAck" size="small" type="danger" effect="plain"
                    >待确认</ElTag
                  >
                  <ElTag v-else-if="item.ackAt" size="small" type="success" effect="plain"
                    >已确认</ElTag
                  >
                  <ElTag v-else-if="item.read" size="small" type="info" effect="plain">已读</ElTag>
                  <span v-else class="unread-dot" />
                </div>
                <div class="list-row-meta">
                  <span>{{ item.publisherName }}</span>
                  <span class="ml-3">{{ item.effectiveAt }}</span>
                </div>
              </div>
              <ArtSvgIcon icon="ri:arrow-right-s-line" class="list-row-arrow" />
            </div>
          </div>
        </ElTabPane>

        <!-- 我的通知 -->
        <ElTabPane label="我的通知" name="notice">
          <div class="tab-head flex-cb">
            <span class="tab-hint">来自本租户管理员/店长的门店与角色通知</span>
            <ElButton
              v-if="noticeUnread > 0"
              size="small"
              link
              type="primary"
              v-ripple
              @click="markAllNotices"
              >全部标记已读</ElButton
            >
          </div>
          <div v-loading="loadingNotice" class="list-box">
            <div v-if="!notices.length" class="empty">
              <ArtSvgIcon icon="system-uicons:inbox" class="text-5xl" />
              <p>暂无通知</p>
            </div>
            <div
              v-for="item in notices"
              :key="item.id"
              class="list-row"
              :class="{ unread: !item.read }"
              @click="openDetail('notice', item)"
            >
              <div class="list-row-icon bg-info/12 text-info">
                <ArtSvgIcon icon="ri:notification-3-line" />
              </div>
              <div class="list-row-main">
                <div class="list-row-title">
                  {{ item.title }}
                  <ElTag v-if="item.unreadComments" size="small" type="danger" effect="dark" round
                    >{{ item.unreadComments }} 条新留言</ElTag
                  >
                  <ElTag v-if="item.read" size="small" type="info" effect="plain">已读</ElTag>
                  <span v-else class="unread-dot" />
                </div>
                <div class="list-row-meta">
                  <span>{{ item.senderName }}</span>
                  <span class="ml-3">{{ item.sendTime }}</span>
                </div>
              </div>
              <ArtSvgIcon icon="ri:arrow-right-s-line" class="list-row-arrow" />
            </div>
          </div>
        </ElTabPane>

        <!-- 事件提醒 -->
        <ElTabPane label="事件提醒" name="event">
          <div class="tab-head flex-cb">
            <span class="tab-hint">系统业务事件（如采购审批）触发的待办提醒</span>
            <ElButton
              v-if="eventUnread > 0"
              size="small"
              link
              type="primary"
              v-ripple
              @click="markAllEvents"
              >全部已读</ElButton
            >
          </div>
          <div v-loading="loadingEvent" class="list-box">
            <div v-if="!events.length" class="empty">
              <ArtSvgIcon icon="system-uicons:inbox" class="text-5xl" />
              <p>暂无事件提醒</p>
            </div>
            <div
              v-for="item in events"
              :key="item.id"
              class="list-row"
              :class="{ unread: !item.read }"
              @click="openDetail('event', item)"
            >
              <div class="list-row-icon bg-theme/12 text-theme">
                <ArtSvgIcon icon="ri:error-warning-line" />
              </div>
              <div class="list-row-main">
                <div class="list-row-title">
                  {{ item.title }}
                  <ElTag v-if="item.read" size="small" type="info" effect="plain">已读</ElTag>
                  <span v-else class="unread-dot" />
                </div>
                <div class="list-row-meta">
                  <span class="line-clamp-1">{{ item.content }}</span>
                  <span class="ml-3 shrink-0">{{ item.createTime }}</span>
                </div>
              </div>
              <ArtSvgIcon icon="ri:arrow-right-s-line" class="list-row-arrow" />
            </div>
          </div>
        </ElTabPane>
      </ElTabs>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import {
    fetchAnnouncements,
    fetchEvents,
    fetchNotices,
    readAnnouncement,
    readNotice,
    readAllEvents,
    fetchUnreadCount
  } from '@/api/notify'
  import { mittBus } from '@/utils/sys'

  defineOptions({ name: 'NotifyCenter' })

  type TabKey = 'announcement' | 'notice' | 'event'
  type AnyItem = Api.Notify.AnnouncementItem | Api.Notify.NoticeItem | Api.Notify.EventItem

  const route = useRoute()
  const router = useRouter()

  const activeTab = ref<TabKey>((route.query.tab as TabKey) || 'announcement')

  const announcements = ref<Api.Notify.AnnouncementItem[]>([])
  const notices = ref<Api.Notify.NoticeItem[]>([])
  const events = ref<Api.Notify.EventItem[]>([])
  const loadingAnn = ref(false)
  const loadingNotice = ref(false)
  const loadingEvent = ref(false)

  const annUnread = computed(() => announcements.value.filter((a) => !a.read).length)
  const noticeUnread = computed(() => notices.value.filter((n) => !n.read).length)
  const eventUnread = computed(() => events.value.filter((e) => !e.read).length)

  /* ------------------------------ 详情 ------------------------------ */
  /**
   * 打开详情整页：静态路由 + query（type/id/tab），可直链、可刷新。
   * 标记已读与留言已读水位推进在详情页完成，因此这里不再就地改列表状态；
   * 详情页会 emit notify:refresh，本页若在 keepAlive 缓存中会同步刷新列表。
   */
  const openDetail = (type: TabKey, item: AnyItem) => {
    router.push({ path: '/notify/detail', query: { type, id: item.id, tab: activeTab.value } })
  }

  const annTypeIcon = (type: number) =>
    type === 1 ? 'ri:rocket-line' : type === 2 ? 'ri:tools-line' : 'ri:shield-check-line'
  const annTypeClass = (type: number) =>
    type === 1
      ? 'bg-theme/12 text-theme'
      : type === 2
        ? 'bg-warning/12 text-warning'
        : 'bg-info/12 text-info'

  /* ------------------------------ 批量已读 ------------------------------ */
  const markAllAnnouncements = async () => {
    try {
      await Promise.all(
        announcements.value.filter((a) => !a.read).map((a) => readAnnouncement(a.id))
      )
      await loadAnnouncements()
      notifyBell()
    } catch {
      /* 忽略 */
    }
  }
  const markAllNotices = async () => {
    try {
      await Promise.all(notices.value.filter((n) => !n.read).map((n) => readNotice(n.id)))
      await loadNotices()
      notifyBell()
    } catch {
      /* 忽略 */
    }
  }
  const markAllEvents = async () => {
    try {
      await readAllEvents()
      await loadEvents()
      notifyBell()
    } catch {
      /* 忽略 */
    }
  }

  /* ------------------------------ 加载 ------------------------------ */
  const loadAnnouncements = async () => {
    loadingAnn.value = true
    try {
      announcements.value = await fetchAnnouncements()
    } finally {
      loadingAnn.value = false
    }
  }
  const loadNotices = async () => {
    loadingNotice.value = true
    try {
      notices.value = await fetchNotices()
    } finally {
      loadingNotice.value = false
    }
  }
  const loadEvents = async () => {
    loadingEvent.value = true
    try {
      events.value = await fetchEvents()
    } finally {
      loadingEvent.value = false
    }
  }

  const notifyBell = () => mittBus.emit('notify:refresh')

  onMounted(() => {
    void fetchUnreadCount().catch(() => {})
    void Promise.all([loadAnnouncements(), loadNotices(), loadEvents()])
    mittBus.on('notify:refresh', refreshFromBell)
  })

  const refreshFromBell = () => {
    void Promise.all([loadAnnouncements(), loadNotices(), loadEvents()])
  }

  watch(activeTab, () => {
    router.replace({ path: '/notify/center', query: { tab: activeTab.value } })
  })

  onUnmounted(() => {
    mittBus.off('notify:refresh', refreshFromBell)
  })
</script>

<style scoped>
  @reference '@styles/core/tailwind.css';

  .overview {
    display: flex;
  }

  .overview-item {
    flex: 1;
    min-width: 160px;
    padding: 16px 18px;
    border: 1px solid var(--art-card-border);
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .overview-item:hover,
  .overview-item.active {
    border-color: var(--theme-color);
    background: color-mix(in srgb, var(--theme-color) 6%, transparent);
  }

  .overview-title {
    font-size: 13px;
    color: var(--art-gray-500);
  }

  .overview-num {
    margin-top: 6px;
    font-size: 26px;
    font-weight: 600;
    color: var(--art-text-color);
  }

  .overview-unit {
    margin-left: 6px;
    font-size: 12px;
    font-weight: 400;
    color: var(--art-gray-500);
  }

  .tab-head {
    margin-bottom: 8px;
  }

  .tab-hint {
    font-size: 12px;
    color: var(--art-gray-500);
  }

  .list-box {
    min-height: 280px;
  }

  .list-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 12px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .list-row:hover {
    background: var(--art-hover-color);
  }

  .list-row.unread {
    background: color-mix(in srgb, var(--theme-color) 5%, transparent);
  }

  .list-row-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    font-size: 18px;
    border-radius: 10px;
    flex-shrink: 0;
  }

  .list-row-main {
    flex: 1;
    min-width: 0;
  }

  .list-row-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--art-text-color);
  }

  .list-row-meta {
    display: flex;
    align-items: center;
    margin-top: 4px;
    font-size: 12px;
    color: var(--art-gray-500);
  }

  .list-row-arrow {
    color: var(--art-gray-500);
    flex-shrink: 0;
  }

  .unread-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--el-color-danger);
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 280px;
    color: var(--art-gray-500);
  }

  .line-clamp-1 {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
