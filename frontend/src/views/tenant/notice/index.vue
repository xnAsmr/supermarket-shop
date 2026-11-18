<!-- 租户通知管理（管理员/店长） -->
<template>
  <div class="tenant-notice-page art-full-height">
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
            <ElButton type="primary" v-ripple @click="showSendDialog">发送通知</ElButton>
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

    <!-- 发送/编辑通知弹窗 -->
    <ElDialog
      v-model="sendVisible"
      :title="editingId ? '编辑通知' : '发送通知'"
      width="640px"
      append-to-body
    >
      <ElForm ref="sendFormRef" :model="sendForm" :rules="sendRules" label-width="96px">
        <ElFormItem label="标题" prop="title">
          <ElInput
            v-model="sendForm.title"
            placeholder="请输入通知标题"
            maxlength="60"
            show-word-limit
          />
        </ElFormItem>
        <ElFormItem label="类型" prop="noticeType">
          <ElSelect v-model="sendForm.noticeType" placeholder="请选择通知类型" style="width: 100%">
            <ElOption
              v-for="t in noticeTypeOptions"
              :key="t.value"
              :value="t.value"
              :label="t.label"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="正文" prop="content">
          <ArtWangEditor
            v-model="sendForm.content"
            height="220px"
            placeholder="请输入通知内容（支持图片、表格、列表等富文本格式）"
            :exclude-keys="[]"
            :upload-config="{ server: '/api/v1/upload/wangeditor' }"
          />
        </ElFormItem>
        <ElFormItem label="接收范围" prop="targetScope">
          <ElRadioGroup v-model="sendForm.targetScope" @change="onScopeChange">
            <ElRadio value="ALL">全员</ElRadio>
            <ElRadio value="STORE">指定门店</ElRadio>
            <ElRadio value="ROLE">指定角色</ElRadio>
            <ElRadio value="USER">指定人员</ElRadio>
          </ElRadioGroup>
        </ElFormItem>
        <ElFormItem v-if="sendForm.targetScope === 'STORE'" label="门店" prop="targetStoreIds">
          <ElSelect
            v-model="sendForm.targetStoreIds"
            multiple
            filterable
            placeholder="请选择门店"
            style="width: 100%"
          >
            <ElOption v-for="s in storeOptions" :key="s.id" :value="s.id" :label="s.name" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="sendForm.targetScope === 'ROLE'" label="角色" prop="targetRoleIds">
          <ElSelect
            v-model="sendForm.targetRoleIds"
            multiple
            filterable
            placeholder="请选择角色"
            style="width: 100%"
          >
            <ElOption v-for="r in roleOptions" :key="r.id" :value="r.id" :label="r.name" />
          </ElSelect>
        </ElFormItem>
        <ElFormItem v-if="sendForm.targetScope === 'USER'" label="人员" prop="targetUserIds">
          <ElSelect
            v-model="sendForm.targetUserIds"
            multiple
            filterable
            placeholder="请选择人员"
            style="width: 100%"
          >
            <ElOption v-for="u in userOptions" :key="u.id" :value="u.id" :label="u.name" />
          </ElSelect>
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton @click="sendVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="sending" @click="submitSend">{{
          editingId ? '保存' : '发送'
        }}</ElButton>
      </template>
    </ElDialog>

    <!-- 已读统计弹窗 -->
    <ElDialog v-model="statsVisible" title="已读统计" width="760px" append-to-body>
      <div v-if="stats" class="stats-summary flex gap-4 mb-4">
        <div class="stats-box">
          <div class="stats-label">应读人数</div>
          <div class="stats-num">{{ stats.audienceCount }}</div>
        </div>
        <div class="stats-box">
          <div class="stats-label">已读</div>
          <div class="stats-num text-success">{{ stats.readCount }}</div>
        </div>
        <div class="stats-box">
          <div class="stats-label">未读</div>
          <div class="stats-num text-danger">{{ stats.unreadCount }}</div>
        </div>
      </div>
      <ElTabs v-if="stats">
        <ElTabPane label="按门店" name="store">
          <ArtTable :data="stats.stores" :columns="storeColumns" />
        </ElTabPane>
        <ElTabPane label="未读人员" name="user">
          <ArtTable :data="stats.unreadUsers" :columns="userColumns" />
        </ElTabPane>
      </ElTabs>
    </ElDialog>

    <!-- 通知留言（公告内公开留言：可见范围继承通知定向） -->
    <ElDialog v-model="commentVisible" title="通知留言" width="640px" append-to-body>
      <div v-if="commentRow" class="comment-tip">
        《{{ commentRow.title }}》下的公开留言：只有能收到该通知的人可见；可 @
        提醒应读同事；管理员可置顶（最多 3 条）与屏蔽不当留言（店长仅限本门店通知）。
      </div>
      <ArtMessageThread
        v-if="commentRow"
        :key="commentRow.id"
        target-type="NOTICE"
        :target-id="String(commentRow.id)"
        :can-manage="true"
        @changed="handleCommentChanged"
      />
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
  import type { FormInstance, FormRules } from 'element-plus'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchNoticePage,
    sendNotice,
    updateNotice,
    withdrawNotice,
    publishNotice,
    deleteNotice,
    fetchNoticeStats,
    fetchStoreOptions,
    fetchRoleOptions,
    fetchUserOptions
  } from '@/api/notify'
  import { ButtonMoreItem } from '@/components/core/forms/art-button-more/index.vue'
  import ArtButtonMore from '@/components/core/forms/art-button-more/index.vue'
  import ArtMessageThread from '@/components/core/notify/art-message-thread/index.vue'

  defineOptions({ name: 'TenantNoticeManage' })

  type Row = Api.Notify.NoticeAdmin

  const router = useRouter()

  const searchBarRef = ref()
  const searchForm = ref({ keyword: undefined })
  const formItems = computed(() => [
    { label: '关键词', key: 'keyword', type: 'input', placeholder: '标题关键词', clearable: true }
  ])

  const scopeSummary = (row: Row) => {
    if (row.targetScope === 'ALL') return '全员'
    if (row.targetScope === 'STORE')
      return `指定门店（${(row.targetStoreIds || '').split(',').filter(Boolean).length}）`
    if (row.targetScope === 'ROLE')
      return `指定角色（${(row.targetRoleIds || '').split(',').filter(Boolean).length}）`
    if (row.targetScope === 'USER')
      return `指定人员（${(row.targetUserIds || '').split(',').filter(Boolean).length}）`
    return '-'
  }
  const readRate = (row: Row) =>
    row.audienceCount > 0 ? `${Math.round((row.readCount / row.audienceCount) * 100)}%` : '-'

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
      apiFn: fetchNoticePage,
      apiParams: { page: 1, pageSize: 10, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        {
          prop: 'title',
          label: '标题',
          minWidth: 160,
          showOverflowTooltip: true,
          formatter: (row: Row) =>
            h('span', { class: 'row-link', onClick: () => openDetail(row) }, row.title)
        },
        {
          prop: 'noticeType',
          label: '类型',
          width: 110,
          formatter: (row: Row) => {
            const t = typeTag(row.noticeType)
            return h(ElTag, { type: t.type, effect: 'plain' }, () => t.text)
          }
        },
        {
          prop: 'targetScope',
          label: '接收范围',
          width: 160,
          formatter: (row: Row) => scopeSummary(row)
        },
        { prop: 'senderName', label: '发送人', width: 110 },
        { prop: 'sendTime', label: '发送时间', width: 170, sortable: true },
        {
          prop: 'audienceCount',
          label: '应读/已读',
          width: 110,
          formatter: (row: Row) => `${row.readCount}/${row.audienceCount}`
        },
        {
          prop: 'readRate',
          label: '已读率',
          width: 90,
          formatter: (row: Row) => h('span', { class: 'text-success' }, readRate(row))
        },
        {
          prop: 'commentCount',
          label: '留言',
          width: 90,
          align: 'center',
          formatter: (row: Row) => {
            const total = row.commentCount ?? 0
            return h(
              'span',
              {
                class: total > 0 ? 'row-link' : 'text-g-400',
                onClick: () => openComments(row)
              },
              total > 0 ? `${total} 条` : '—'
            )
          }
        },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: Row) =>
            h(ElTag, { type: isWithdrawn(row) ? 'danger' : 'success', effect: 'plain' }, () =>
              isWithdrawn(row) ? '已撤回' : '已发送'
            )
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
                  !isWithdrawn(row) && {
                    key: 'withdraw',
                    label: '撤回',
                    icon: 'ri:arrow-go-back-line'
                  },
                  isWithdrawn(row) && {
                    key: 'publish',
                    label: '重新发布',
                    icon: 'ri:send-plane-line'
                  },
                  {
                    key: 'comments',
                    label: '查看留言',
                    icon: 'ri:chat-3-line'
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

  const storeColumns = [
    { prop: 'storeName', label: '门店', minWidth: 160 },
    { prop: 'userCount', label: '人数', width: 90, align: 'right' },
    { prop: 'readCount', label: '已读', width: 90, align: 'right' }
  ]
  const userColumns = [
    { prop: 'userName', label: '姓名', minWidth: 140 },
    { prop: 'storeName', label: '门店', minWidth: 160 },
    { prop: 'userId', label: '用户ID', minWidth: 160 }
  ]

  /* ------------------------------ 发送/编辑弹窗 ------------------------------ */
  const sendVisible = ref(false)
  const sending = ref(false)
  /** 编辑模式下的通知 ID；为空表示新增发送 */
  const editingId = ref('')
  const sendFormRef = ref<FormInstance>()
  const storeOptions = ref<Api.Notify.NotifyOption[]>([])
  const roleOptions = ref<Api.Notify.NotifyOption[]>([])
  const userOptions = ref<Api.Notify.NotifyOption[]>([])

  const baseSendForm = () => ({
    title: '',
    content: '',
    noticeType: 1 as number,
    targetScope: 'ALL' as Api.Notify.NoticeScope,
    targetStoreIds: [] as string[],
    targetRoleIds: [] as string[],
    targetUserIds: [] as string[]
  })
  const sendForm = reactive(baseSendForm())

  /** 通知类型选项：门店通知/制度规范/活动安排 */
  const noticeTypeOptions = [
    { value: 1, label: '门店通知' },
    { value: 2, label: '制度规范' },
    { value: 3, label: '活动安排' }
  ]

  /** 通知类型文案与标签配色（列表列用） */
  const typeTag = (t?: number): { text: string; type: 'primary' | 'info' | 'warning' } => {
    if (t === 2) return { text: '制度规范', type: 'info' }
    if (t === 3) return { text: '活动安排', type: 'warning' }
    return { text: '门店通知', type: 'primary' }
  }

  const sendRules: FormRules = {
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
    targetStoreIds: [
      {
        validator: (_rule, value, cb) => {
          if (sendForm.targetScope === 'STORE' && (!value || value.length === 0))
            cb(new Error('请选择门店'))
          else cb()
        },
        trigger: 'change'
      }
    ],
    targetRoleIds: [
      {
        validator: (_rule, value, cb) => {
          if (sendForm.targetScope === 'ROLE' && (!value || value.length === 0))
            cb(new Error('请选择角色'))
          else cb()
        },
        trigger: 'change'
      }
    ],
    targetUserIds: [
      {
        validator: (_rule, value, cb) => {
          if (sendForm.targetScope === 'USER' && (!value || value.length === 0))
            cb(new Error('请选择人员'))
          else cb()
        },
        trigger: 'change'
      }
    ]
  }

  const showSendDialog = () => {
    Object.assign(sendForm, baseSendForm())
    editingId.value = ''
    sendVisible.value = true
  }

  const showEditDialog = (row: Row) => {
    Object.assign(sendForm, baseSendForm())
    editingId.value = row.id
    sendForm.title = row.title
    sendForm.content = row.content
    sendForm.noticeType = row.noticeType ?? 1
    sendForm.targetScope = row.targetScope
    sendForm.targetStoreIds = row.targetStoreIds ? row.targetStoreIds.split(',') : []
    sendForm.targetRoleIds = row.targetRoleIds ? row.targetRoleIds.split(',') : []
    sendForm.targetUserIds = row.targetUserIds ? row.targetUserIds.split(',') : []
    sendVisible.value = true
  }

  const onScopeChange = () => {
    sendForm.targetStoreIds = []
    sendForm.targetRoleIds = []
    sendForm.targetUserIds = []
  }

  /** 富文本内容变化时同步表单校验状态（清掉空内容错误态） */
  watch(
    () => sendForm.content,
    () => sendFormRef.value?.validateField('content').catch(() => {})
  )

  const submitSend = async () => {
    if (!sendFormRef.value) return
    await sendFormRef.value.validate(async (valid) => {
      if (!valid) return
      sending.value = true
      try {
        const payload = {
          title: sendForm.title,
          content: sendForm.content,
          noticeType: sendForm.noticeType,
          targetScope: sendForm.targetScope,
          targetStoreIds: sendForm.targetStoreIds.join(','),
          targetRoleIds: sendForm.targetRoleIds.join(','),
          targetUserIds: sendForm.targetUserIds.join(',')
        }
        if (editingId.value) {
          await updateNotice(editingId.value, payload)
          ElMessage.success('保存成功')
          refreshUpdate()
        } else {
          await sendNotice(payload)
          ElMessage.success('通知已发送')
          refreshCreate()
        }
        sendVisible.value = false
      } catch (e: any) {
        ElMessage.error(e?.message || '操作失败')
      } finally {
        sending.value = false
      }
    })
  }

  /* ------------------------------ 操作 ------------------------------ */
  /** 是否已撤回（status=1；历史数据无 status 字段时按已发送处理） */
  const isWithdrawn = (row: Row) => row.status === 1

  /** 操作列三点菜单 */
  const buttonMoreClick = (item: ButtonMoreItem, row: Row) => {
    switch (item.key) {
      case 'detail':
        openDetail(row)
        break
      case 'edit':
        showEditDialog(row)
        break
      case 'withdraw':
        withdraw(row)
        break
      case 'publish':
        republish(row)
        break
      case 'stats':
        openStats(row)
        break
      case 'comments':
        openComments(row)
        break
      case 'delete':
        remove(row)
        break
    }
  }

  /** 撤回通知：接收人不可见、不计未读，可重新发布 */
  const withdraw = async (row: Row) => {
    try {
      await ElMessageBox.confirm(
        `确认撤回通知「${row.title}」？撤回后接收人将不再看到该通知。`,
        '提示',
        {
          type: 'warning'
        }
      )
      await withdrawNotice(row.id)
      ElMessage.success('已撤回')
      refreshUpdate()
    } catch (e: any) {
      if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
    }
  }

  /** 重新发布通知：刷新发送时间，立即可见并重新计入未读 */
  const republish = async (row: Row) => {
    try {
      await ElMessageBox.confirm(
        `确认重新发布通知「${row.title}」？发布后接收人将重新收到该通知。`,
        '提示',
        {
          type: 'warning'
        }
      )
      await publishNotice(row.id)
      ElMessage.success('已重新发布')
      refreshUpdate()
    } catch (e: any) {
      if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
    }
  }

  const remove = async (row: Row) => {
    try {
      await ElMessageBox.confirm(`确认删除通知「${row.title}」？`, '提示', { type: 'warning' })
      await deleteNotice(row.id)
      ElMessage.success('已删除')
      refreshRemove()
    } catch (e: any) {
      if (e !== 'cancel' && e?.message) ElMessage.error(e.message)
    }
  }

  /* ------------------------------ 统计 ------------------------------ */
  const statsVisible = ref(false)
  const stats = ref<Api.Notify.NoticeStats | null>(null)
  const openStats = async (row: Row) => {
    try {
      stats.value = await fetchNoticeStats(row.id)
      statsVisible.value = true
    } catch (e: any) {
      ElMessage.error(e?.message || '获取统计失败')
    }
  }

  /* ------------------------------ 留言 ------------------------------ */
  const commentVisible = ref(false)
  const commentRow = ref<Row | null>(null)

  const openComments = (row: Row) => {
    commentRow.value = row
    commentVisible.value = true
  }

  /** 留言增删后刷新列表，让「留言」列计数保持同步 */
  const handleCommentChanged = () => refreshUpdate()

  /* ------------------------------ 详情 ------------------------------ */
  /** 打开详情整页（静态路由 + query，可直链/刷新；返回时列表状态由 history 保留） */
  const openDetail = (row: Row) => {
    router.push({ path: '/tenant/notice/detail', query: { id: row.id } })
  }

  const handleSearch = (params: any) => {
    replaceSearchParams(params)
    getData()
  }
  const handleReset = () => resetSearchParams()

  onMounted(async () => {
    try {
      const [stores, roles, users] = await Promise.all([
        fetchStoreOptions(),
        fetchRoleOptions(),
        fetchUserOptions()
      ])
      storeOptions.value = stores
      roleOptions.value = roles
      userOptions.value = users
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

  .comment-tip {
    margin-bottom: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--art-gray-100);
    font-size: 12px;
    line-height: 1.7;
    color: var(--art-gray-600);
  }
</style>
