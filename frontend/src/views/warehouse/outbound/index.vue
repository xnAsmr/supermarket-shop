<!-- 出库管理（销售出库 / 调拨出库 合并） -->
<template>
  <div class="warehouse-outbound-page art-full-height">
    <div class="mb-4 flex-c justify-between">
      <ElSegmented v-model="docType" :options="typeOptions" />
    </div>

    <SalesPanel v-if="docType === 'sale'" />

    <template v-else>
      <ElCard class="art-table-card">
        <div class="mb-4 flex-c justify-between">
          <span class="text-base font-medium">调拨出库</span>
          <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="dialogVisible = true">
            新建调拨单
          </ElButton>
        </div>

        <StockDocTable ref="transferRef" type="transfer" />

        <StockDocDialog
          v-model:visible="dialogVisible"
          type="transfer"
          @success="transferRef?.refresh()"
        />
      </ElCard>
    </template>
  </div>
</template>

<script setup lang="ts">
  import { useRoute } from 'vue-router'
  import { useAuth } from '@/hooks/core/useAuth'
  import StockDocTable from '@/views/warehouse/modules/stock-doc-table.vue'
  import StockDocDialog from '@/views/warehouse/modules/stock-doc-dialog.vue'
  import SalesPanel from './modules/sales-panel.vue'

  defineOptions({ name: 'WarehouseOutbound' })

  type DocType = 'sale' | 'transfer'

  const { hasAuth } = useAuth()
  const route = useRoute()

  const typeOptions: { label: string; value: DocType }[] = [
    { label: '销售出库（上架）', value: 'sale' },
    { label: '调拨出库', value: 'transfer' }
  ]

  const docType = ref<DocType>(route.query.type === 'transfer' ? 'transfer' : 'sale')

  watch(
    () => route.query.type,
    (value) => {
      if (value === 'sale' || value === 'transfer') docType.value = value
    }
  )

  type StockDocTableRef = InstanceType<typeof StockDocTable>

  const transferRef = ref<StockDocTableRef>()
  const dialogVisible = ref(false)
</script>
