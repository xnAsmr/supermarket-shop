<!-- 用户管理页面 -->
<!-- art-full-height 自动计算出页面剩余高度 -->
<!-- art-table-card 一个符合系统样式的 class，同时自动撑满剩余高度 -->
<!-- 更多 useTable 使用示例请移步至 功能示例 下面的高级表格示例或者查看官方文档 -->
<!-- useTable 文档：https://www.artd.pro/docs/zh/guide/hooks/use-table.html -->
<template>
  <div class="user-page art-full-height">
    <!-- 搜索栏 -->
    <UserSearch
      v-model="searchForm"
      :show-tenant="isSystemAdmin"
      @search="handleSearch"
      @reset="resetSearchParams"
    ></UserSearch>

    <ElCard class="art-table-card">
      <!-- 表格头部 -->
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton @click="showDialog('add')" v-ripple>新增用户</ElButton>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <!-- 表格 -->
      <ArtTable
        :loading="loading"
        :data="data"
        :columns="columns"
        :pagination="pagination"
        @selection-change="handleSelectionChange"
        @pagination:size-change="handleSizeChange"
        @pagination:current-change="handleCurrentChange"
      >
      </ArtTable>

      <!-- 用户弹窗 -->
      <UserDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :user-data="currentUserData"
        @success="handleDialogSuccess"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { useAuth } from '@/hooks/core/useAuth'
  import { fetchGetUserList, fetchDeleteUser, fetchResetUserPassword } from '@/api/system-manage'
  import { fetchImpersonateLogin, getAuthMeta } from '@/api/auth'
  import { useUserStore, type ImpersonateOrigin } from '@/store/modules/user'
  import UserSearch from './modules/user-search.vue'
  import UserDialog from './modules/user-dialog.vue'
  import { ElTag, ElMessageBox, ElImage, ElMessage } from 'element-plus'
  import { DialogType } from '@/types'

  defineOptions({ name: 'User' })

  type UserListItem = Api.SystemManage.UserListItem

  const userStore = useUserStore()
  const { hasAuth } = useAuth()

  // 仅系统管理员（R_SUPER）可进行"模拟登录"操作
  const isSystemAdmin = computed(() => (userStore.info.roles ?? []).includes('R_SUPER'))

  // 弹窗相关
  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentUserData = ref<Partial<UserListItem>>({})

  // 选中行
  const selectedRows = ref<UserListItem[]>([])

  // 搜索表单
  const searchForm = ref({
    userName: undefined,
    userGender: undefined,
    userPhone: undefined,
    userEmail: undefined,
    tenantId: undefined,
    status: undefined
  })

  // 用户状态配置
  const USER_STATUS_CONFIG = {
    '1': { type: 'success' as const, text: '启用' },
    '2': { type: 'info' as const, text: '停用' }
  } as const

  /**
   * 获取用户状态配置
   */
  const getUserStatusConfig = (status: string) => {
    return (
      USER_STATUS_CONFIG[status as keyof typeof USER_STATUS_CONFIG] || {
        type: 'info' as const,
        text: '未知'
      }
    )
  }

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
    // 核心配置
    core: {
      apiFn: fetchGetUserList,
      apiParams: {
        current: 1,
        size: 20,
        ...searchForm.value
      },
      columnsFactory: () => [
        { type: 'selection' }, // 勾选列
        { type: 'index', width: 60, label: '序号' }, // 序号
        {
          prop: 'userInfo',
          label: '用户名',
          width: 280,
          formatter: (row) => {
            return h('div', { class: 'user flex-c' }, [
              h(ElImage, {
                class: 'size-9.5 rounded-md',
                src: row.avatar,
                previewSrcList: [row.avatar],
                // 图片预览是否插入至 body 元素上，用于解决表格内部图片预览样式异常
                previewTeleported: true
              }),
              h('div', { class: 'ml-2' }, [
                h('p', { class: 'user-name' }, row.nickName || row.userName),
                h('p', { class: 'email' }, row.userEmail || `ID: ${row.id}`)
              ])
            ])
          }
        },
        {
          prop: 'userGender',
          label: '性别',
          sortable: true,
          formatter: (row) => row.userGender
        },
        {
          prop: 'userName',
          label: '账号',
          width: 120,
          formatter: (row) => row.userName || '-'
        },
        { prop: 'userPhone', label: '手机号' },
        {
          prop: 'tenantName',
          label: '租户',
          width: 120,
          formatter: (row) => row.tenantName || '-'
        },
        {
          prop: 'userRoles',
          label: '角色',
          formatter: (row) => (row.userRoleNames ?? row.userRoles ?? []).join(' / ') || '-'
        },
        {
          prop: 'status',
          label: '状态',
          formatter: (row) => {
            const statusConfig = getUserStatusConfig(row.status)
            return h(ElTag, { type: statusConfig.type }, () => statusConfig.text)
          }
        },
        {
          prop: 'createTime',
          label: '创建日期',
          sortable: true
        },
        {
          prop: 'operation',
          label: '操作',
          width: 210,
          fixed: 'right', // 固定列
          formatter: (row) =>
            h('div', [
              ...(isSystemAdmin.value
                ? [
                    h(ArtButtonTable, {
                      type: 'view',
                      icon: 'ri:login-box-line',
                      iconClass: 'bg-info/12 text-info',
                      onClick: () => handleImpersonate(row)
                    })
                  ]
                : []),
              h(ArtButtonTable, {
                type: 'edit',
                onClick: () => showDialog('edit', row)
              }),
              ...(hasAuth('resetpwd')
                ? [
                    h(ArtButtonTable, {
                      type: 'view',
                      icon: 'ri:lock-password-line',
                      iconClass: 'bg-warning/12 text-warning',
                      onClick: () => resetUserPassword(row)
                    })
                  ]
                : []),
              h(ArtButtonTable, {
                type: 'delete',
                onClick: () => deleteUser(row)
              })
            ])
        }
      ]
    }
  })

  /**
   * 搜索处理
   * @param params 参数
   */
  const handleSearch = (params: Api.SystemManage.UserSearchParams) => {
    replaceSearchParams(params)
    getData()
  }

  /**
   * 显示用户弹窗
   */
  const showDialog = (type: DialogType, row?: UserListItem): void => {
    dialogType.value = type
    currentUserData.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  /**
   * 删除用户
   */
  const deleteUser = (row: UserListItem): void => {
    ElMessageBox.confirm(`确定要删除用户"${row.userName}"吗？此操作不可恢复！`, '删除用户', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'error'
    })
      .then(async () => {
        await fetchDeleteUser(row.id)
        ElMessage.success('删除成功')
        refreshRemove()
      })
      .catch(() => undefined)
  }

  /**
   * 重置密码（重置为默认密码 123456）
   */
  const resetUserPassword = (row: UserListItem): void => {
    ElMessageBox.confirm(
      `确定要将用户"${row.userName}"的密码重置为默认密码 123456 吗？重置后请提醒用户尽快登录并修改密码。`,
      '重置密码',
      {
        confirmButtonText: '重置',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchResetUserPassword(row.id)
        ElMessage.success('密码已重置为默认密码 123456')
      })
      .catch(() => undefined)
  }

  /**
   * 模拟登录（仅系统管理员可用）
   * 切换到目标用户身份，用于排查该用户的权限/操作问题
   */
  const handleImpersonate = (row: UserListItem): void => {
    ElMessageBox.confirm(
      `确定要以"${row.nickName || row.userName}"的身份登录吗？\n切换后将以此用户身份操作，排查其权限问题。`,
      '模拟登录',
      {
        confirmButtonText: '模拟登录',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
      .then(async () => {
        const { token, refreshToken } = await fetchImpersonateLogin(row.id)
        if (!token) {
          throw new Error('模拟登录失败 - 未获取到 token')
        }
        // 记录原始会话（退出模拟时还原身份）
        const origin: ImpersonateOrigin = {
          token: userStore.accessToken,
          refreshToken: userStore.refreshToken,
          authMeta: getAuthMeta()
        }
        userStore.setImpersonation(token, refreshToken, origin)
        userStore.setLoginStatus(true)
        // 跳转首页并整页刷新：清除 keepAlive 缓存及旧身份状态，以新身份回到该账号的首页
        window.location.href = '/'
      })
      .catch(() => undefined)
  }

  /**
   * 处理弹窗保存成功
   */
  const handleDialogSuccess = () => {
    dialogVisible.value = false
    currentUserData.value = {}
    if (dialogType.value === 'add') {
      refreshCreate()
    } else {
      refreshUpdate()
    }
  }

  /**
   * 处理表格行选择变化
   */
  const handleSelectionChange = (selection: UserListItem[]): void => {
    selectedRows.value = selection
  }
</script>
