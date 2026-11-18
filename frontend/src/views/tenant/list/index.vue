<!-- 租户列表（客户管理） -->
<template>
  <div class="tenant-list-page art-full-height">
    <TenantSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="showDialog('add')">
              新增客户
            </ElButton>
            <ElButton
              v-if="hasAuth('delete')"
              type="danger"
              plain
              v-ripple
              @click="handleResetDemo"
            >
              重置演示数据
            </ElButton>
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

      <TenantDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :tenant-data="currentRow"
        @success="handleDialogSuccess"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { useAuth } from '@/hooks/core/useAuth'
  import {
    fetchTenantList,
    fetchDeleteTenant,
    fetchPlanList,
    fetchResetDemoData
  } from '@/api/tenant'
  import { useTenantStore } from '@/store/modules/tenant'
  import TenantSearch from './modules/tenant-search.vue'
  import TenantDialog from './modules/tenant-dialog.vue'
  import { ElTag, ElMessageBox } from 'element-plus'
  import { useRouter } from 'vue-router'
  import type { DialogType } from '@/types'

  defineOptions({ name: 'TenantList' })

  const router = useRouter()

  const { hasAuth } = useAuth()
  const tenantStore = useTenantStore()

  type TenantItem = Api.Tenant.TenantItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentRow = ref<Partial<TenantItem>>({})

  const searchForm = ref({
    name: undefined,
    code: undefined,
    status: undefined,
    planId: undefined
  })

  const planOptions = ref<{ label: string; value: string }[]>([])

  const loadOptions = async () => {
    try {
      const res = await fetchPlanList({ current: 1, size: 100 })
      planOptions.value = res.records.map((item) => ({ label: item.name, value: item.id }))
    } catch (error) {
      console.error(error)
    }
  }

  const planLabel = (value: string) =>
    planOptions.value.find((item) => item.value === value)?.label || '-'

  const STATUS_MAP: Record<string, { text: string; type: 'success' | 'info' | 'danger' }> = {
    '1': { text: '正常', type: 'success' },
    '2': { text: '停用', type: 'info' },
    '3': { text: '过期', type: 'danger' }
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
    refreshRemove
  } = useTable({
    core: {
      apiFn: fetchTenantList,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        {
          prop: 'name',
          label: '客户名称',
          minWidth: 180,
          formatter: (row: TenantItem) =>
            h('div', { class: 'leading-5' }, [
              h('p', { class: 'font-medium' }, row.name),
              h('p', { class: 'text-xs text-gray-400' }, row.code)
            ])
        },
        {
          prop: 'planId',
          label: '套餐',
          width: 110,
          formatter: (row: TenantItem) => row.planName || planLabel(row.planId)
        },
        { prop: 'contact', label: '联系人', width: 100 },
        { prop: 'phone', label: '电话', width: 130 },
        { prop: 'storeNum', label: '门店数', width: 90, align: 'right' },
        { prop: 'userNum', label: '用户数', width: 90, align: 'right' },
        { prop: 'productNum', label: '商品数', width: 90, align: 'right' },
        { prop: 'expireTime', label: '到期时间', width: 120, sortable: true },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: TenantItem) =>
            h(
              ElTag,
              { type: STATUS_MAP[row.status]?.type ?? 'info', effect: 'plain' },
              () => STATUS_MAP[row.status]?.text ?? row.status
            )
        },
        { prop: 'createTime', label: '创建时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 240,
          fixed: 'right',
          formatter: (row: TenantItem) =>
            h('div', { class: 'flex-c' }, [
              h(
                'span',
                {
                  class: 'mr-2 cursor-pointer text-sm text-theme c-p',
                  onClick: () => gotoStores(row)
                },
                '门店'
              ),
              h(
                'span',
                {
                  class: 'mr-2 cursor-pointer text-sm text-secondary c-p',
                  onClick: () => showDialog('edit', row)
                },
                '编辑'
              ),
              h(ArtButtonTable, {
                icon: 'ri:exchange-2-line',
                iconClass: 'bg-theme/12 text-theme',
                onClick: () => handleSwitch(row)
              }),
              h(ArtButtonTable, {
                type: 'delete',
                onClick: () => handleDelete(row)
              })
            ])
        }
      ]
    }
  })

  const handleSearch = (params: Api.Tenant.TenantSearchParams) => {
    replaceSearchParams(params)
    getData()
  }

  const showDialog = (type: DialogType, row?: TenantItem) => {
    dialogType.value = type
    currentRow.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const handleSwitch = (row: TenantItem) => {
    if (row.id === tenantStore.currentId) {
      ElMessage.info(`当前已在「${row.name}」`)
      return
    }
    tenantStore.switchTenant(row.id)
    ElMessage.success(`已切换至 ${row.name}`)
  }

  /** 进入该客户（租户）的品牌门店列表 */
  const gotoStores = (row: TenantItem) => {
    router.push({ name: 'TenantStore', query: { tenantId: row.id } })
  }

  const handleDelete = (row: TenantItem) => {
    ElMessageBox.confirm(
      `确定删除门店「${row.name}」吗？其下属业务数据将一并清理，删除后不可恢复。`,
      '删除门店',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchDeleteTenant(row.id)
        ElMessage.success('删除成功')
        refreshRemove()
      })
      .catch(() => undefined)
  }

  const handleResetDemo = () => {
    ElMessageBox.confirm(
      '重置将清空所有门店及其业务数据，并恢复系统内置演示数据，确定继续吗？',
      '重置演示数据',
      {
        confirmButtonText: '确定重置',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
      .then(async () => {
        await fetchResetDemoData()
        ElMessage.success('演示数据已重置')
        refreshData()
      })
      .catch(() => undefined)
  }

  const handleDialogSuccess = () => {
    dialogVisible.value = false
    refreshCreate()
  }

  onMounted(() => {
    loadOptions()
  })
</script>
