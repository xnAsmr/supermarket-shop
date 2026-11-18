<!-- 通知详情版式（Art Design Pro X 通知详情页）
     整页卡片结构：标题 + 时间（左）｜操作按钮（右）→ 分隔线 → 标签行（左对齐）+ 发布人 →
     正文（复用 ArtMessageDetail 的富文本渲染）→ 尾部插槽（留言区 / 补充操作）。
     三个详情页（消息中心 / 平台公告 / 租户通知）共用此版式，只通过 props + 插槽定制。 -->
<template>
  <!-- 高度随内容自适应：详情正文长度不可控，固定一屏高会配合卡片 overflow:hidden 把内容裁掉；
       滚动交给布局的 #app-main（内部按布局需求自行滚动） -->
  <div class="art-notify-detail">
    <div class="nd-card">
      <div class="nd-head">
        <div class="nd-head-main">
          <h2 class="nd-title">{{ title }}</h2>
          <p v-if="time" class="nd-time">{{ time }}</p>
        </div>
        <div class="nd-head-actions">
          <slot name="actions" />
        </div>
      </div>

      <div class="nd-divider" />

      <div v-if="tags.length || source" class="nd-meta">
        <ElTag
          v-for="tag in tags"
          :key="tag.text"
          :type="tag.type || 'info'"
          effect="light"
          size="small"
          round
        >
          {{ tag.text }}
        </ElTag>
        <span v-if="source" class="nd-source">{{ sourceLabel }}：{{ source }}</span>
      </div>

      <div class="nd-body">
        <ArtMessageDetail bare :content="content" />
      </div>

      <div v-if="$slots.default" class="nd-extra">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ElTag } from 'element-plus'
  import ArtMessageDetail from '@/components/core/others/art-message-detail/index.vue'

  defineOptions({ name: 'ArtNotifyDetail' })

  /** 标签徽章（类型 / 状态 / 统计等） */
  interface NotifyDetailTag {
    text: string
    type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  }

  withDefaults(
    defineProps<{
      title: string
      /** 副标题时间（标题下方灰色小字） */
      time?: string
      /** 标签行徽章（左对齐） */
      tags?: NotifyDetailTag[]
      /** 来源人（发布人/发送人），与标签同行展示 */
      source?: string
      sourceLabel?: string
      /** 富文本正文（受信输入，由 ArtMessageDetail 渲染） */
      content?: string
    }>(),
    {
      time: '',
      tags: () => [],
      source: '',
      sourceLabel: '发布人',
      content: ''
    }
  )
</script>

<style scoped>
  @reference '@styles/core/tailwind.css';

  .nd-card {
    overflow: hidden;
    background: var(--art-main-bg-color);
    border: 1px solid var(--art-card-border);
    border-radius: 10px;
  }

  .nd-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px 18px;
  }

  .nd-head-main {
    min-width: 0;
  }

  .nd-title {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    line-height: 1.45;
    color: var(--art-text-color);
    word-break: break-word;
  }

  .nd-time {
    margin: 8px 0 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--art-gray-500);
  }

  .nd-head-actions {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
  }

  .nd-divider {
    height: 1px;
    background: var(--art-card-border);
  }

  .nd-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 16px 24px 0;
  }

  .nd-source {
    font-size: 12px;
    line-height: 1.6;
    color: var(--art-gray-500);
  }

  .nd-body {
    padding: 14px 24px 24px;
    font-size: 15px;
    line-height: 1.9;
    color: var(--art-gray-800);
    word-break: break-word;
  }

  .nd-extra {
    padding: 0 24px 24px;
  }
</style>
