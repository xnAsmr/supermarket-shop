<!-- WangEditor 富文本编辑器 插件地址：https://www.wangeditor.com/ -->
<template>
  <div class="editor-wrapper">
    <Toolbar
      class="editor-toolbar"
      :editor="editorRef"
      :mode="mode"
      :defaultConfig="toolbarConfig"
    />
    <Editor
      :style="{ height: height, overflowY: 'hidden' }"
      v-model="modelValue"
      :mode="mode"
      :defaultConfig="editorConfig"
      @onCreated="onCreateEditor"
    />
  </div>
</template>

<script setup lang="ts">
  import '@wangeditor/editor/dist/css/style.css'
  import { onBeforeUnmount, onMounted, shallowRef, computed } from 'vue'
  import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
  import { useUserStore } from '@/store/modules/user'
  import EmojiText from '@/utils/ui/emojo'
  import { IDomEditor, IToolbarConfig, IEditorConfig } from '@wangeditor/editor'
  import request from '@/utils/http'

  defineOptions({ name: 'ArtWangEditor' })

  type InsertFnType = (url: string, alt: string, href: string) => void

  const { VITE_API_URL } = import.meta.env

  // Props 定义
  interface Props {
    /** 编辑器高度 */
    height?: string
    /** 自定义工具栏配置 */
    toolbarKeys?: string[]
    /** 插入新工具到指定位置 */
    insertKeys?: { index: number; keys: string[] }
    /** 排除的工具栏项 */
    excludeKeys?: string[]
    /** 编辑器模式 */
    mode?: 'default' | 'simple'
    /** 占位符文本 */
    placeholder?: string
    /** 上传配置 */
    uploadConfig?: {
      maxFileSize?: number
      maxNumberOfFiles?: number
      server?: string
      // 是否开启自定义上传
      isCustomUpload?: boolean
    }
    /** 视频上传服务地址（默认 /api/v1/upload/wangeditor-video） */
    videoServer?: string
  }

  const props = withDefaults(defineProps<Props>(), {
    height: '500px',
    mode: 'default',
    placeholder: '请输入内容...',
    excludeKeys: () => ['fontFamily'],
    isCustomUpload: false
  })

  const modelValue = defineModel<string>({ required: true })

  // 编辑器实例
  const editorRef = shallowRef<IDomEditor>()
  const userStore = useUserStore()

  // 常量配置
  const DEFAULT_UPLOAD_CONFIG = {
    maxFileSize: 3 * 1024 * 1024, // 3MB
    maxNumberOfFiles: 10,
    fieldName: 'file',
    allowedFileTypes: ['image/*']
  } as const

  // 视频上传配置：公告/通知正文可嵌入视频，上限 100MB（与后端 multipart 限制一致）
  const DEFAULT_VIDEO_CONFIG = {
    maxFileSize: 100 * 1024 * 1024,
    fieldName: 'file',
    allowedFileTypes: ['video/*']
  } as const

  // 计算属性：上传服务器地址（VITE_API_URL 在开发环境为 '/'，需去掉尾部斜杠避免 //）
  const apiBase = computed(() => (VITE_API_URL || '').replace(/\/+$/, ''))
  const uploadServer = computed(
    () => props.uploadConfig?.server || `${apiBase.value}/api/v1/upload/wangeditor`
  )
  const videoServer = computed(() => props.videoServer || `${apiBase.value}/api/v1/upload/wangeditor-video`)

  /**
   * 上传请求头：后端 JWT 要求 Bearer 前缀。
   * 注意不能直接用 userStore.accessToken（裸 token 无前缀，会被 JWT 过滤器拒绝返回 401，
   * 表现为「图片上传失败」）——与 utils/http 的拦截逻辑保持一致
   */
  const authHeaders = computed(() => ({
    Authorization: userStore.accessToken.startsWith('Bearer ')
      ? userStore.accessToken
      : `Bearer ${userStore.accessToken}`
  }))

  // 合并上传配置
  const mergedUploadConfig = computed(() => ({
    ...DEFAULT_UPLOAD_CONFIG,
    ...props.uploadConfig
  }))

  // 工具栏配置
  const toolbarConfig = computed((): Partial<IToolbarConfig> => {
    const config: Partial<IToolbarConfig> = {}

    // 完全自定义工具栏
    if (props.toolbarKeys && props.toolbarKeys.length > 0) {
      config.toolbarKeys = props.toolbarKeys
    }

    // 插入新工具
    if (props.insertKeys) {
      config.insertKeys = props.insertKeys
    }

    // 排除工具
    if (props.excludeKeys && props.excludeKeys.length > 0) {
      config.excludeKeys = props.excludeKeys
    }

    return config
  })

  // 编辑器配置
  const editorConfig: Partial<IEditorConfig> = {
    placeholder: props.placeholder,
    MENU_CONF: {
      uploadImage: {
        fieldName: mergedUploadConfig.value.fieldName,
        maxFileSize: mergedUploadConfig.value.maxFileSize,
        maxNumberOfFiles: mergedUploadConfig.value.maxNumberOfFiles,
        allowedFileTypes: mergedUploadConfig.value.allowedFileTypes,
        server: uploadServer.value,
        headers: authHeaders.value,
        onSuccess() {
          ElMessage.success(`图片上传成功 ${EmojiText[200]}`)
        },
        onError(file: File, err: any, res: any) {
          console.error('图片上传失败:', err, res)
          ElMessage.error(`图片上传失败 ${EmojiText[500]}`)
        }
      },
      // 上传视频：必须配置 server + 请求头，否则工具栏「上传视频」按钮点击后无响应
      uploadVideo: {
        fieldName: DEFAULT_VIDEO_CONFIG.fieldName,
        maxFileSize: DEFAULT_VIDEO_CONFIG.maxFileSize,
        allowedFileTypes: DEFAULT_VIDEO_CONFIG.allowedFileTypes,
        server: videoServer.value,
        headers: authHeaders.value,
        onSuccess() {
          ElMessage.success(`视频上传成功 ${EmojiText[200]}`)
        },
        onError(file: File, err: any, res: any) {
          console.error('视频上传失败:', err, res)
          ElMessage.error(`视频上传失败 ${EmojiText[500]}`)
        }
      }
    }
  }

  // 自定义上传
  if (props.uploadConfig?.isCustomUpload && props.uploadConfig?.server && editorConfig.MENU_CONF) {
    editorConfig.MENU_CONF.uploadImage.customUpload = async (
      file: File,
      insertFn: InsertFnType
    ) => {
      try {
        const formData = new FormData()
        formData.append(mergedUploadConfig.value.fieldName, file)

        const response = await request.post<{ url: string; alt: string; href: string }>({
          url: props.uploadConfig?.server,
          data: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
            ...authHeaders.value
          }
        })

        // 兼容两种响应结构：裸 {url,alt,href} 与 wangEditor 约定的 {errno:0,data:{url,alt,href}}
        const payload = (response as any)?.data ?? response
        const { url, alt, href } = payload || {}

        if (!url) {
          throw new Error('上传失败，请检查服务端配置')
        }

        insertFn(url, alt || file.name, href || url)
        ElMessage.success(`图片上传成功 ${EmojiText[200]}`)
      } catch (error) {
        console.error('图片上传失败:', error)
        ElMessage.error(`图片上传失败 ${EmojiText[500]}`)
      }
    }
  }

  // 编辑器创建回调
  const onCreateEditor = (editor: IDomEditor) => {
    editorRef.value = editor

    // 监听全屏事件
    editor.on('fullScreen', () => {
      console.log('编辑器进入全屏模式')
    })

    // 确保在编辑器创建后应用自定义图标
    applyCustomIcons()
  }

  // 应用自定义图标（带重试机制）
  const applyCustomIcons = () => {
    let retryCount = 0
    const maxRetries = 10
    const retryDelay = 100

    const tryApplyIcons = () => {
      const editor = editorRef.value
      if (!editor) {
        if (retryCount < maxRetries) {
          retryCount++
          setTimeout(tryApplyIcons, retryDelay)
        }
        return
      }

      // 获取当前编辑器的工具栏容器
      const editorContainer = editor.getEditableContainer().closest('.editor-wrapper')
      if (!editorContainer) {
        if (retryCount < maxRetries) {
          retryCount++
          setTimeout(tryApplyIcons, retryDelay)
        }
        return
      }

      const toolbar = editorContainer.querySelector('.w-e-toolbar')
      const toolbarButtons = editorContainer.querySelectorAll('.w-e-bar-item button[data-menu-key]')

      if (toolbar && toolbarButtons.length > 0) {
        return
      }

      // 如果工具栏还没渲染完成，继续重试
      if (retryCount < maxRetries) {
        retryCount++
        setTimeout(tryApplyIcons, retryDelay)
      } else {
        console.warn('工具栏渲染超时，无法应用自定义图标 - 编辑器实例:', editor.id)
      }
    }

    // 使用 requestAnimationFrame 确保在下一帧执行
    requestAnimationFrame(tryApplyIcons)
  }

  // 暴露编辑器实例和方法
  defineExpose({
    /** 获取编辑器实例 */
    getEditor: () => editorRef.value,
    /** 设置编辑器内容 */
    setHtml: (html: string) => editorRef.value?.setHtml(html),
    /** 获取编辑器内容 */
    getHtml: () => editorRef.value?.getHtml(),
    /** 清空编辑器 */
    clear: () => editorRef.value?.clear(),
    /** 聚焦编辑器 */
    focus: () => editorRef.value?.focus()
  })

  // 生命周期
  onMounted(() => {
    // 图标替换已在 onCreateEditor 中处理
  })

  onBeforeUnmount(() => {
    const editor = editorRef.value
    if (editor) {
      editor.destroy()
    }
  })
</script>

<style lang="scss">
  @use './style';
</style>
