<!-- 平台公告管理（超管） -->
<template>
  <div class="platform-announcement-page art-full-height">
    <ArtSearchBar
      ref="searchBarRef"
      v-model="searchForm"
      :items="formItems"
      @reset="handleReset"
      @search="handleSearch"
    />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton type="primary" v-ripple @click="showDialog('add')">新增公告</ElButton>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      />
    </ElCard>

    <!-- 新增/编辑弹窗 -->
    <ElDialog
      v-model="dialogVisible"
      :title="dialogType === 'add' ? '新增公告' : '编辑公告'"
      width="640px"
      append-to-body
    >
      <ElForm ref="formRef" :model="form" :rules="rules" label-width="96px">
        <ElFormItem label="标题" prop="title">
          <ElInput
            v-model="form.title"
            placeholder="请输入公告标题"
            maxlength="60"
            show-word-limit
          />
        </ElFormItem>
        <ElFormItem label="类型" prop="noticeType">
          <ElSelect v-model="form.noticeType" placeholder="请选择类型" style="width: 100%">
            <ElOption :value="1" label="功能更新" />
            <ElOption :value="2" label="系统维护" />
            <ElOption :value="3" label="规则变更" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="定向范围" prop="targetScope">
          <ElRadioGroup v-model="form.targetScope">
            <ElRadio value="ALL">全部租户</ElRadio>
            <ElRadio value="PLAN">按套餐</ElRadio>
            <ElRadio value="ASSIGN">指定租户</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem label="仅系统管理员">
          <!-- 用独立布尔字段承接开关，提交时再映射为 targetUserType=2/undefined。
               不可直接 v-model="form.targetUserType" + active/inactive-value：
               ElSwitch 挂载时若模型值不在 [active,inactive] 内会立即纠偏发射 inactiveValue，
               而 :inactive-value="undefined" 会被 Vue 视为未传而取默认 false，
               导致布尔 false 流入后端 Integer 字段报反序列化错误 -->
          <ElSwitch v-model="form.targetUserAdminOnly" />
          <span class="ml-2 text-xs text-g-500">
            开启后仅发给目标范围内「用户类型=系统管理员」；默认该范围内全部用户
          </span>
        </ElFormItem>
        <ElFormItem v-if="form.targetScope === 'PLAN'" label="目标套餐" prop="targetPlanType">
          <ElSelect v-model="form.targetPlanType" placeholder="请选择套餐" style="width: 100%">
            <ElOption
              v-for="p in planTypeOptions"
              :key="p.value"
              :value="p.value"
              :label="p.label"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="form.targetScope === 'ASSIGN'" label="指定租户" prop="targetTenantIds">
          <ElSelect
            v-model="form.targetTenantIds"
            multiple
            filterable
            placeholder="请选择租户"
            style="width: 100%"
          >
            <ElOption v-for="t in tenantOptions" :key="t.id" :value="t.id" :label="t.name" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="生效时间" prop="effectiveAt">
          <ElDatePicker
            v-model="form.effectiveAt"
            type="datetime"
            placeholder="不选则立即生效"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="失效时间" prop="expireAt">
          <ElDatePicker
            v-model="form.expireAt"
            type="datetime"
            placeholder="可选，留空长期有效"
            format="YYYY-MM-DD HH:mm:ss"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%"
          />
        </ElFormItem>
        <ElFormItem label="强制确认" prop="requireAck">
          <ElSwitch v-model="form.requireAck" />
          <span class="ml-2 text-xs text-g-500">开启后，租户用户需点击「我已知晓」确认</span>
        </ElFormItem>
        <ElFormItem label="内容" prop="content">
          <ArtWangEditor
            v-model="form.content"
            height="220px"
            placeholder="请输入公告正文（支持图片、表格、列表等富文本格式）"
            :exclude-keys="[]"
            :upload-config="{ server: '/api/v1/upload/wangeditor' }"
          />
        </ElFormItem>
        <ElFormItem v-if="dialogType === 'add'" label="发布方式">
          <ElSwitch v-model="form.publishNow" />
          <span class="ml-2 text-xs text-g-500">开启则保存后立即发布，否则存为草稿</span>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="dialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="submitting" @click="submitForm">保存</ElButton>
      </template>
    </ElDialog>

    <!-- 已读统计弹窗 -->
    <ElDialog v-model="statsVisible" title="已读/确认统计" width="720px" append-to-body>
      <div v-if="stats?.targetUserType === 2" class="mb-3 text-xs text-g-500">
        本公告仅定向「系统管理员」，下列统计仅覆盖该部分用户。
      </div>
      <div v-if="stats" class="stats-summary flex gap-4 mb-4">
        <div class="stats-box">
          <div class="stats-label">覆盖用户</div>
          <div class="stats-num">{{ stats.userCount }}</div>
        </div>
        <div class="stats-box">
          <div class="stats-label">已读</div>
          <div class="stats-num text-success">{{ stats.readCount }}</div>
        </div>
        <div class="stats-box">
          <div class="stats-label">{{ stats.requireAck ? '已确认' : '已读率' }}</div>
          <div class="stats-num text-theme">
            {{ stats.requireAck ? stats.ackCount : rate(stats.readCount, stats.userCount) }}
          </div>
        </div>
      </div>
      <ArtTable :data="stats?.tenants || []" :columns="statsColumns" />
    </ElDialog>

    <!-- 反馈处理抽屉（平台公告私密反馈：一条顶层留言 = 一个工单） -->
    <ElDrawer v-model="feedbackVisible" title="反馈处理" size="760px" append-to-body>
      <div class="feedback-layout">
        <div v-loading="loadingThreads" class="feedback-list">
          <div v-if="!feedbackThreads.length && !loadingThreads" class="feedback-empty">
            该公告还没有收到反馈
          </div>
          <div
            v-for="thread in feedbackThreads"
            :key="thread.id"
            class="feedback-item"
            :class="{ active: currentThread && String(currentThread.id) === String(thread.id) }"
            @click="openThread(thread)"
          >
            <div class="feedback-item-head">
              <span class="feedback-user">
                {{ thread.tenantName || '未知租户' }} · {{ thread.userName || '用户' }}
              </span>
              <ElTag size="small" effect="plain" :type="threadStatusMeta(thread.threadStatus).type">
                {{ threadStatusMeta(thread.threadStatus).text }}
              </ElTag>
            </div>
            <div class="feedback-item-content">{{ thread.content }}</div>
            <div class="feedback-item-meta">
              {{ thread.createTime }}
              <span v-if="thread.messageCount > 1"> · {{ thread.messageCount }} 条往来</span>
            </div>
          </div>
        </div>

        <div class="feedback-detail">
          <template v-if="currentThread">
            <div class="feedback-detail-head">
              <span class="feedback-detail-title">
                {{ currentThread.tenantName || '未知租户' }} ·
                {{ currentThread.userName || '用户' }}
              </span>
              <ElButton
                v-if="currentThread.threadStatus !== 'CLOSED'"
                size="small"
                @click="closeThread"
              >
                关闭工单
              </ElButton>
              <ElTag v-else size="small" type="info" effect="plain">已关闭</ElTag>
            </div>

            <div class="feedback-messages">
              <div
                v-for="msg in currentThread.messages || []"
                :key="msg.id"
                class="feedback-msg"
                :class="{ platform: msg.authorType === 2 }"
              >
                <div class="feedback-msg-meta">
                  <span class="feedback-msg-author">
                    {{
                      msg.authorType === 2
                        ? '平台 · ' + (msg.userName || '客服')
                        : msg.userName || '用户'
                    }}
                  </span>
                  <span>{{ msg.createTime }}</span>
                </div>
                <div class="feedback-msg-bubble">{{ msg.content }}</div>
              </div>
            </div>

            <div v-if="currentThread.threadStatus !== 'CLOSED'" class="feedback-reply">
              <ElInput
                v-model="replyContent"
                type="textarea"
                :rows="3"
                maxlength="1000"
                show-word-limit
                placeholder="回复该反馈，提交后会向提问人推送事件提醒"
              />
              <div class="feedback-reply-actions">
                <ElButton
                  type="primary"
                  size="small"
                  :loading="replying"
                  :disabled="!replyContent.trim()"
                  @click="submitReply"
                >
                  发送回复
                </ElButton>
              </div>
            </div>
            <ElAlert v-else type="info" :closable="false" title="工单已关闭，不可继续回复" />
          </template>
          <div v-else class="feedback-empty">选择左侧反馈查看往来记录</div>
        </div>
      </div>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchAnnouncementPage,
    saveAnnouncement,
    publishAnnouncement,
    withdrawAnnouncement,
    deleteAnnouncement,
    fetchAnnouncementStats,
    fetchTenantOptions
  } from '@/api/notify'
  import {
    closeFeedback,
    fetchFeedbackDetail,
    fetchFeedbackThreads,
    replyFeedback
  } from '@/api/notify-message'
  import { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'

  defineOptions({ name: 'PlatformAnnouncement' })

  type Row = Api.Notify.AnnouncementAdmin

  const router = useRouter()

  const searchBarRef = ref()
  const searchForm = ref({ keyword: undefined, status: undefined })
  const formItems = computed(() => [
    { label: '关键词', key: 'keyword', type: 'input', placeholder: '标题关键词', clearable: true },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      placeholder: '请选择状态',
      props: {
        clearable: true,
        options: [
          { label: '草稿', value: 0 },
          { label: '已发布', value: 1 },
          { label: '已撤回', value: 2 }
        ]
      }
    }
  ])

  const typeText = (t: number) => (t === 1 ? '功能更新' : t === 2 ? '系统维护' : '规则变更')
  const scopeText = (s: string) => (s === 'ALL' ? '全部租户' : s === 'PLAN' ? '按套餐' : '指定租户')
  const statusTag = (s: number): { type: 'success' | 'info' | 'warning'; text: string } =>
    s === 1
      ? { type: 'success', text: '已发布' }
      : s === 2
        ? { type: 'info', text: '已撤回' }
        : { type: 'warning', text: '草稿' }
  /** 反馈工单状态文案与配色 */
  const threadStatusMeta = (s?: string): { text: string; type: 'warning' | 'success' | 'info' } =>
    s === 'REPLIED'
      ? { text: '已回复', type: 'success' }
      : s === 'CLOSED'
        ? { text: '已关闭', type: 'info' }
        : { text: '待处理', type: 'warning' }
  const rate = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : '-')

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    getData,
    replaceSearchParams,
    resetSearchParams,
    handleSizeChange,
    handleCurrentChange,
    refreshData,
    refreshCreate,
    refreshUpdate,
    refreshRemove
  } = useTable({
    core: {
      apiFn: fetchAnnouncementPage,
      apiParams: { page: 1, pageSize: 10, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        {
          prop: 'title',
          label: '标题',
          minWidth: 180,
          showOverflowTooltip: true,
          formatter: (row: Row) =>
            h('span', { class: 'row-link', onClick: () => openDetail(row) }, row.title)
        },
        { prop: 'publisherName', label: '发布人', width: 110, showOverflowTooltip: true },
        {
          prop: 'noticeType',
          label: '类型',
          width: 100,
          formatter: (row: Row) => h(ElTag, { effect: 'plain' }, () => typeText(row.noticeType))
        },
        {
          prop: 'targetScope',
          label: '定向范围',
          width: 150,
          formatter: (row: Row) =>
            h('div', { class: 'flex-c gap-1' }, [
              h('span', null, scopeText(row.targetScope)),
              row.targetUserType === 2 &&
                h(ElTag, { type: 'warning', effect: 'plain', size: 'small' }, () => '仅管理员')
            ])
        },
        {
          prop: 'effectiveAt',
          label: '生效时间',
          width: 170,
          formatter: (row: Row) => row.effectiveAt || '立即'
        },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: Row) => {
            const s = statusTag(row.status)
            return h(ElTag, { type: s.type, effect: 'plain' }, () => s.text)
          }
        },
        { prop: 'readCount', label: '已读', width: 80, align: 'right' },
        { prop: 'ackCount', label: '确认', width: 80, align: 'right' },
        {
          prop: 'feedbackCount',
          label: '反馈',
          width: 110,
          align: 'center',
          formatter: (row: Row) => {
            const total = row.feedbackCount ?? 0
            const pending = row.pendingFeedbackCount ?? 0
            if (!total) return h('span', { class: 'text-g-400' }, '—')
            return h(
              'span',
              { class: 'row-link', onClick: () => openFeedbacks(row) },
              pending > 0 ? `待处理 ${pending}/${total}` : `反馈 ${total}`
            )
          }
        },
        { prop: 'createTime', label: '创建时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 90,
          fixed: 'right',
          formatter: (row: Row) =>
            h('div', [
              h(ArtButtonMore, {
                list: [
                  {
                    key: 'detail',
                    label: '详情',
                    icon: 'ri:eye-line'
                  },
                  {
                    key: 'edit',
                    label: '编辑',
                    icon: 'ri:edit-2-line'
                  },
                  row.status !== 1 && {
                    key: 'publish',
                    label: row.status === 2 ? '重新发布' : '发布',
                    icon: row.status === 2 ? 'ri:refresh-line' : 'ri:send-plane-line'
                  },
                  row.status === 1 && {
                    key: 'withdraw',
                    label: '撤回',
                    icon: 'ri:arrow-go-back-line'
                  },
                  {
                    key: 'feedback',
                    label: '反馈处理',
                    icon: 'ri:chat-quote-line'
                  },
                  {
                    key: 'stats',
                    label: '已读统计',
                    icon: 'ri:bar-chart-2-line'
                  },
                  {
                    key: 'delete',
                    label: '删除',
                    icon: 'ri:delete-bin-4-line',
                    color: '#f56c6c'
                  }
                ].filter(Boolean) as ButtonMoreItem[],
                onClick: (item: ButtonMoreItem) => buttonMoreClick(item, row)
              })
            ])
        }
      ]
    }
  })

  const statsColumns = [
    { prop: 'tenantName', label: '租户', minWidth: 160 },
    { prop: 'userCount', label: '用户数', width: 90, align: 'right' },
    { prop: 'readCount', label: '已读', width: 90, align: 'right' },
    { prop: 'ackCount', label: '确认', width: 90, align: 'right' }
  ]

  /* ------------------------------ 弹窗表单 ------------------------------ */
  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const submitting = ref(false)
  const formRef = ref<FormInstance>()
  const tenantOptions = ref<Api.Notify.NotifyOption[]>([])
  const planTypeOptions = ref<{ value: number; label: string }[]>([])

  const baseForm = () => ({
    id: '',
    title: '',
    content: '',
    noticeType: 1 as 1 | 2 | 3,
    targetScope: 'ALL' as 'ALL' | 'PLAN' | 'ASSIGN',
    targetPlanType: undefined as number | undefined,
    targetTenantIds: [] as string[],
    effectiveAt: '',
    expireAt: '',
    requireAck: false,
    targetUserAdminOnly: false,
    publishNow: true
  })
  const form = reactive(baseForm())

  const rules: FormRules = {
    title: [{ required: true, message: '请输入标题', trigger: 'blur' }],
    content: [
      {
        validator: (_rule, value, cb) => {
          // 富文本内容：去除 HTML 标签后无实质文本即视为空
          const text = (value || '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim()
          if (!text) cb(new Error('请输入正文'))
          else cb()
        },
        trigger: 'change'
      }
    ],
    targetPlanType: [
      {
        validator: (_rule, value, cb) => {
          if (form.targetScope === 'PLAN' && !value) cb(new Error('请选择套餐'))
          else cb()
        },
        trigger: 'change'
      }
    ]
  }

  const showDialog = (type: 'add' | 'edit', row?: Row) => {
    dialogType.value = type
    Object.assign(form, baseForm())
    if (row) {
      form.id = row.id
      form.title = row.title
      form.content = row.content
      form.noticeType = row.noticeType
      form.targetScope = row.targetScope
      form.targetPlanType = row.targetPlanType
      form.targetTenantIds = row.targetTenantIds ? row.targetTenantIds.split(',') : []
      form.effectiveAt = row.effectiveAt
      form.expireAt = row.expireAt
      form.requireAck = row.requireAck
      form.targetUserAdminOnly = row.targetUserType === 2
    }
    dialogVisible.value = true
  }

  const submitForm = async () => {
    if (!formRef.value) return
    await formRef.value.validate(async (valid) => {
      if (!valid) return
      submitting.value = true
      try {
        await saveAnnouncement({
          id: form.id || undefined,
          title: form.title,
          content: form.content,
          noticeType: form.noticeType,
          targetScope: form.targetScope,
          targetPlanType: form.targetPlanType,
          targetTenantIds: form.targetTenantIds.join(','),
          effectiveAt: form.effectiveAt,
          expireAt: form.expireAt || undefined,
          requireAck: form.requireAck,
          targetUserType: form.targetUserAdminOnly ? 2 : undefined,
          publishNow: dialogType.value === 'add' ? form.publishNow : false
        })
        ElMessage.success('保存成功')
        dialogVisible.value = false
        if (dialogType.value === 'add') refreshCreate()
        else refreshUpdate()
      } catch (e: any) {
        ElMessage.error(e?.message || '保存失败')
      } finally {
        submitting.value = false
      }
    })
  }

  /* ------------------------------ 操作 ------------------------------ */
  /** 富文本内容变化时同步表单校验状态（清掉空内容错误态） */
  watch(
    () => form.content,
    () => formRef.value?.validateField('content').catch(() => {})
  )

  /** 操作列三点菜单 */
  const buttonMoreClick = (item: ButtonMoreItem, row: Row) => {
    switch (item.key) {
      case 'detail':
        openDetail(row)
        break
      case 'edit':
        showDialog('edit', row)
        break
      case 'publish':
        publish(row)
        break
      case 'withdraw':
        withdraw(row)
        break
      case 'stats':
        openStats(row)
        break
      case 'feedback':
        openFeedbacks(row)
        break
      case 'delete':
        remove(row)
        break
    }
  }

  const publish = async (row: Row) => {
    try {
      await publishAnnouncement(row.id)
      ElMessage.success('已发布')
      refreshUpdate()
    } catch (e: any) {
      ElMessage.error(e?.message || '操作失败')
    }
  }
  const withdraw = async (row: Row) => {
    try {
      await withdrawAnnouncement(row.id)
      ElMessage.success('已撤回')
      refreshUpdate()
    } catch (e: any) {
      ElMessage.error(e?.message || '操作失败')
    }
  }
  const remove = async (row: Row) => {
    try {
      await ElMessageBox.confirm(`确认删除公告「${row.title}」？`, '提示', { type: 'warning' })
      await deleteAnnouncement(row.id)
      ElMessage.success('已删除')
      refreshRemove()
    } catch (e: any) {
      if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
    }
  }

  /* ------------------------------ 统计 ------------------------------ */
  const statsVisible = ref(false)
  const stats = ref<Api.Notify.AnnouncementStats | null>(null)
  const openStats = async (row: Row) => {
    try {
      stats.value = await fetchAnnouncementStats(row.id)
      statsVisible.value = true
    } catch (e: any) {
      ElMessage.error(e?.message || '获取统计失败')
    }
  }

  /* ------------------------------ 反馈处理 ------------------------------ */
  const feedbackVisible = ref(false)
  const loadingThreads = ref(false)
  const replying = ref(false)
  const feedbackRow = ref<Row | null>(null)
  const feedbackThreads = ref<Api.Notify.FeedbackThread[]>([])
  const currentThread = ref<Api.Notify.FeedbackThread | null>(null)
  const replyContent = ref('')

  const openFeedbacks = (row: Row) => {
    feedbackRow.value = row
    currentThread.value = null
    replyContent.value = ''
    feedbackThreads.value = []
    feedbackVisible.value = true
    void loadThreads()
  }

  const loadThreads = async () => {
    if (!feedbackRow.value) return
    loadingThreads.value = true
    try {
      feedbackThreads.value = await fetchFeedbackThreads(feedbackRow.value.id)
    } catch (e: any) {
      ElMessage.error(e?.message || '反馈列表加载失败')
    } finally {
      loadingThreads.value = false
    }
  }

  const openThread = async (thread: Api.Notify.FeedbackThread) => {
    if (!feedbackRow.value) return
    replyContent.value = ''
    try {
      currentThread.value = await fetchFeedbackDetail(feedbackRow.value.id, thread.id)
    } catch (e: any) {
      ElMessage.error(e?.message || '反馈详情加载失败')
    }
  }

  const submitReply = async () => {
    if (!feedbackRow.value || !currentThread.value) return
    const content = replyContent.value.trim()
    if (!content) return
    replying.value = true
    try {
      await replyFeedback(feedbackRow.value.id, currentThread.value.id, content)
      ElMessage.success('已回复，已提醒提问人')
      replyContent.value = ''
      currentThread.value = await fetchFeedbackDetail(feedbackRow.value.id, currentThread.value.id)
      await loadThreads()
      refreshUpdate()
    } catch (e: any) {
      ElMessage.error(e?.message || '回复失败')
    } finally {
      replying.value = false
    }
  }

  const closeThread = async () => {
    if (!feedbackRow.value || !currentThread.value) return
    try {
      await ElMessageBox.confirm('确认关闭该反馈工单？关闭后平台将无法继续回复。', '提示', {
        type: 'warning'
      })
      await closeFeedback(feedbackRow.value.id, currentThread.value.id)
      ElMessage.success('工单已关闭')
      currentThread.value = await fetchFeedbackDetail(feedbackRow.value.id, currentThread.value.id)
      await loadThreads()
      refreshUpdate()
    } catch (e: any) {
      if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
    }
  }

  /* ------------------------------ 详情 ------------------------------ */
  /** 打开详情整页（静态路由 + query，可直链/刷新；返回时列表状态由 history 保留） */
  const openDetail = (row: Row) => {
    router.push({ path: '/platform/announcement/detail', query: { id: row.id } })
  }

  const handleSearch = (params: any) => {
    replaceSearchParams(params)
    getData()
  }
  const handleReset = () => resetSearchParams()

  onMounted(async () => {
    try {
      tenantOptions.value = await fetchTenantOptions()
      const types = Array.from(
        new Set(tenantOptions.value.map((t) => t.planType).filter(Boolean))
      ) as number[]
      planTypeOptions.value = types
        .sort((a, b) => a - b)
        .map((v) => ({ value: v, label: `套餐${v}` }))
    } catch {
      /* 忽略 */
    }
  })
</script>

<style scoped>
  @reference '@styles/core/tailwind.css';

  .stats-box {
    flex: 1;
    padding: 14px 16px;
    border: 1px solid var(--art-card-border);
    border-radius: 10px;
    text-align: center;
  }

  .stats-label {
    font-size: 12px;
    color: var(--art-gray-500);
  }

  .stats-num {
    margin-top: 6px;
    font-size: 24px;
    font-weight: 600;
  }

  /* 标题列可点击（打开详情） */
  .row-link {
    color: var(--theme-color);
    cursor: pointer;
  }

  .row-link:hover {
    text-decoration: underline;
  }

  /* 反馈处理抽屉：左列表 + 右详情 */
  .feedback-layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 16px;
    height: 100%;
  }

  .feedback-list {
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    padding-right: 4px;
    border-right: 1px solid var(--default-border);
  }

  .feedback-item {
    padding: 10px 12px;
    margin-bottom: 8px;
    border: 1px solid var(--default-border);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;

    &.active,
    &:hover {
      border-color: var(--theme-color);
      background: color-mix(in srgb, var(--theme-color) 6%, transparent);
    }
  }

  .feedback-item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .feedback-user {
    font-size: 13px;
    font-weight: 600;
    color: var(--art-gray-900);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .feedback-item-content {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
    margin: 6px 0;
    font-size: 13px;
    line-height: 1.6;
    color: var(--art-gray-700);
    word-break: break-word;
  }

  .feedback-item-meta {
    font-size: 12px;
    color: var(--art-gray-500);
  }

  .feedback-detail {
    display: flex;
    flex-direction: column;
    min-height: 320px;
  }

  .feedback-detail-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--default-border);
  }

  .feedback-detail-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--art-gray-900);
  }

  .feedback-messages {
    flex: 1;
    max-height: calc(100vh - 320px);
    overflow-y: auto;
    padding: 12px 0;
  }

  .feedback-msg + .feedback-msg {
    margin-top: 12px;
  }

  .feedback-msg-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 12px;
    color: var(--art-gray-500);
  }

  .feedback-msg-author {
    font-weight: 600;
    color: var(--art-gray-700);
  }

  .feedback-msg-bubble {
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--art-gray-100);
    font-size: 13px;
    line-height: 1.7;
    color: var(--art-gray-800);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .feedback-msg.platform .feedback-msg-bubble {
    background: color-mix(in srgb, var(--theme-color) 10%, transparent);
  }

  .feedback-reply {
    margin-top: 8px;
    padding-top: 12px;
    border-top: 1px dashed var(--default-border);
  }

  .feedback-reply-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .feedback-empty {
    padding: 40px 0;
    text-align: center;
    font-size: 13px;
    color: var(--art-gray-500);
  }
</style>
