<!-- 套餐管理 -->
<template>
  <div class="tenant-plan-page art-full-height">
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
            <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="showDialog('add')">
              新增套餐
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

      <PlanDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :plan-data="currentRow"
        @success="handleDialogSuccess"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { useAuth } from '@/hooks/core/useAuth'
  import { fetchPlanList } from '@/api/tenant'
  import PlanDialog from './modules/plan-dialog.vue'
  import { ElTag } from 'element-plus'
  import type { DialogType } from '@/types'

  defineOptions({ name: 'TenantPlan' })

  const { hasAuth } = useAuth()

  type PlanItem = Api.Tenant.PlanItem

  const searchBarRef = ref()
  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentRow = ref<Partial<PlanItem>>({})

  const searchForm = ref({
    name: undefined,
    status: undefined
  })

  const formItems = computed(() => [
    {
      label: '套餐名称',
      key: 'name',
      type: 'input',
      placeholder: '请输入套餐名称',
      clearable: true
    },
    {
      label: '状态',
      key: 'status',
      type: 'select',
      placeholder: '请选择状态',
      props: {
        clearable: true,
        options: [
          { label: '启用', value: '1' },
          { label: '停用', value: '2' }
        ]
      }
    }
  ])

  const durationText = (duration: number) => {
    if (duration >= 365 && duration % 365 === 0) return `${duration / 365}年`
    if (duration >= 30 && duration % 30 === 0) return `${duration / 30}个月`
    return `${duration}天`
  }

  const limitText = (value: number) => (value > 0 ? String(value) : '不限')

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
    refreshUpdate
  } = useTable({
    core: {
      apiFn: fetchPlanList,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        {
          prop: 'name',
          label: '套餐名',
          minWidth: 140,
          formatter: (row: PlanItem) => h('span', { class: 'font-medium' }, row.name)
        },
        {
          prop: 'price',
          label: '价格',
          width: 150,
          sortable: true,
          formatter: (row: PlanItem) => `¥ ${row.price.toFixed(2)} / ${durationText(row.duration)}`
        },
        {
          prop: 'userLimit',
          label: '用户上限',
          width: 100,
          align: 'right',
          formatter: (row: PlanItem) => limitText(row.userLimit)
        },
        {
          prop: 'storeLimit',
          label: '门店上限',
          width: 100,
          align: 'right',
          formatter: (row: PlanItem) => limitText(row.storeLimit)
        },
        {
          prop: 'productLimit',
          label: '商品上限',
          width: 100,
          align: 'right',
          formatter: (row: PlanItem) => limitText(row.productLimit)
        },
        {
          prop: 'status',
          label: '状态',
          width: 80,
          formatter: (row: PlanItem) =>
            h(ElTag, { type: row.status === '1' ? 'success' : 'info', effect: 'plain' }, () =>
              row.status === '1' ? '启用' : '停用'
            )
        },
        {
          prop: 'tenantNum',
          label: '使用租户数',
          width: 110,
          align: 'right',
          formatter: (row: PlanItem) => `${row.tenantNum ?? 0}`
        },
        {
          prop: 'desc',
          label: '说明',
          minWidth: 200,
          showOverflowTooltip: true,
          formatter: (row: PlanItem) => row.desc || '-'
        },
        { prop: 'createTime', label: '创建时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 100,
          fixed: 'right',
          formatter: (row: PlanItem) =>
            h('div', { class: 'flex-c' }, [
              h(ArtButtonTable, {
                type: 'edit',
                onClick: () => showDialog('edit', row)
              })
            ])
        }
      ]
    }
  })

  const handleSearch = (params: Api.Tenant.PlanSearchParams) => {
    replaceSearchParams(params)
    getData()
  }

  const handleReset = () => {
    resetSearchParams()
  }

  const showDialog = (type: DialogType, row?: PlanItem) => {
    dialogType.value = type
    currentRow.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const handleDialogSuccess = () => {
    dialogVisible.value = false
    if (dialogType.value === 'edit') {
      refreshUpdate()
    } else {
      refreshCreate()
    }
  }
</script>
