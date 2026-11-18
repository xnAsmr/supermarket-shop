<!-- 商品管理 -->
<template>
  <div class="product-list-page art-full-height">
    <ProductSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="showDialog('add')">
              新增商品
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

      <ProductDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :product-data="currentRow"
        @success="handleDialogSuccess"
      />

      <PriceTrendDialog v-model:visible="trendVisible" :product="trendRow" />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import ArtButtonTable from '@/components/core/forms/art-button-table/index.vue'
  import { useTable } from '@/hooks/core/useTable'
  import {
    fetchGetProductList,
    fetchDeleteProduct,
    fetchGetCategoryOptions
  } from '@/api/product'
  import { useAuth } from '@/hooks/core/useAuth'
  import ProductSearch from './modules/product-search.vue'
  import ProductDialog from './modules/product-dialog.vue'
  import PriceTrendDialog from './modules/price-trend-dialog.vue'
  import { ElTag, ElMessageBox, ElImage } from 'element-plus'
  import type { DialogType } from '@/types'

  defineOptions({ name: 'ProductList' })

  const { hasAuth } = useAuth()

  type ProductItem = Api.Product.ProductItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentRow = ref<Partial<ProductItem>>({})

  const trendVisible = ref(false)
  const trendRow = ref<Partial<ProductItem> | null>(null)

  const searchForm = ref({
    name: undefined,
    barcode: undefined,
    categoryId: undefined,
    supplierId: undefined,
    status: undefined
  })

  const categoryOptions = ref<{ label: string; value: string }[]>([])

  const loadOptions = async () => {
    const categories = await fetchGetCategoryOptions()
    categoryOptions.value = categories.map((item) => ({ label: item.name, value: item.id }))
  }

  const optionLabel = (value: string, options: { label: string; value: string }[]) =>
    options.find((item) => item.value === value)?.label || '-'

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
      apiFn: fetchGetProductList,
      apiParams: { current: 1, size: 20, ...searchForm.value },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        {
          prop: 'image',
          label: '图片',
          width: 76,
          formatter: (row: ProductItem) =>
            h('div', { class: 'relative size-10 overflow-hidden rounded-md bg-gray-100' }, [
              h(
                'span',
                {
                  class: 'absolute inset-0 flex items-center justify-center text-xs text-gray-400'
                },
                '图'
              ),
              row.image
                ? h(ElImage, {
                    src: row.image,
                    alt: row.name,
                    fit: 'cover',
                    class: 'absolute inset-0 size-full',
                    previewSrcList: [row.image],
                    previewTeleported: true,
                    onError: (e: Event) => {
                      const el = (e.target ?? e.currentTarget) as HTMLElement | null
                      if (el) el.style.display = 'none'
                    }
                  })
                : null
            ])
        },
        {
          prop: 'name',
          label: '商品信息',
          minWidth: 240,
          formatter: (row: ProductItem) =>
            h('div', { class: 'leading-5' }, [
              h('p', { class: 'font-medium' }, row.name),
              h('p', { class: 'text-xs text-gray-400' }, [
                h('span', row.barcode),
                row.spec ? h('span', ` · ${row.spec}`) : null
              ])
            ])
        },
        {
          prop: 'categoryId',
          label: '分类',
          width: 140,
          formatter: (row: ProductItem) => optionLabel(row.categoryId, categoryOptions.value)
        },
        { prop: 'unit', label: '单位', width: 70 },
        {
          prop: 'purchasePrice',
          label: '进价',
          width: 100,
          sortable: true,
          formatter: (row: ProductItem) => `¥ ${row.purchasePrice.toFixed(2)}`
        },
        {
          prop: 'salePrice',
          label: '售价',
          width: 100,
          sortable: true,
          formatter: (row: ProductItem) => `¥ ${row.salePrice.toFixed(2)}`
        },
        {
          prop: 'memberPrice',
          label: '会员价',
          width: 100,
          formatter: (row: ProductItem) => `¥ ${row.memberPrice.toFixed(2)}`
        },
        {
          prop: 'stock',
          label: '库存',
          width: 110,
          sortable: true,
          formatter: (row: ProductItem) =>
            h(
              ElTag,
              { type: row.stock <= row.warningStock ? 'danger' : 'success', effect: 'plain' },
              () => `${row.stock} ${row.unit}`
            )
        },
        {
          prop: 'shelfQuantity',
          label: '货架',
          width: 110,
          sortable: true,
          formatter: (row: ProductItem) => {
            const shelf = Number(row.shelfQuantity) || 0
            return h(
              'span',
              { class: shelf > 0 ? 'font-medium' : 'text-gray-400' },
              `${shelf} ${row.unit}`
            )
          }
        },
        {
          prop: 'salesNum',
          label: '销量',
          width: 90,
          sortable: true
        },
        {
          prop: 'grossRate',
          label: '毛利率',
          width: 90,
          formatter: (row: ProductItem) => `${row.grossRate}%`
        },
        {
          prop: 'status',
          label: '状态',
          width: 80,
          formatter: (row: ProductItem) =>
            h(ElTag, { type: row.status === '1' ? 'success' : 'info', effect: 'plain' }, () =>
              row.status === '1' ? '在售' : '停售'
            )
        },
        { prop: 'updateTime', label: '更新时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 170,
          fixed: 'right',
          formatter: (row: ProductItem) =>
            h('div', { class: 'flex-c' }, [
              h(ArtButtonTable, {
                type: 'edit',
                onClick: () => showDialog('edit', row)
              }),
              h(ArtButtonTable, {
                type: 'view',
                onClick: () => showTrend(row)
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

  const handleSearch = (params: Api.Product.ProductSearchParams) => {
    replaceSearchParams(params)
    getData()
  }

  const showDialog = (type: DialogType, row?: ProductItem) => {
    dialogType.value = type
    currentRow.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const showTrend = (row: ProductItem) => {
    trendRow.value = row
    nextTick(() => {
      trendVisible.value = true
    })
  }

  const handleDelete = (row: ProductItem) => {
    ElMessageBox.confirm(`确定删除商品「${row.name}」吗？删除后不可恢复。`, '删除商品', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        await fetchDeleteProduct(row.id)
        ElMessage.success('删除成功')
        refreshRemove()
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
