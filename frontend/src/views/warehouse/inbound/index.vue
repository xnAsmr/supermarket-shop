<!-- 入库管理（采购入库单统一入口：收货入库 + 手动入库） -->
<template>
  <div class="warehouse-inbound-page art-full-height">
    <ElCard class="art-table-card">
      <div class="mb-4 flex-c justify-between">
        <span class="text-base font-medium">采购入库单</span>
        <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="dialogVisible = true">
          新建入库单
        </ElButton>
      </div>

      <StockDocTable ref="tableRef" type="inbound" />

      <StockDocDialog
        v-model:visible="dialogVisible"
        type="inbound"
        @success="tableRef?.refresh()"
      />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  import { useAuth } from '@/hooks/core/useAuth'
  import StockDocTable from '@/views/warehouse/modules/stock-doc-table.vue'
  import StockDocDialog from '@/views/warehouse/modules/stock-doc-dialog.vue'

  defineOptions({ name: 'WarehouseInbound' })

  const { hasAuth } = useAuth()

  type StockDocTableRef = InstanceType<typeof StockDocTable>

  const tableRef = ref<StockDocTableRef>()
  const dialogVisible = ref(false)
</script>
