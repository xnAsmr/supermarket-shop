<template>
  <ElDialog v-model="dialogVisible" title="挂单列表" width="620px" align-center>
    <ElTable v-if="holdList.length" :data="holdList" size="small">
      <ElTableColumn prop="name" label="挂单名称" min-width="110" show-overflow-tooltip />
      <ElTableColumn label="会员" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.member">{{ row.member.name }}（{{ row.member.phone }}）</span>
          <span v-else class="text-g-500">-</span>
        </template>
      </ElTableColumn>
      <ElTableColumn label="支付方式" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.payment">{{ describePayment(row.payment) }}</span>
          <span v-else class="text-g-500">-</span>
        </template>
      </ElTableColumn>
      <ElTableColumn prop="quantity" label="件数" width="70" align="right" />
      <ElTableColumn label="金额" width="110" align="right">
        <template #default="{ row }">¥ {{ row.totalAmount.toFixed(2) }}</template>
      </ElTableColumn>
      <ElTableColumn prop="createdAt" label="时间" width="160" />
      <ElTableColumn label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <ElButton link type="primary" size="small" @click="handleRestore(row)">取单</ElButton>
          <ElButton link type="danger" size="small" @click="handleRemove(row)">删除</ElButton>
        </template>
      </ElTableColumn>
    </ElTable>
    <ElEmpty v-else description="暂无挂单" :image-size="80" />
  </ElDialog>
</template>

<script setup lang="ts">
  import { fetchPosHoldList, fetchPosRemoveHold, fetchPosRestoreHold } from '@/api/pos'
  import { ElMessageBox } from 'element-plus'

  interface Props {
    visible: boolean
  }
  interface Emits {
    (e: 'update:visible', value: boolean): void
    (e: 'restore', hold: Api.Pos.HoldItem): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const dialogVisible = computed({
    get: () => props.visible,
    set: (value) => emit('update:visible', value)
  })

  const holdList = ref<Api.Pos.HoldItem[]>([])

  /** 支付方式快照展示文案（组合支付展示各行账户名） */
  const describePayment = (payment: Api.Pos.HoldPayment): string => {
    if (payment.method === 'combined') {
      const parts = (payment.split ?? []).map((r) => r.code)
      return parts.length ? `组合支付（${parts.join('+')}）` : '组合支付'
    }
    return payment.methodName ?? payment.method
  }

  const loadHoldList = async () => {
    try {
      holdList.value = await fetchPosHoldList()
    } catch (error) {
      console.error(error)
    }
  }

  const handleRestore = async (row: Api.Pos.HoldItem) => {
    try {
      const hold = await fetchPosRestoreHold(row.id)
      dialogVisible.value = false
      emit('restore', hold)
    } catch (error) {
      console.error(error)
    }
  }

  const handleRemove = (row: Api.Pos.HoldItem) => {
    ElMessageBox.confirm(`确定删除挂单「${row.name}」吗？`, '删除挂单', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        await fetchPosRemoveHold(row.id)
        holdList.value = holdList.value.filter((item) => item.id !== row.id)
        ElMessage.success('挂单已删除')
      })
      .catch(() => undefined)
  }

  watch(
    () => props.visible,
    (visible) => {
      if (visible) loadHoldList()
    }
  )
</script>
