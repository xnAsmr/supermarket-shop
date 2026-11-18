<!-- 消息详情（文章详情排版）
     经典文章版式——标签行 + 居中大标题 + 元信息行（· 分隔）+ 渐变短分割线 + 正文文章排版；
     正文支持富文本（v-html，受信输入）与旧版纯文本（pre-wrap）两种渲染，
     内置图片圆角居中、视频、表格、引用块、代码块等富文本元素样式，亮/暗色主题自适应。

     也可当作「纯正文渲染器」：bare=true 时只输出正文（标题/标签/元信息/分割线全部隐藏），
     供详情页（ArtNotifyDetail 版式）复用同一套富文本样式，避免两处维护一份富文本 CSS。 -->
<template>
  <div class="art-message-detail">
    <header
      v-if="!bare && (tags?.length || title || subtitle || metaItems?.length)"
      class="detail-header"
    >
      <div v-if="tags?.length" class="detail-tags">
        <ElTag
          v-for="tag in tags"
          :key="tag.text"
          :type="tag.type || 'info'"
          effect="plain"
          size="small"
          round
        >
          {{ tag.text }}
        </ElTag>
      </div>
      <h2 v-if="title" class="detail-title">{{ title }}</h2>
      <p v-if="subtitle" class="detail-subtitle">{{ subtitle }}</p>
      <div v-if="metaItems?.length" class="detail-meta">
        <template v-for="(item, index) in metaItems" :key="item.label">
          <span v-if="index > 0" class="detail-meta-dot">·</span>
          <span class="detail-meta-item">{{ item.label }} {{ item.value }}</span>
        </template>
      </div>
    </header>

    <div v-if="!bare" class="detail-divider" />

    <div class="detail-body">
      <!-- 富文本内容（v-html）：公告/通知正文由平台/租户管理员经富文本编辑器发布，属受信输入；
           旧版纯文本数据不含 HTML 标签时按 pre-wrap 原样展示 -->
      <div v-if="isHtmlContent" class="detail-rich" v-html="content"></div>
      <div v-else-if="content" class="detail-plain">{{ content }}</div>
      <div v-else class="detail-empty">暂无内容</div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue'
  import { ElTag } from 'element-plus'
  import type { PropType } from 'vue'

  defineOptions({ name: 'ArtMessageDetail' })

  /** 元信息项（如：发布人 张三） */
  interface DetailMetaItem {
    label: string
    value: string
  }

  /** 状态标签（文章标题上方的分类/状态徽章） */
  interface DetailTag {
    text: string
    type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  }

  const props = defineProps({
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    metaItems: { type: Array as PropType<DetailMetaItem[]>, default: () => [] },
    tags: { type: Array as PropType<DetailTag[]>, default: () => [] },
    content: { type: String, default: '' },
    /** 是否按富文本渲染；不传则自动检测内容是否含 HTML 标签 */
    isHtml: { type: Boolean, default: undefined },
    /** 只输出正文（隐藏标题/标签/元信息/分割线），供详情页内嵌 */
    bare: { type: Boolean, default: false }
  })

  /** 正文是否含 HTML 标签（富文本）——含则 v-html 渲染，否则按纯文本 pre-wrap 展示（兼容旧数据） */
  const isHtmlContent = computed(() =>
    props.isHtml !== undefined ? props.isHtml : /<[a-z][\s\S]*>/i.test(props.content || '')
  )
</script>

<style scoped lang="scss">
  .art-message-detail {
    .detail-header {
      .detail-tags {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 12px;
      }

      .detail-title {
        margin: 0;
        font-size: 22px;
        font-weight: 600;
        line-height: 1.45;
        text-align: center;
        color: var(--art-gray-900);
        word-break: break-all;
      }

      .detail-subtitle {
        margin: 8px 0 0;
        font-size: 14px;
        line-height: 1.6;
        text-align: center;
        color: var(--art-gray-500);
      }

      .detail-meta {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        font-size: 13px;
        line-height: 1.6;
        color: var(--art-gray-500);

        .detail-meta-dot {
          color: var(--art-gray-400);
        }
      }
    }

    /* 居中渐变小分割线：文章详情经典版式 */
    .detail-divider {
      width: 72px;
      height: 3px;
      margin: 20px auto 24px;
      border-radius: 2px;
      background: linear-gradient(90deg, var(--theme-color), var(--art-secondary));
      opacity: 0.85;
    }

    .detail-body {
      min-height: 80px;
      font-size: 15px;
      line-height: 1.9;
      color: var(--art-gray-800);

      .detail-plain {
        white-space: pre-wrap;
        word-break: break-word;
      }

      .detail-empty {
        padding: 32px 0;
        text-align: center;
        font-size: 13px;
        color: var(--art-gray-500);
      }
    }
  }

  /* 富文本正文文章排版（作用于 v-html 渲染的受信内容，需 :deep 穿透 scoped） */
  .detail-rich {
    word-break: break-word;

    :deep(p) {
      margin: 0 0 16px;
      line-height: 1.9;
    }

    :deep(img) {
      display: block;
      max-width: 100%;
      height: auto;
      margin: 0 auto 16px;
      border-radius: 8px;
      box-shadow: 0 2px 12px rgb(0 0 0 / 8%);
    }

    :deep(video) {
      display: block;
      max-width: 100%;
      margin: 0 auto 16px;
      border-radius: 8px;
      background: #000;
    }

    :deep(table) {
      width: 100%;
      margin: 0 0 16px;
      border-collapse: collapse;
      font-size: 14px;
    }

    :deep(td),
    :deep(th) {
      padding: 8px 12px;
      border: 1px solid var(--default-border);
      line-height: 1.6;
    }

    :deep(th) {
      background: var(--art-gray-100);
      font-weight: 600;
      text-align: left;
    }

    :deep(blockquote) {
      margin: 0 0 16px;
      padding: 12px 16px;
      border-left: 4px solid var(--theme-color);
      border-radius: 0 8px 8px 0;
      background: var(--art-gray-100);
      color: var(--art-gray-700);
    }

    :deep(blockquote p) {
      margin: 0;
    }

    :deep(pre) {
      margin: 0 0 16px;
      padding: 14px 16px;
      border-radius: 8px;
      background: var(--art-gray-200);
      color: var(--art-gray-900);
      font-size: 13px;
      line-height: 1.7;
      overflow-x: auto;
    }

    :deep(code) {
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--art-gray-200);
      color: var(--art-gray-900);
      font-size: 0.92em;
    }

    :deep(pre code) {
      padding: 0;
      background: transparent;
    }

    :deep(h2),
    :deep(h3),
    :deep(h4) {
      margin: 24px 0 12px;
      font-weight: 600;
      line-height: 1.5;
      color: var(--art-gray-900);
    }

    :deep(h2) {
      font-size: 18px;
    }

    :deep(h3) {
      font-size: 16px;
    }

    :deep(h4) {
      font-size: 15px;
    }

    :deep(a) {
      color: var(--theme-color);
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    :deep(ul),
    :deep(ol) {
      margin: 0 0 16px;
      padding-left: 1.6em;
    }

    :deep(li) {
      margin: 6px 0;
    }

    :deep(hr) {
      margin: 20px 0;
      border: none;
      border-top: 1px solid var(--default-border);
    }
  }
</style>
