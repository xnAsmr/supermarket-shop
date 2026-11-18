<!-- 留言区（公告/通知详情内嵌）
     两种语义由 targetType 决定，交互与文案随之后端 scope 走：
     - ANNOUNCEMENT：私密反馈（工单式），仅「我 + 平台」可见，展示待处理/已回复/已关闭状态
     - NOTICE：公告内公开留言，可见范围继承通知定向范围，支持一层回复、@ 提醒应读同事
     管理员可通过 canManage 打开置顶/屏蔽入口（需后端 notify:notice:comment:manage 权限兜底）。
     打开即上报已读水位，用于清除消息中心列表行的「N 条新留言」红点。 -->
<template>
  <div class="art-message-thread">
    <div class="thread-header">
      <div class="thread-header-main">
        <span class="thread-title">{{ isPrivate ? '我的反馈' : '留言讨论' }}</span>
        <ElTag v-if="total" size="small" effect="plain" round>{{ total }} 条</ElTag>
      </div>
      <span class="thread-tip">
        {{ isPrivate ? '仅你与平台可见，平台回复后会提醒你' : '本公告可见范围内的同事都能看到' }}
      </span>
    </div>

    <div v-loading="loading" class="thread-list">
      <div v-if="!groups.length && !loading" class="thread-empty">
        {{ isPrivate ? '还没有反馈，遇到问题可以直接向平台提问' : '还没有人留言，来说两句吧' }}
      </div>

      <div v-for="group in groups" :key="group.root.id" class="thread-item">
        <div class="msg" :class="{ mine: isMine(group.root) }">
          <div class="msg-meta">
            <span class="msg-author">{{ authorLabel(group.root) }}</span>
            <ElTag
              v-if="isPrivate && group.root.threadStatus"
              size="small"
              effect="plain"
              :type="statusMeta(group.root.threadStatus).type"
            >
              {{ statusMeta(group.root.threadStatus).text }}
            </ElTag>
            <span v-if="group.root.pinned" class="pin-flag">置顶</span>
            <span v-for="name in group.root.mentionedNames || []" :key="name" class="mention-chip"
              >@{{ name }}</span
            >
            <span class="msg-time">{{ group.root.createTime }}</span>
          </div>
          <div class="msg-bubble">{{ group.root.content }}</div>

          <div class="msg-actions">
            <ElButton
              v-if="group.root.canWithdraw"
              link
              size="small"
              @click="handleWithdraw(group.root)"
            >
              撤回
            </ElButton>
            <ElButton v-if="!isPrivate" link size="small" @click="openReply(group.root)"
              >回复</ElButton
            >
            <ElButton
              v-if="canManage && !isPrivate"
              link
              size="small"
              type="primary"
              @click="handlePin(group.root)"
            >
              {{ group.root.pinned ? '取消置顶' : '置顶' }}
            </ElButton>
            <ElButton
              v-if="canManage && !isPrivate"
              link
              size="small"
              type="danger"
              @click="handleHide(group.root)"
            >
              屏蔽
            </ElButton>
          </div>

          <div v-if="group.replies.length" class="reply-list">
            <div
              v-for="reply in group.replies"
              :key="reply.id"
              class="msg reply"
              :class="{ mine: isMine(reply), platform: isPlatform(reply) }"
            >
              <div class="msg-meta">
                <span class="msg-author">{{ authorLabel(reply) }}</span>
                <span v-for="name in reply.mentionedNames || []" :key="name" class="mention-chip"
                  >@{{ name }}</span
                >
                <span class="msg-time">{{ reply.createTime }}</span>
              </div>
              <div class="msg-bubble">{{ reply.content }}</div>
              <div class="msg-actions">
                <ElButton v-if="reply.canWithdraw" link size="small" @click="handleWithdraw(reply)">
                  撤回
                </ElButton>
                <ElButton
                  v-if="canManage && !isPrivate"
                  link
                  size="small"
                  type="danger"
                  @click="handleHide(reply)"
                >
                  屏蔽
                </ElButton>
              </div>
            </div>
          </div>

          <div v-if="replyTargetId === String(group.root.id)" class="reply-editor">
            <div v-if="mentionOptions.length" class="mention-bar">
              <span class="mention-label">@ 提醒</span>
              <ElSelect
                v-model="mentionIds"
                multiple
                filterable
                collapse-tags
                collapse-tags-tooltip
                size="small"
                class="mention-select"
                placeholder="选择要提醒的同事"
              >
                <ElOption
                  v-for="opt in mentionOptions"
                  :key="opt.id"
                  :label="opt.name"
                  :value="opt.id"
                />
              </ElSelect>
            </div>
            <ElInput
              v-model="replyDraft"
              type="textarea"
              :rows="2"
              maxlength="1000"
              show-word-limit
              :placeholder="`回复 ${group.root.userName || '该留言'}`"
            />
            <div class="editor-actions">
              <ElButton size="small" @click="cancelReply">取消</ElButton>
              <ElButton
                size="small"
                type="primary"
                :loading="sending"
                :disabled="!replyDraft.trim()"
                @click="submitReply(group.root)"
              >
                回复
              </ElButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="thread-editor">
      <div v-if="mentionOptions.length" class="mention-bar">
        <span class="mention-label">@ 提醒</span>
        <ElSelect
          v-model="mentionIds"
          multiple
          filterable
          collapse-tags
          collapse-tags-tooltip
          size="small"
          class="mention-select"
          placeholder="选择要提醒的同事（会收到事件提醒）"
        >
          <ElOption v-for="opt in mentionOptions" :key="opt.id" :label="opt.name" :value="opt.id" />
        </ElSelect>
      </div>
      <ElInput
        v-model="draft"
        type="textarea"
        :rows="2"
        maxlength="1000"
        show-word-limit
        :placeholder="isPrivate ? '向平台反馈问题或建议…' : '发表留言，参与讨论…'"
      />
      <div class="editor-actions">
        <span class="editor-tip">纯文本，1000 字以内</span>
        <ElButton
          type="primary"
          size="small"
          :loading="sending"
          :disabled="!draft.trim()"
          @click="submit"
        >
          {{ isPrivate ? '提交反馈' : '发表留言' }}
        </ElButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref, watch } from 'vue'
  import { ElMessage, ElMessageBox } from 'element-plus'
  import {
    createMessage,
    fetchMentionCandidates,
    fetchMessages,
    hideNoticeComment,
    markMessagesRead,
    pinNoticeComment,
    withdrawMessage
  } from '@/api/notify-message'

  defineOptions({ name: 'ArtMessageThread' })

  const props = withDefaults(
    defineProps<{
      targetType: 'ANNOUNCEMENT' | 'NOTICE'
      targetId: string
      /** 是否展示管理员操作（屏蔽留言），权限由后端按钮权限兜底 */
      canManage?: boolean
    }>(),
    { canManage: false }
  )

  const emit = defineEmits<{ (e: 'changed'): void; (e: 'read'): void }>()

  const loading = ref(false)
  const sending = ref(false)
  const messages = ref<Api.Notify.MessageItem[]>([])
  const draft = ref('')
  const replyTargetId = ref('')
  const replyDraft = ref('')
  /** 可 @ 的人（仅租户通知；平台公告是「我 ↔ 平台」一对一，不提供 @） */
  const mentionOptions = ref<Api.Notify.NotifyOption[]>([])
  const mentionIds = ref<string[]>([])

  const isPrivate = computed(() => props.targetType === 'ANNOUNCEMENT')
  const total = computed(() => messages.value.length)

  /** 按顶层留言分组（后端保证最多一层回复，回复统一挂到顶层） */
  const groups = computed(() => {
    const replyMap = new Map<string, Api.Notify.MessageItem[]>()
    const roots: Api.Notify.MessageItem[] = []
    messages.value.forEach((item) => {
      const parentId = String(item.parentId ?? '0')
      if (parentId === '0') {
        roots.push(item)
      } else {
        const list = replyMap.get(parentId) || []
        list.push(item)
        replyMap.set(parentId, list)
      }
    })
    return roots.map((root) => ({
      root,
      replies: replyMap.get(String(root.id)) || []
    }))
  })

  const isMine = (item: Api.Notify.MessageItem) => Boolean(item.mine)
  const isPlatform = (item: Api.Notify.MessageItem) => item.authorType === 2

  const authorLabel = (item: Api.Notify.MessageItem) => {
    if (isPlatform(item)) return item.userName || '平台'
    return isMine(item) ? '我' : item.userName || '同事'
  }

  /** 工单状态文案与配色（仅平台公告私密反馈使用） */
  const statusMeta = (status?: string): { text: string; type: 'warning' | 'success' | 'info' } => {
    if (status === 'REPLIED') return { text: '平台已回复', type: 'success' }
    if (status === 'CLOSED') return { text: '已关闭', type: 'info' }
    return { text: '待平台处理', type: 'warning' }
  }

  const load = async () => {
    if (!props.targetId) {
      messages.value = []
      return
    }
    loading.value = true
    try {
      messages.value = (await fetchMessages(props.targetType, props.targetId)) || []
    } catch (e: any) {
      ElMessage.error(e?.message || '留言加载失败')
      return
    } finally {
      loading.value = false
    }
    await markRead()
  }

  /** 打开留言区即推进已读水位；失败静默，红点清不掉也不该阻断阅读 */
  const markRead = async () => {
    try {
      await markMessagesRead(props.targetType, props.targetId)
      emit('read')
    } catch {
      /* 忽略 */
    }
  }

  /** @ 候选人员：只有「本条通知的应读用户」，拉取失败不影响留言本身 */
  const loadMentionOptions = async () => {
    if (isPrivate.value || !props.targetId) {
      mentionOptions.value = []
      mentionIds.value = []
      return
    }
    try {
      mentionOptions.value = (await fetchMentionCandidates(props.targetId)) || []
    } catch {
      mentionOptions.value = []
    }
  }

  const submit = async () => {
    const content = draft.value.trim()
    if (!content) return
    sending.value = true
    try {
      await createMessage({
        targetType: props.targetType,
        targetId: props.targetId,
        content,
        mentionedUserIds: isPrivate.value ? undefined : mentionIds.value
      })
      draft.value = ''
      mentionIds.value = []
      ElMessage.success(isPrivate.value ? '已提交，平台会尽快回复' : '留言已发表')
      await load()
      emit('changed')
    } catch (e: any) {
      ElMessage.error(e?.message || '发表失败')
    } finally {
      sending.value = false
    }
  }

  const openReply = (root: Api.Notify.MessageItem) => {
    replyTargetId.value = String(root.id)
    replyDraft.value = ''
  }
  const cancelReply = () => {
    replyTargetId.value = ''
    replyDraft.value = ''
  }

  const submitReply = async (root: Api.Notify.MessageItem) => {
    const content = replyDraft.value.trim()
    if (!content) return
    sending.value = true
    try {
      await createMessage({
        targetType: props.targetType,
        targetId: props.targetId,
        parentId: String(root.id),
        content,
        mentionedUserIds: isPrivate.value ? undefined : mentionIds.value
      })
      cancelReply()
      mentionIds.value = []
      ElMessage.success('回复成功')
      await load()
      emit('changed')
    } catch (e: any) {
      ElMessage.error(e?.message || '回复失败')
    } finally {
      sending.value = false
    }
  }

  const handleWithdraw = async (item: Api.Notify.MessageItem) => {
    try {
      await ElMessageBox.confirm('确认撤回这条留言？撤回后其他人将看不到。', '提示', {
        type: 'warning'
      })
      await withdrawMessage(String(item.id))
      ElMessage.success('已撤回')
      await load()
      emit('changed')
    } catch (e: any) {
      if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
    }
  }

  /** 置顶/取消置顶（仅租户通知顶层留言；单条通知最多置顶 3 条，由后端兜底） */
  const handlePin = async (item: Api.Notify.MessageItem) => {
    const next = !item.pinned
    try {
      await pinNoticeComment(String(item.id), next)
      ElMessage.success(next ? '已置顶' : '已取消置顶')
      await load()
      emit('changed')
    } catch (e: any) {
      ElMessage.error(e?.message || '操作失败')
    }
  }

  const handleHide = async (item: Api.Notify.MessageItem) => {
    try {
      await ElMessageBox.confirm('确认屏蔽这条留言？屏蔽后其他同事将看不到。', '提示', {
        type: 'warning'
      })
      await hideNoticeComment(String(item.id))
      ElMessage.success('已屏蔽')
      await load()
      emit('changed')
    } catch (e: any) {
      if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
    }
  }

  watch(
    () => [props.targetType, props.targetId],
    () => {
      draft.value = ''
      mentionIds.value = []
      cancelReply()
      void loadMentionOptions()
      void load()
    }
  )

  onMounted(() => {
    void loadMentionOptions()
    void load()
  })
</script>

<style scoped lang="scss">
  .art-message-thread {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px dashed var(--default-border);

    .thread-header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;

      .thread-header-main {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .thread-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--art-gray-900);
      }

      .thread-tip {
        font-size: 12px;
        color: var(--art-gray-500);
      }
    }

    .thread-list {
      max-height: 320px;
      overflow-y: auto;
      padding-right: 4px;

      .thread-empty {
        padding: 24px 0;
        text-align: center;
        font-size: 13px;
        color: var(--art-gray-500);
      }
    }

    .thread-item + .thread-item {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--art-gray-200);
    }

    .msg {
      .msg-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
        font-size: 12px;
        color: var(--art-gray-500);
      }

      .msg-author {
        font-weight: 600;
        color: var(--art-gray-700);
      }

      /* 置顶标识：与留言内容区分开，避免误认为系统留言 */
      .pin-flag {
        padding: 0 6px;
        border-radius: 4px;
        background: color-mix(in srgb, var(--theme-color) 14%, transparent);
        color: var(--theme-color);
        font-size: 11px;
        line-height: 18px;
      }

      .mention-chip {
        color: var(--theme-color);
        font-size: 12px;
      }

      .msg-bubble {
        padding: 10px 12px;
        border-radius: 10px;
        background: var(--art-gray-100);
        font-size: 13px;
        line-height: 1.7;
        color: var(--art-gray-800);
        white-space: pre-wrap;
        word-break: break-word;
      }

      &.mine .msg-bubble {
        background: color-mix(in srgb, var(--theme-color) 12%, transparent);
      }

      &.platform .msg-bubble {
        background: color-mix(in srgb, var(--art-gray-300) 45%, transparent);
      }

      .msg-actions {
        display: flex;
        gap: 4px;
        margin-top: 2px;
        min-height: 24px;
      }
    }

    .reply-list {
      margin: 8px 0 0 16px;
      padding-left: 10px;
      border-left: 2px solid var(--art-gray-200);

      .msg + .msg {
        margin-top: 10px;
      }
    }

    .reply-editor,
    .thread-editor {
      margin-top: 10px;

      .mention-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;

        .mention-label {
          flex-shrink: 0;
          font-size: 12px;
          color: var(--art-gray-500);
        }

        .mention-select {
          flex: 1;
          min-width: 0;
        }
      }

      .editor-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
      }

      .editor-tip {
        font-size: 12px;
        color: var(--art-gray-500);
      }
    }
  }
</style>
