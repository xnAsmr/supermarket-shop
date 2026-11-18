<!-- 支付账户管理（sys_payment_method：收银结算支付方式与账户余额） -->
<template>
  <div class="finance-account-page art-full-height">
    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="showDialog('add')">
              新增账户
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

      <AccountDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :account-data="currentRow"
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
    fetchGetPaymentAccountList,
    fetchUpdatePaymentAccount,
    fetchDeletePaymentAccount
  } from '@/api/finance'
  import AccountDialog from './modules/account-dialog.vue'
  import { ElSwitch, ElMessageBox } from 'element-plus'
  import type { DialogType } from '@/types'

  defineOptions({ name: 'FinanceAccount' })

  const { hasAuth } = useAuth()

  type AccountItem = Api.Finance.PaymentAccountItem

  const dialogType = ref<DialogType>('add')
  const dialogVisible = ref(false)
  const currentRow = ref<Partial<AccountItem>>({})

  /** 支付编码 → 类型名称（内置编码对齐后端 sys_payment_method 种子） */
  const CODE_TYPE_MAP: Record<string, string> = {
    cash: '现金',
    wechat: '微信',
    alipay: '支付宝',
    card: '银行卡',
    stored: '储值卡'
  }

  const typeLabel = (code: string): string => CODE_TYPE_MAP[code] ?? '自定义'

  const {
    columns,
    columnChecks,
    data,
    loading,
    pagination,
    refreshData,
    handleSizeChange,
    handleCurrentChange,
    refreshCreate,
    refreshRemove
  } = useTable({
    core: {
      apiFn: fetchGetPaymentAccountList,
      apiParams: { current: 1, size: 20 },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'name', label: '账户名称', minWidth: 160 },
        { prop: 'code', label: '支付编码', width: 120 },
        {
          prop: 'type',
          label: '类型',
          width: 90,
          formatter: (row: AccountItem) => typeLabel(row.code)
        },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: AccountItem) =>
            h(ElSwitch, {
              modelValue: row.status,
              activeValue: '1',
              inactiveValue: '2',
              disabled: !hasAuth('edit'),
              'onUpdate:modelValue': (value: string | number | boolean) =>
                handleToggleStatus(row, value as Api.Common.EnableStatus)
            })
        },
        {
          prop: 'balance',
          label: '余额',
          width: 130,
          sortable: true,
          align: 'right',
          formatter: (row: AccountItem) => `¥ ${row.balance.toFixed(2)}`
        },
        { prop: 'remark', label: '备注', minWidth: 140, showOverflowTooltip: true },
        { prop: 'createTime', label: '创建时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 130,
          fixed: 'right',
          formatter: (row: AccountItem) =>
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

  const showDialog = (type: DialogType, row?: AccountItem) => {
    dialogType.value = type
    currentRow.value = row || {}
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const handleToggleStatus = async (row: AccountItem, value: Api.Common.EnableStatus) => {
    try {
      await fetchUpdatePaymentAccount({ id: row.id, name: row.name, code: row.code, status: value })
      row.status = value
      ElMessage.success(value === '1' ? '账户已启用' : '账户已停用')
    } catch (error) {
      console.error(error)
    }
  }

  const handleDelete = (row: AccountItem) => {
    ElMessageBox.confirm(`确定删除支付账户「${row.name}」吗？删除后不可恢复。`, '删除账户', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        await fetchDeletePaymentAccount(row.id)
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
