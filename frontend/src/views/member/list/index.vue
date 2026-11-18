<!-- 会员管理 -->
<template>
  <div class="member-list-page art-full-height">
    <MemberSearch v-model="searchForm" @search="handleSearch" @reset="resetSearchParams" />

    <ElCard class="art-table-card">
      <ArtTableHeader v-model:columns="columnChecks" :loading="loading" @refresh="refreshData">
        <template #left>
          <ElSpace wrap>
            <ElButton v-if="hasAuth('add')" type="primary" v-ripple @click="showDialog('add')">
              新增会员
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

      <MemberDialog
        v-model:visible="dialogVisible"
        :type="dialogType"
        :user-data="currentRow"
        @success="refreshCreate"
      />
      <MemberRecharge
        v-model:visible="rechargeVisible"
        :member="currentRow"
        @success="handleRechargeSuccess"
      />
    </ElCard>

    <ElDrawer v-model="drawerVisible" :title="`${currentRow?.name ?? ''} 的会员记录`" size="760px">
      <ElTabs v-model="activeTab">
        <ElTabPane label="充值记录" name="recharge">
          <ElTable v-loading="logLoading" :data="rechargeLogs" border stripe>
            <ElTableColumn prop="createTime" label="充值时间" width="170" />
            <ElTableColumn label="充值金额" width="100" align="right">
              <template #default="{ row }">¥ {{ row.amount.toFixed(2) }}</template>
            </ElTableColumn>
            <ElTableColumn label="赠送金额" width="100" align="right">
              <template #default="{ row }">¥ {{ row.giftAmount.toFixed(2) }}</template>
            </ElTableColumn>
            <ElTableColumn label="充值前余额" width="110" align="right">
              <template #default="{ row }">¥ {{ row.beforeBalance.toFixed(2) }}</template>
            </ElTableColumn>
            <ElTableColumn label="充值后余额" width="110" align="right">
              <template #default="{ row }">¥ {{ row.afterBalance.toFixed(2) }}</template>
            </ElTableColumn>
            <ElTableColumn label="支付方式" width="90">
              <template #default="{ row }">{{
                PAY_LABEL[row.payMethod] ?? row.payMethod ?? '-'
              }}</template>
            </ElTableColumn>
            <ElTableColumn prop="operatorName" label="操作员" width="100" />
            <ElTableColumn prop="remark" label="备注" min-width="100" show-overflow-tooltip />
          </ElTable>
          <ElPagination
            v-if="rechargeTotal > 0"
            class="mt-3 flex justify-end"
            layout="total, prev, pager, next"
            :total="rechargeTotal"
            :page-size="rechargeParams.size"
            :current-page="rechargeParams.current"
            @current-change="handleRechargePageChange"
          />
        </ElTabPane>

        <ElTabPane label="消费记录" name="consume">
          <ElTable v-loading="logLoading" :data="consumeLogs" border stripe>
            <ElTableColumn prop="orderNo" label="订单号" min-width="170" />
            <ElTableColumn label="消费金额" width="100" align="right">
              <template #default="{ row }">¥ {{ row.amount.toFixed(2) }}</template>
            </ElTableColumn>
            <ElTableColumn label="实付金额" width="100" align="right">
              <template #default="{ row }">¥ {{ row.payAmount.toFixed(2) }}</template>
            </ElTableColumn>
            <ElTableColumn prop="payMethodName" label="支付方式" width="90">
              <template #default="{ row }">{{ row.payMethodName ?? '-' }}</template>
            </ElTableColumn>
            <ElTableColumn prop="orderStatusName" label="订单状态" width="90">
              <template #default="{ row }">{{ row.orderStatusName ?? '-' }}</template>
            </ElTableColumn>
            <ElTableColumn prop="orderTime" label="消费时间" width="170" />
            <ElTableColumn prop="storeName" label="门店" min-width="110" show-overflow-tooltip />
          </ElTable>
          <ElPagination
            v-if="consumeTotal > 0"
            class="mt-3 flex justify-end"
            layout="total, prev, pager, next"
            :total="consumeTotal"
            :page-size="consumeParams.size"
            :current-page="consumeParams.current"
            @current-change="handleConsumePageChange"
          />
        </ElTabPane>
      </ElTabs>
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
  import { useTable } from '@/hooks/core/useTable'
  import { useAuth } from '@/hooks/core/useAuth'
  import {
    fetchGetMemberList,
    fetchDeleteMember,
    fetchGetMemberRechargeLog,
    fetchGetMemberConsumeLog
  } from '@/api/member'
  import MemberSearch from './modules/member-search.vue'
  import MemberDialog from './modules/member-dialog.vue'
  import MemberRecharge from './modules/member-recharge.vue'
  import { ElButton, ElTag, ElMessageBox } from 'element-plus'

  defineOptions({ name: 'MemberList' })

  const { hasAuth } = useAuth()

  type MemberItem = Api.Member.MemberItem

  const PAY_LABEL: Record<string, string> = {
    cash: '现金',
    wechat: '微信',
    alipay: '支付宝',
    card: '银行卡',
    stored: '储值卡'
  }

  const LEVEL_TAG: Record<string, 'info' | 'warning' | 'danger' | 'success'> = {
    普通会员: 'info',
    银卡会员: 'success',
    金卡会员: 'warning',
    钻石会员: 'danger'
  }

  const searchForm = ref<Api.Member.MemberSearchParams>({
    keyword: undefined,
    levelId: undefined,
    status: undefined
  })

  const dialogVisible = ref(false)
  const dialogType = ref<'add' | 'edit'>('add')
  const rechargeVisible = ref(false)
  const drawerVisible = ref(false)
  const activeTab = ref('recharge')
  const currentRow = ref<MemberItem>()

  const rechargeLogs = ref<Api.Member.RechargeLogItem[]>([])
  const consumeLogs = ref<Api.Member.ConsumeLogItem[]>([])
  const rechargeTotal = ref(0)
  const consumeTotal = ref(0)
  const logLoading = ref(false)
  const rechargeParams = ref({ current: 1, size: 10 })
  const consumeParams = ref({ current: 1, size: 10 })

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
      apiFn: fetchGetMemberList,
      apiParams: {
        current: 1,
        size: 20,
        keyword: undefined,
        levelId: undefined,
        status: undefined
      },
      columnsFactory: () => [
        { type: 'index', width: 60, label: '序号' },
        { prop: 'memberNo', label: '会员编号', width: 150 },
        // 姓名列用 minWidth 吸收多余宽度，避免整表固定宽度导致右侧留白、操作列不贴右
        { prop: 'name', label: '姓名', minWidth: 100 },
        { prop: 'phone', label: '手机号', width: 130 },
        {
          prop: 'levelName',
          label: '会员等级',
          width: 100,
          formatter: (row: MemberItem) =>
            row.levelName
              ? h(
                  ElTag,
                  { type: LEVEL_TAG[row.levelName] ?? 'info', effect: 'plain' },
                  () => row.levelName
                )
              : '-'
        },
        {
          prop: 'gender',
          label: '性别',
          width: 70,
          formatter: (row: MemberItem) =>
            row.gender === 1 ? '男' : row.gender === 2 ? '女' : '未知'
        },
        {
          prop: 'balance',
          label: '余额',
          width: 110,
          sortable: true,
          formatter: (row: MemberItem) => `¥ ${row.balance.toFixed(2)}`
        },
        { prop: 'points', label: '积分', width: 90 },
        {
          prop: 'totalConsume',
          label: '累计消费',
          width: 120,
          sortable: true,
          formatter: (row: MemberItem) => `¥ ${row.totalConsume.toFixed(2)}`
        },
        {
          prop: 'status',
          label: '状态',
          width: 90,
          formatter: (row: MemberItem) =>
            row.status === '1'
              ? h(ElTag, { type: 'success', effect: 'plain' }, () => '正常')
              : h(ElTag, { type: 'danger', effect: 'plain' }, () => '停用')
        },
        { prop: 'registerTime', label: '注册时间', width: 170, sortable: true },
        {
          prop: 'operation',
          label: '操作',
          width: 210,
          fixed: 'right',
          formatter: (row: MemberItem) => renderActions(row)
        }
      ]
    }
  })

  const renderActions = (row: MemberItem) => {
    return h('div', { class: 'flex-c' }, [
      h(ElButton, { type: 'primary', link: true, onClick: () => openRecords(row) }, () => '记录'),
      hasAuth('recharge')
        ? h(
            ElButton,
            { type: 'primary', link: true, onClick: () => openRecharge(row) },
            () => '充值'
          )
        : null,
      hasAuth('edit')
        ? h(
            ElButton,
            { type: 'primary', link: true, onClick: () => showDialog('edit', row) },
            () => '编辑'
          )
        : null,
      hasAuth('delete')
        ? h(
            ElButton,
            { type: 'danger', link: true, onClick: () => handleDelete(row) },
            () => '删除'
          )
        : null
    ])
  }

  const handleSearch = (params: Api.Member.MemberSearchParams) => {
    replaceSearchParams(params)
    getData()
  }

  const showDialog = (type: 'add' | 'edit', row?: MemberItem) => {
    dialogType.value = type
    currentRow.value = row
    nextTick(() => {
      dialogVisible.value = true
    })
  }

  const openRecharge = (row: MemberItem) => {
    currentRow.value = row
    rechargeVisible.value = true
  }

  const openRecords = (row: MemberItem) => {
    currentRow.value = row
    activeTab.value = 'recharge'
    rechargeParams.value = { current: 1, size: 10 }
    consumeParams.value = { current: 1, size: 10 }
    drawerVisible.value = true
    loadRechargeLogs()
    loadConsumeLogs()
  }

  const loadRechargeLogs = async () => {
    if (!currentRow.value) return
    logLoading.value = true
    try {
      const res = await fetchGetMemberRechargeLog(String(currentRow.value.id), rechargeParams.value)
      rechargeLogs.value = res.records
      rechargeTotal.value = res.total
    } catch (error) {
      console.error(error)
    } finally {
      logLoading.value = false
    }
  }

  const loadConsumeLogs = async () => {
    if (!currentRow.value) return
    logLoading.value = true
    try {
      const res = await fetchGetMemberConsumeLog(String(currentRow.value.id), consumeParams.value)
      consumeLogs.value = res.records
      consumeTotal.value = res.total
    } catch (error) {
      console.error(error)
    } finally {
      logLoading.value = false
    }
  }

  const handleRechargePageChange = (page: number) => {
    rechargeParams.value.current = page
    loadRechargeLogs()
  }

  const handleConsumePageChange = (page: number) => {
    consumeParams.value.current = page
    loadConsumeLogs()
  }

  const handleRechargeSuccess = () => {
    refreshUpdate()
    if (drawerVisible.value) loadRechargeLogs()
  }

  const handleDelete = (row: MemberItem) => {
    ElMessageBox.confirm(`确定删除会员「${row.name}」吗？充值记录将一并删除。`, '删除会员', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
      .then(async () => {
        try {
          await fetchDeleteMember(row.id)
          ElMessage.success('会员已删除')
          refreshData()
        } catch (error) {
          console.error(error)
        }
      })
      .catch(() => undefined)
  }
</script>
