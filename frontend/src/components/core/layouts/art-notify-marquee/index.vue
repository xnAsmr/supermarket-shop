<!-- 未读消息滚动条（按消息类型分组，每组一条官方文字滚动条）
     登录后自动拉取「发送给自己的未读平台公告 + 未读租户通知 + 未读事件提醒」，
     复用官方 ArtTextScroll：系统公告=危险色(danger)、我的通知=当前主题色(theme)、事件提醒=警告色(warning)，
     用户可直观区分消息类型；每组仅滚动 标题/发送人/发送时间（不滚正文内容），
     点击跳转消息中心对应页签；已读后自动移除，无未读整组隐藏；
     右侧 × 关闭后：该组「关闭时最新一条」仍未读期间保持关闭，已读或来了新消息才重新弹出。 -->
<template>
  <div v-if="viewGroups.length" class="art-notify-marquee">
    <div
      v-for="group in viewGroups"
      :key="group.key"
      class="marquee-row"
      @click="handleClick($event, group.tab)"
    >
      <ArtTextScroll :text="group.text" :type="group.scrollType" show-close @close="handleClose(group.key)" />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { fetchAnnouncements, fetchNotices, fetchEvents } from '@/api/notify'
  import { mittBus } from '@/utils/sys'

  defineOptions({ name: 'ArtNotifyMarquee' })

  /** 官方 ArtTextScroll 支持的主题类型 */
  type ScrollType = 'theme' | 'danger' | 'warning'

  /** 消息分组 key（与消息中心页签一致） */
  type GroupKey = 'announcement' | 'notice' | 'event'

  interface MarqueeItem {
    id: string
    type: GroupKey
    title: string
    sender: string
    time: string
  }

  /** 分组配置：key → 滚动条主题类型 / 消息中心页签 / 条目标签文案 / 关闭状态存储 key */
  const GROUP_CONFIGS: {
    key: GroupKey
    scrollType: ScrollType
    tab: GroupKey
    label: string
    dismissKey: string
  }[] = [
    {
      key: 'announcement',
      scrollType: 'danger',
      tab: 'announcement',
      label: '公告',
      dismissKey: 'notify-marquee-dismissed-announcement'
    },
    { key: 'notice', scrollType: 'theme', tab: 'notice', label: '通知', dismissKey: 'notify-marquee-dismissed-notice' },
    { key: 'event', scrollType: 'warning', tab: 'event', label: '提醒', dismissKey: 'notify-marquee-dismissed-event' }
  ]

  const router = useRouter()

  /** 各分组未读列表（按发送时间倒序） */
  const groups = ref<Record<GroupKey, MarqueeItem[]>>({ announcement: [], notice: [], event: [] })
  /** 各分组「关闭时最新一条」的 id：该消息仍未读期间保持关闭，已读或来了新消息才重新弹出 */
  const dismissed = ref<Record<GroupKey, string>>({ announcement: '', notice: '', event: '' })

  /** 每组最多展示 10 条，避免滚动文本过长 */
  const MAX_ITEMS = 10
  /** 轮询间隔（ms）：与铃铛/消息中心共用 notify:refresh 事件，此处仅作兜底 */
  const POLL_INTERVAL = 60_000

  /** 紧凑时间：2026-10-25T13:39:58 / 2026-10-25 13:39:58 → 2026-10-25 13:39 */
  const formatTime = (time?: string) => (time ? time.replace('T', ' ').slice(0, 16) : '')

  /** HTML 转义：标题/发送人均为管理端录入内容，经 v-html 渲染前必须转义，防止 XSS */
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')

  /**
   * 单组滚动文本（HTML 字符串，由官方组件 v-html 渲染）：
   * 每条 = 类型标签 + 标题 + 发送人 · 发送时间，条目间用 ┃ 分隔；不含正文内容。
   * 标签/次要信息用 currentColor 派生，自动跟随该组滚动条的主题色（danger/theme/warning）。
   */
  const buildText = (list: MarqueeItem[], label: string, tab: GroupKey) =>
    list
      .map(
        (item) =>
          `<span class="nm-item" data-tab="${tab}" ` +
          'style="display:inline-flex;align-items:center;gap:8px;padding:0 6px;cursor:pointer;">' +
          `<em style="font-style:normal;flex-shrink:0;padding:1px 6px;border-radius:4px;font-size:11px;line-height:1.5;background:color-mix(in srgb, currentColor 12%, transparent);">${label}</em>` +
          `<b style="font-weight:500;">${escapeHtml(item.title)}</b>` +
          `<i style="font-style:normal;font-size:12px;opacity:0.75;">${escapeHtml(item.sender)} · ${escapeHtml(
            formatTime(item.time)
          )}</i>` +
          '</span>'
      )
      .join('<span style="opacity:0.4;">┃</span>')

  /** 可见分组（含文本）：无未读 / 已关闭且关闭时最新消息仍未读 → 不渲染 */
  const viewGroups = computed(() =>
    GROUP_CONFIGS.map((cfg) => {
      const list = groups.value[cfg.key]
      const dismissedId = dismissed.value[cfg.key]
      const visible = list.length > 0 && (!dismissedId || !list.some((item) => item.id === dismissedId))
      return { ...cfg, visible, text: buildText(list, cfg.label, cfg.tab) }
    }).filter((group) => group.visible)
  )

  /** 拉取三类未读消息（公告取发布方/生效时间，通知取发送人/发送时间，事件取系统/创建时间；均不含正文） */
  const load = async () => {
    try {
      const [announcements, notices, events] = await Promise.all([
        fetchAnnouncements(),
        fetchNotices(),
        fetchEvents()
      ])
      const next: Record<GroupKey, MarqueeItem[]> = { announcement: [], notice: [], event: [] }
      announcements
        .filter((a) => !a.read)
        .forEach((a) =>
          next.announcement.push({
            id: a.id,
            type: 'announcement',
            title: a.title,
            sender: a.publisherName || '平台',
            time: a.effectiveAt || ''
          })
        )
      notices
        .filter((n) => !n.read)
        .forEach((n) =>
          next.notice.push({
            id: n.id,
            type: 'notice',
            title: n.title,
            sender: n.senderName || '管理员',
            time: n.sendTime || ''
          })
        )
      events
        .filter((e) => !e.read)
        .forEach((e) =>
          next.event.push({
            id: e.id,
            type: 'event',
            title: e.title,
            sender: '系统',
            time: e.createTime || ''
          })
        )
      ;(Object.keys(next) as GroupKey[]).forEach((key) => {
        next[key].sort((a, b) => (b.time || '').localeCompare(a.time || ''))
        next[key] = next[key].slice(0, MAX_ITEMS)
      })
      groups.value = next
    } catch {
      /* 忽略：网络异常时保持原状 */
    }
  }

  /** 点击跳转消息中心对应页签阅读（已读状态由消息中心打开详情时写入） */
  const handleClick = (e: MouseEvent, tab: GroupKey) => {
    const target = (e.target as HTMLElement).closest('[data-tab]') as HTMLElement | null
    if (!target) return
    router.push({ path: '/notify/center', query: { tab } })
  }

  /** 点击右侧 × 关闭：记住该组当前最新一条，本次会话内不再原样弹回 */
  const handleClose = (key: GroupKey) => {
    const cfg = GROUP_CONFIGS.find((c) => c.key === key)
    if (!cfg) return
    dismissed.value = { ...dismissed.value, [key]: groups.value[key][0]?.id ?? '' }
    try {
      sessionStorage.setItem(cfg.dismissKey, dismissed.value[key])
    } catch {
      /* 隐私模式等写入失败时仅本次内存生效 */
    }
  }

  let timer: number | undefined

  onMounted(() => {
    // 恢复各分组关闭状态（sessionStorage：同一标签页会话内有效，刷新不重现）
    try {
      GROUP_CONFIGS.forEach((cfg) => {
        dismissed.value = { ...dismissed.value, [cfg.key]: sessionStorage.getItem(cfg.dismissKey) || '' }
      })
    } catch {
      /* 忽略：读取失败按未关闭处理 */
    }
    void load()
    timer = window.setInterval(() => void load(), POLL_INTERVAL)
    // 消息中心/铃铛标记已读后同步刷新
    mittBus.on('notify:refresh', load)
  })

  onBeforeUnmount(() => {
    if (timer) window.clearInterval(timer)
    mittBus.off('notify:refresh', load)
  })
</script>

<style scoped>
  @reference '@styles/core/tailwind.css';

  .art-notify-marquee {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0 0 10px;
  }

  .marquee-row {
    margin: 0 20px;
  }

  /* 官方组件为子组件，其根节点携带本组件 scope id，:deep 可穿透至内部 v-html 内容 */
  :deep(.nm-item:hover) {
    background: color-mix(in srgb, currentColor 12%, transparent);
    border-radius: 4px;
  }

  @media only screen and (width <= 768px) {
    .art-notify-marquee {
      margin: 0 0 8px;
    }

    .marquee-row {
      margin: 0 12px;
    }
  }
</style>
