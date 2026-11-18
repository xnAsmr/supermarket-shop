<template>
  <div class="help-center">
    <div v-if="!docsUrl" class="help-empty">
      <ArtSvgIcon icon="ri:book-2-line" class="help-empty__icon" />
      <p class="help-empty__title">帮助中心未配置</p>
      <p class="help-empty__desc">
        请在环境变量 <code>VITE_HELP_DOCS_URL</code> 中配置知识库站点地址（如
        <code>http://localhost:5173</code>）。
      </p>
    </div>

    <div v-else class="help-iframe-wrap" v-loading="loading" element-loading-text="知识库加载中…">
      <iframe
        ref="iframeRef"
        :src="docsUrl"
        frameborder="0"
        class="help-iframe"
        @load="handleLoad"
      ></iframe>
    </div>
  </div>
</template>

<script setup lang="ts">
  defineOptions({ name: 'HelpCenter' })

  // 知识库站点地址：优先取环境变量，未配置时回退到本地文档站默认端口
  const docsUrl = import.meta.env.VITE_HELP_DOCS_URL || 'http://localhost:5173'

  const loading = ref(true)
  const iframeRef = ref<HTMLIFrameElement | null>(null)

  /**
   * iframe 加载完成，关闭加载态
   */
  const handleLoad = (): void => {
    loading.value = false
  }
</script>

<style lang="scss" scoped>
  .help-center {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
  }

  .help-iframe-wrap {
    width: 100%;
    height: 100%;
    min-height: calc(100vh - 180px);
    background: var(--art-bg-color);
  }

  .help-iframe {
    display: block;
    width: 100%;
    height: 100%;
    min-height: calc(100vh - 180px);
    border: none;
  }

  .help-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: calc(100vh - 180px);
    text-align: center;
    color: var(--art-text-muted-color);

    &__icon {
      font-size: 48px;
      margin-bottom: 12px;
      color: var(--art-primary);
    }

    &__title {
      margin: 0 0 8px;
      font-size: 16px;
      font-weight: 600;
      color: var(--art-text-color);
    }

    &__desc {
      margin: 0;
      max-width: 460px;
      line-height: 1.6;
      font-size: 13px;

      code {
        padding: 1px 6px;
        border-radius: 4px;
        background: var(--art-hover-color);
        color: var(--art-primary);
        font-size: 12px;
      }
    }
  }
</style>
