<!-- 商品分类管理 -->
<template>
  <div class="product-category-page art-full-height">
    <CategorySearch v-model="searchForm" @search="handleSearch" @reset="handleReset" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="loadData">
        <template #left>
          <ElSpace wrap>
            <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="showDialog('add')">
              新增分类
            </ElButton>
          </ElSpace>
        </template>
      </ArtTableHeader>

      <ArtTable
        row-key="id"
        default-expand-all
        :tree-props="{ children: 'children' }"
        :loading="loading"
        :data="data"
        :columns="columns"
      />

      <CategoryDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :category-data="currentRow"
        :parent-options="parentOptions"
        @success="loadData"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTableColumns } from '@/hooks/core/useTableColumns'
  import { useAuth } from '@/hooks/core/useAuth'
  import { fetchGetCategoryTree, fetchDeleteCategory } from '@/api/product'
  import CategorySearch from './modules/category-search.vue'
  import CategoryDialog from './modules/category-dialog.vue'
  import { ElTag, ElMessageBox } from 'element-plus'
  import type { DialogType } from '@/types'

  defineOptions({ name: 'ProductCategory' })

  const { hasAuth } = useAuth()

  type CategoryItem = Api.Product.CategoryItem

  const loading = ref(false)
  const data = ref<CategoryItem[]>([])
  const searchForm = ref<Api.Product.CategorySearchParams>({})

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentRow = ref<Partial<CategoryItem>>({})

  const { columns, columnChecks } = useTableColumns<CategoryItem>(() => [
    { type: 'index', width: 60, label: '序号' },
    { prop: 'name', label: '分类名称', minWidth: 200 },
    { prop: 'sort', label: '排序', width: 80 },
    {
      prop: 'status',
      label: '状态',
      width: 90,
      formatter: (row) =>
        h(ElTag, { type: row.status === '1' ? 'success' : 'info', effect: 'plain' }, () =>
          row.status === '1' ? '启用' : '停用'
        )
    },
    { prop: 'productNum', label: '商品数', width: 90 },
    { prop: 'createTime', label: '创建时间', width: 170 },
    {
      prop: 'operation',
      label: '操作',
      width: 130,
      fixed: 'right',
      formatter: (row) =>
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
  ])

  const parentOptions = computed(() => {
    const options: { label: string; value: string; disabled?: boolean }[] = []
    const walk = (items: CategoryItem[]) => {
      items.forEach((item) => {
        options.push({
          label: item.name,
          value: item.id,
          disabled: !!item.parentId || item.id === currentRow.value?.id
        })
        if (item.children?.length) walk(item.children)
      })
    }
    walk(data.value)
    return options
  })

  const loadData = async () => {
    loading.value = true
    try {
      data.value = await fetchGetCategoryTree(searchForm.value)
    } catch (error) {
      console.error(error)
    } finally {
      loading.value = false
    }
  }

  const handleSearch = (params: Api.Product.CategorySearchParams) => {
    searchForm.value = params
    loadData()
  }

  const handleReset = () => {
    searchForm.value = {}
    loadData()
  }

  const showDialog = (type: DialogType, row?: CategoryItem) => {
    dialogType.value = type
    currentRow.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const handleDelete = (row: CategoryItem) => {
    ElMessageBox.confirm(`确定删除分类「${row.name}」吗？删除后不可恢复。`, '删除分类', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        try {
          await fetchDeleteCategory(row.id)
          ElMessage.success('删除成功')
          loadData()
        } catch (error) {
          console.error(error)
        }
      })
      .catch(() => undefined)
  }

  onMounted(() => {
    loadData()
  })
</script>
