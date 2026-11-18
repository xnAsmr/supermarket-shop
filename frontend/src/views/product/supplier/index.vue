<!-- 供应商管理 -->
<template>
  <div class="product-supplier-page art-full-height">
    <SupplierSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="showDialog('add')">
              新增供应商
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

      <SupplierDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :supplier-data="currentRow"
        @success="handleDialogSuccess"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import { useAuth } from '@/hooks/core/useAuth'
  import { fetchGetSupplierList, fetchDeleteSupplier } from '@/api/product'
  import SupplierSearch from './modules/supplier-search.vue'
  import SupplierDialog from './modules/supplier-dialog.vue'
  import { ElTag, ElMessageBox } from 'element-plus'
  import type { DialogType } from '@/types'

  defineOptions({ name: 'ProductSupplier' })

  const { hasAuth } = useAuth()

  type SupplierItem = Api.Product.SupplierItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentRow = ref<Partial<SupplierItem>>({})

  const searchForm = ref<Api.Product.SupplierSearchParams>({
    name: undefined,
    contact: undefined,
    phone: undefined,
    status: undefined
  })

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
      apiFn: fetchGetSupplierList,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'name', label: '供应商名称', minWidth: 160 },
        { prop: 'contact', label: '联系人', width: 110 },
        { prop: 'phone', label: '联系电话', width: 130 },
        { prop: 'address', label: '地址', minWidth: 180, showOverflowTooltip: true },
        { prop: 'productNum', label: '商品数', width: 90 },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: SupplierItem) =>
            h(ElTag, { type: row.status === '1' ? 'success' : 'info', effect: 'plain' }, () =>
              row.status === '1' ? '合作中' : '停用'
            )
        },
        { prop: 'remark', label: '备注', minWidth: 140, showOverflowTooltip: true },
        { prop: 'createTime', label: '创建时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 130,
          fixed: 'right',
          formatter: (row: SupplierItem) =>
            h('div', { class: 'flex-c' }, [
              h(ArtButtonTable, {
                type: 'edit',
                onClick: () => showDialog('edit', row)
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

  const handleSearch = (params: Api.Product.SupplierSearchParams) => {
    replaceSearchParams(params)
    getData()
  }

  const showDialog = (type: DialogType, row?: SupplierItem) => {
    dialogType.value = type
    currentRow.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const handleDelete = (row: SupplierItem) => {
    ElMessageBox.confirm(`确定删除供应商「${row.name}」吗？删除后不可恢复。`, '删除供应商', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        await fetchDeleteSupplier(row.id)
        ElMessage.success('删除成功')
        refreshRemove()
      })
      .catch(() => undefined)
  }

  const handleDialogSuccess = () => {
    dialogVisible.value = false
    refreshCreate()
  }
</script>
