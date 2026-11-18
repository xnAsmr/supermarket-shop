<!-- 通知组件（消息中心铃铛） -->
<template>
  <div
    class="art-notification-panel art-card-sm !shadow-xl"
    :style="{
      transform: show ? 'scaleY(1)' : 'scaleY(0.9)',
      opacity: show ? 1 : 0
    }"
    v-show="visible"
    @click.stop
  >
    <div class="flex-cb px-3.5 mt-3.5">
      <span class="text-base font-medium text-g-800">{{ $t('notice.title') }}</span>
      <span
        class="text-xs text-g-800 px-1.5 py-1 c-p select-none rounded hover:bg-g-200"
        @click="markCurrentTabRead"
      >
        {{ $t('notice.btnRead') }}
      </span>
    </div>

    <ul class="box-border flex items-end w-full h-12.5 px-3.5 border-b-d">
      <li
        v-for="(item, index) in barList"
        :key="index"
        class="h-12 leading-12 mr-5 overflow-hidden text-[13px] text-g-700 c-p select-none"
        :class="{ 'bar-active': barActiveIndex === index }"
        @click="changeBar(index)"
      >
        {{ item.name }} ({{ item.num }})
      </li>
    </ul>

    <div class="w-full h-[calc(100%-95px)]">
      <div class="h-[calc(100%-60px)] overflow-y-scroll scrollbar-thin">
        <!-- 系统公告 -->
        <ul v-show="barActiveIndex === 0">
          <li
            v-for="item in announcementList"
            :key="item.id"
            class="box-border flex-c px-3.5 py-3.5 c-p last:border-b-0 hover:bg-g-200/60"
            @click="selectItem('announcement', item)"
          >
            <div
              class="size-9 leading-9 text-center rounded-lg flex-cc"
              :class="annTypeClass(item.noticeType)"
            >
              <ArtSvgIcon class="text-lg !bg-transparent" :icon="annTypeIcon(item.noticeType)" />
            </div>
            <div class="w-[calc(100%-45px)] ml-3.5">
              <h4 class="text-sm font-normal leading-5.5 text-g-900 truncate">
                {{ item.title }}
                <span v-if="!item.read" class="unread-bell-dot" />
              </h4>
              <p class="mt-1.5 text-xs text-g-500">{{ item.publisherName }} · {{ item.effectiveAt }}</p>
            </div>
          </li>
        </ul>

        <!-- 我的通知 -->
        <ul v-show="barActiveIndex === 1">
          <li
            v-for="item in noticeList"
            :key="item.id"
            class="box-border flex-c px-3.5 py-3.5 c-p last:border-b-0 hover:bg-g-200/60"
            @click="selectItem('notice', item)"
          >
            <div class="size-9 leading-9 text-center rounded-lg flex-cc bg-info/12 text-info">
              <ArtSvgIcon class="text-lg !bg-transparent" icon="ri:notification-3-line" />
            </div>
            <div class="w-[calc(100%-45px)] ml-3.5">
              <h4 class="text-sm font-normal leading-5.5 text-g-900 truncate">
                {{ item.title }}
                <span v-if="!item.read" class="unread-bell-dot" />
              </h4>
              <p class="mt-1.5 text-xs text-g-500">{{ item.senderName }} · {{ item.sendTime }}</p>
            </div>
          </li>
        </ul>

        <!-- 事件提醒 -->
        <ul v-show="barActiveIndex === 2">
          <li
            v-for="item in eventList"
            :key="item.id"
            class="box-border flex-c px-3.5 py-3.5 c-p last:border-b-0 hover:bg-g-200/60"
            @click="selectItem('event', item)"
          >
            <div class="size-9 leading-9 text-center rounded-lg flex-cc bg-theme/12 text-theme">
              <ArtSvgIcon class="text-lg !bg-transparent" icon="ri:error-warning-line" />
            </div>
            <div class="w-[calc(100%-45px)] ml-3.5">
              <h4 class="text-sm font-normal leading-5.5 text-g-900 truncate">
                {{ item.title }}
                <span v-if="!item.read" class="unread-bell-dot" />
              </h4>
              <p class="mt-1.5 text-xs text-g-500">{{ item.createTime }}</p>
            </div>
          </li>
        </ul>

        <!-- 空状态 -->
        <div
          v-show="currentTabIsEmpty"
          class="relative top-25 h-full text-g-500 text-center !bg-transparent"
        >
          <ArtSvgIcon icon="system-uicons:inbox" class="text-5xl" />
          <p class="mt-3.5 text-xs !bg-transparent"
            >{{ $t('notice.text[0]') }}{{ barList[barActiveIndex].name }}</p
          >
        </div>
      </div>

      <div class="relative box-border w-full px-3.5">
        <ElButton class="w-full mt-3" @click="handleViewAll" v-ripple>
          {{ $t('notice.viewAll') }}
        </ElButton>
      </div>
    </div>

    <div class="h-25"></div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import {
    fetchAnnouncements,
    fetchEvents,
    fetchNotices,
    fetchUnreadCount,
    readAnnouncement,
    readEvent,
    readNotice
  } from '@/api/notify'
  import { mittBus } from '@/utils/sys'

  defineOptions({ name: 'ArtNotification' })

  interface BarItem {
    /** 名称 */
    name: string
    /** 数量 */
    num: number
    /** 定位 key */
    key: 'announcement' | 'notice' | 'event'
  }

  const { t } = useI18n()
  const router = useRouter()

  const props = defineProps<{
    value: boolean
  }>()

  const emit = defineEmits<{
    'update:value': [value: boolean]
    'update:unread': [value: number]
  }>()

  const show = ref(false)
  const visible = ref(false)
  const barActiveIndex = ref(0)

  // 真实数据
  const announcementList = ref<Api.Notify.AnnouncementItem[]>([])
  const noticeList = ref<Api.Notify.NoticeItem[]>([])
  const eventList = ref<Api.Notify.EventItem[]>([])

  const unreadTotal = computed(
    () =>
      announcementList.value.filter((a) => !a.read).length +
      noticeList.value.filter((n) => !n.read).length +
      eventList.value.filter((e) => !e.read).length
  )

  const barList = computed<BarItem[]>(() => [
    { name: t('notice.bar[0]'), num: announcementList.value.filter((a) => !a.read).length, key: 'announcement' },
    { name: t('notice.bar[1]'), num: noticeList.value.filter((n) => !n.read).length, key: 'notice' },
    { name: t('notice.bar[2]'), num: eventList.value.filter((e) => !e.read).length, key: 'event' }
  ])

  const annTypeIcon = (type: number) =>
    type === 1 ? 'ri:rocket-line' : type === 2 ? 'ri:tools-line' : 'ri:shield-check-line'
  const annTypeClass = (type: number) =>
    type === 1 ? 'bg-theme/12 text-theme' : type === 2 ? 'bg-warning/12 text-warning' : 'bg-info/12 text-info'

  const currentTabIsEmpty = computed(() => {
    const map = [announcementList.value, noticeList.value, eventList.value]
    return map[barActiveIndex.value]?.length === 0
  })

  /* ------------------------------ 数据加载 ------------------------------ */
  const loadUnread = async () => {
    try {
      const [announcements, notices, events] = await Promise.all([
        fetchAnnouncements(),
        fetchNotices(),
        fetchEvents()
      ])
      announcementList.value = announcements
      noticeList.value = notices
      eventList.value = events
      emit('update:unread', unreadTotal.value)
    } catch {
      /* 忽略 */
    }
  }

  /* ------------------------------ 交互 ------------------------------ */
  const changeBar = (index: number) => {
    barActiveIndex.value = index
  }

  const selectItem = async (
    type: 'announcement' | 'notice' | 'event',
    item: Api.Notify.AnnouncementItem | Api.Notify.NoticeItem | Api.Notify.EventItem
  ) => {
    if (!item.read) {
      try {
        if (type === 'announcement') await readAnnouncement(item.id)
        else if (type === 'notice') await readNotice(item.id)
        else await readEvent(item.id)
        item.read = true
        emit('update:unread', unreadTotal.value)
      } catch {
        /* 忽略 */
      }
    }
    emit('update:value', false)
    router.push({ path: '/notify/center', query: { tab: type } })
  }

  const markCurrentTabRead = async () => {
    const key = barList.value[barActiveIndex.value].key
    try {
      if (key === 'announcement') {
        await Promise.all(
          announcementList.value.filter((a) => !a.read).map((a) => readAnnouncement(a.id))
        )
        announcementList.value.forEach((a) => (a.read = true))
      } else if (key === 'notice') {
        await Promise.all(noticeList.value.filter((n) => !n.read).map((n) => readNotice(n.id)))
        noticeList.value.forEach((n) => (n.read = true))
      } else {
        await Promise.all(eventList.value.filter((e) => !e.read).map((e) => readEvent(e.id)))
        eventList.value.forEach((e) => (e.read = true))
      }
      emit('update:unread', unreadTotal.value)
      mittBus.emit('notify:refresh')
    } catch {
      /* 忽略 */
    }
  }

  const handleViewAll = () => {
    emit('update:value', false)
    const key = barList.value[barActiveIndex.value].key
    router.push({ path: '/notify/center', query: { tab: key } })
  }

  /* ------------------------------ 动画 ------------------------------ */
  const showNotice = (open: boolean) => {
    if (open) {
      visible.value = true
      setTimeout(() => {
        show.value = true
      }, 5)
      void loadUnread()
    } else {
      show.value = false
      setTimeout(() => {
        visible.value = false
      }, 350)
    }
  }

  watch(
    () => props.value,
    (newValue) => showNotice(newValue)
  )

  // 初始加载未读数（用于顶栏角标）
  void fetchUnreadCount()
    .then((count) => emit('update:unread', count.announcements + count.notices + count.events))
    .catch(() => {})

  // 消息中心操作后刷新铃铛
  mittBus.on('notify:refresh', loadUnread)
</script>

<style scoped>
  @reference '@styles/core/tailwind.css';

  .art-notification-panel {
    @apply absolute 
    top-14.5 
    right-5 
    w-90 
    h-125 
    overflow-hidden 
    transition-all 
    duration-300
    origin-top 
    will-change-[top,left] 
    max-[640px]:top-[65px]
    max-[640px]:right-0
    max-[640px]:w-full 
    max-[640px]:h-[80vh];
  }

  .bar-active {
    color: var(--theme-color) !important;
    border-bottom: 2px solid var(--theme-color);
  }

  .unread-bell-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    margin-left: 6px;
    border-radius: 50%;
    background: var(--el-color-danger);
    vertical-align: middle;
  }

  .scrollbar-thin::-webkit-scrollbar {
    width: 5px !important;
  }

  .dark .scrollbar-thin::-webkit-scrollbar-track {
    background-color: var(--default-box-color);
  }

  .dark .scrollbar-thin::-webkit-scrollbar-thumb {
    background-color: #222 !important;
  }
</style>
