<!-- 品牌门店（sys_store）管理 -->
<template>
  <div class="tenant-store-page art-full-height">
    <ElCard class="mb-3">
      <ElSpace wrap>
        <span class="text-sm text-g-600">所属客户：</span>
        <ElSelect
          v-model="tenantId"
          placeholder="全部客户（系统管理员）"
          clearable
          filterable
          class="!w-56"
          @change="handleSearch"
        >
          <ElOption v-for="t in tenantOptions" :key="t.id" :label="t.name" :value="t.id" />
        </ElSelect>
        <ElInput
          v-model="keyword"
          placeholder="按门店名称搜索"
          clearable
          class="!w-48"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <ElButton type="primary" v-ripple @click="handleSearch">搜索</ElButton>
        <ElButton v-ripple @click="handleReset">重置</ElButton>
      </ElSpace>
    </ElCard>

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="showDialog('add')">
            新增门店
          </ElButton>
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

      <StoreDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :store-data="currentRow"
        :tenant-id="tenantId"
        @success="handleDialogSuccess"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import { useAuth } from '@/hooks/core/useAuth'
  import {
    fetchStoreList,
    fetchUpdateStoreStatus,
    fetchDeleteStore,
    fetchTenantOptions
  } from '@/api/tenant'
  import StoreDialog from './modules/store-dialog.vue'
  import { ElTag, ElMessageBox, ElMessage } from 'element-plus'
  import { useRoute } from 'vue-router'
  import type { DialogType } from '@/types'

  defineOptions({ name: 'TenantStore' })

  const route = useRoute()

  const { hasAuth } = useAuth()

  type StoreItem = Api.Tenant.StoreItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentRow = ref<Partial<StoreItem>>({})

  // 租户筛选
  const tenantId = ref('')
  const keyword = ref('')
  const tenantOptions = ref<Api.Tenant.TenantOption[]>([])

  const STORE_STATUS_MAP: Record<
    string,
    { text: string; type: 'success' | 'info' | 'warning' | 'danger' }
  > = {
    '1': { text: '营业', type: 'success' },
    '2': { text: '装修', type: 'info' },
    '3': { text: '暂停', type: 'warning' },
    '4': { text: '关闭', type: 'danger' }
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
    refreshUpdate,
    refreshRemove
  } = useTable({
    core: {
      apiFn: (params: Api.Tenant.StoreSearchParams) =>
        fetchStoreList({
          ...params,
          storeName: keyword.value || undefined,
          tenantId: tenantId.value || undefined
        }),
      apiParams: { current: 1, size: 20 },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        {
          prop: 'storeName',
          label: '门店名称',
          minWidth: 180,
          formatter: (row: StoreItem) =>
            h('div', { class: 'leading-5' }, [
              h('p', { class: 'font-medium' }, row.storeName),
              h('p', { class: 'text-xs text-gray-400' }, row.storeNo)
            ])
        },
        {
          prop: 'tenantName',
          label: '所属客户',
          width: 160,
          showOverflowTooltip: true
        },
        { prop: 'address', label: '地址', minWidth: 180, showOverflowTooltip: true },
        { prop: 'contactPhone', label: '联系电话', width: 130 },
        {
          prop: 'storeType',
          label: '类型',
          width: 90,
          formatter: (row: StoreItem) => (row.storeType === '2' ? '加盟' : '直营')
        },
        { prop: 'businessHours', label: '营业时间', width: 130 },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: StoreItem) =>
            h(
              ElTag,
              { type: STORE_STATUS_MAP[row.status]?.type ?? 'info', effect: 'plain' },
              () => STORE_STATUS_MAP[row.status]?.text ?? row.status
            )
        },
        {
          prop: 'operation',
          label: '操作',
          width: 210,
          fixed: 'right',
          formatter: (row: StoreItem) =>
            h('div', { class: 'flex-c' }, [
              h(
                'span',
                {
                  class: 'mr-1 cursor-pointer text-sm text-info c-p',
                  onClick: () => toggleStatus(row)
                },
                row.status === '1' ? '暂停' : '营业'
              ),
              h('span', {
                class: 'mr-2 text-sm text-g-400',
                children: '|'
              }),
              h(
                'span',
                {
                  class: 'mr-2 cursor-pointer text-sm text-secondary c-p',
                  onClick: () => showDialog('edit', row)
                },
                '编辑'
              ),
              h(
                'span',
                {
                  class: 'cursor-pointer text-sm text-error c-p',
                  onClick: () => handleDelete(row)
                },
                '删除'
              )
            ])
        }
      ]
    }
  })

  const handleSearch = () => {
    replaceSearchParams({ current: 1, size: 20 })
    getData()
  }

  const handleReset = () => {
    tenantId.value = ''
    keyword.value = ''
    resetSearchParams()
    getData()
  }

  const showDialog = (type: DialogType, row?: StoreItem) => {
    dialogType.value = type
    currentRow.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  /** 营业/暂停切换 */
  const toggleStatus = (row: StoreItem) => {
    const next = row.status === '1' ? '3' : '1'
    const action = row.status === '1' ? '暂停营业' : '恢复营业'
    ElMessageBox.confirm(`确定将该门店${action}吗？`, '门店状态', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        await fetchUpdateStoreStatus(row.id, next as Api.Tenant.StoreStatus)
        ElMessage.success('操作成功')
        refreshUpdate()
      })
      .catch(() => undefined)
  }

  const handleDelete = (row: StoreItem) => {
    ElMessageBox.confirm(`确定删除门店「${row.storeName}」吗？删除后不可恢复。`, '删除门店', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        await fetchDeleteStore(row.id)
        ElMessage.success('删除成功')
        refreshRemove()
      })
      .catch(() => undefined)
  }

  const handleDialogSuccess = () => {
    dialogVisible.value = false
    getData()
  }

  onMounted(async () => {
    try {
      tenantOptions.value = await fetchTenantOptions()
    } catch {
      tenantOptions.value = []
    }
    // 支持从租户列表"门店"入口跳转时预选客户（租户）
    const initialTenantId = route.query.tenantId as string | undefined
    if (initialTenantId) {
      tenantId.value = initialTenantId
    }
    getData()
  })
</script>
