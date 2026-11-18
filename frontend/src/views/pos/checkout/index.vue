<!-- 收银台 -->
<template>
  <div class="pos-page art-full-height flex flex-col">
    <div class="pos-topbar art-card mb-4 flex-c justify-between px-4">
      <div class="flex-c gap-4 min-w-0">
        <span class="shrink-0 font-medium">收银台</span>
        <ElSelect
          v-model="warehouseId"
          class="w-48"
          :disabled="contextLoading"
          @change="handleWarehouseChange"
        >
          <ElOption v-for="w in warehouses" :key="w.id" :label="w.name" :value="w.id" />
        </ElSelect>
        <span class="truncate text-sm text-g-500">{{ tenantName }} · 收银员：{{ cashier }}</span>
      </div>
      <span class="shrink-0 text-sm text-g-500">{{ nowText }}</span>
    </div>

    <div class="flex min-h-0 flex-1 gap-4">
      <div class="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div class="art-card px-4 py-3">
          <!-- 当前筛选路径：全部分类 › 一级分类 › 二级分类，点击任一段可逐级返回 -->
          <div class="flex-c mb-2 flex-wrap gap-1">
            <span class="shrink-0 text-xs text-g-500">当前分类</span>
            <ElButton
              v-for="(node, index) in activeCategoryBreadcrumb"
              :key="node.id"
              link
              size="small"
              :type="index === activeCategoryBreadcrumb.length - 1 ? 'primary' : 'default'"
              @click="handleCategoryClick(node.id)"
            >
              {{ node.label }}
            </ElButton>
            <template v-if="activeCategoryId">
              <span class="shrink-0 text-xs text-g-400">·</span>
              <ElButton link size="small" @click="handleCategoryClick('')">重置</ElButton>
            </template>
          </div>
          <!-- 一级分类（含全部） -->
          <div class="flex-c gap-2 overflow-x-auto pb-1">
            <ElButton
              size="small"
              round
              :type="activeCategoryId === '' ? 'primary' : 'default'"
              @click="handleCategoryClick('')"
            >
              全部
            </ElButton>
            <ElButton
              v-for="c in categories"
              :key="c.id"
              size="small"
              round
              :type="activeCategoryId === c.id ? 'primary' : 'default'"
              @click="handleCategoryClick(c.id)"
            >
              {{ c.name }}
            </ElButton>
          </div>
          <!-- 二级分类：行首标注所属一级分类，plain 描边样式与一级分类区分层级 -->
          <div
            v-if="activeRootCategory?.children?.length"
            class="pos-sub-categories flex-c gap-2 overflow-x-auto pb-1"
          >
            <span class="shrink-0 text-xs font-medium text-g-600">{{
              activeRootCategory.name
            }}</span>
            <span class="shrink-0 text-xs text-g-400">›</span>
            <ElButton
              size="small"
              round
              plain
              :type="activeCategoryId === activeRootCategory.id ? 'primary' : 'default'"
              @click="handleCategoryClick(activeRootCategory.id)"
            >
              全部子类
            </ElButton>
            <ElButton
              v-for="ch in activeRootCategory.children"
              :key="ch.id"
              size="small"
              round
              plain
              :type="activeCategoryId === ch.id ? 'primary' : 'default'"
              @click="handleCategoryClick(ch.id)"
            >
              {{ ch.name }}
            </ElButton>
          </div>
          <ElInput
            ref="searchInputRef"
            v-model="keyword"
            class="mt-3"
            placeholder="扫描或输入商品条码 / 名称，回车搜索"
            clearable
            @keyup.enter="handleSearch"
          >
            <template #prefix>
              <ArtSvgIcon icon="ri:search-line" class="text-g-500" />
            </template>
          </ElInput>
        </div>

        <div class="art-card flex min-h-0 flex-1 flex-col">
          <div
            class="flex-c justify-between border-b border-gray-100 px-4 py-2 text-sm font-medium"
          >
            <span>商品列表</span>
            <div class="flex-c gap-1">
              <button
                type="button"
                class="pos-view-btn"
                :class="{ 'is-active': productView === 'list' }"
                title="列表视图"
                @click="setProductView('list')"
              >
                <ArtSvgIcon icon="ri:list-unordered" />
              </button>
              <button
                type="button"
                class="pos-view-btn"
                :class="{ 'is-active': productView === 'card' }"
                title="卡片视图"
                @click="setProductView('card')"
              >
                <ArtSvgIcon icon="ri:apps-2-line" />
              </button>
            </div>
          </div>
          <div v-loading="searching" class="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <template v-if="searchResults.length">
              <!-- 卡片视图 -->
              <template v-if="productView === 'card'">
                <div
                  class="pos-product-grid grid grid-cols-2 gap-2.5 md:grid-cols-3 2xl:grid-cols-4"
                >
                  <div
                    v-for="item in searchResults"
                    :key="`card-${item.productId}`"
                    class="pos-product-card"
                    :class="{ 'pos-product-card--disabled': item.stock <= 0 }"
                    @click="item.stock > 0 && handleSelectProduct(item)"
                  >
                    <span class="pos-product-card__add">
                      <ArtSvgIcon icon="ri:add-circle-line" class="text-xl text-primary" />
                    </span>
                    <div class="pos-product-card__head">
                      <div class="pos-thumb" @click.stop>
                        <ArtSvgIcon icon="ri:image-2-line" class="pos-thumb__placeholder" />
                        <ElImage
                          v-if="item.image"
                          class="pos-thumb__img"
                          :src="item.image"
                          :alt="item.name"
                          :preview-src-list="[item.image]"
                          preview-teleported
                          fit="cover"
                          loading="lazy"
                          @error="handleImgError"
                        />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="pos-product-card__name">{{ item.name }}</p>
                        <p class="pos-product-card__meta">{{ item.barcode }}</p>
                      </div>
                    </div>
                    <div class="pos-product-card__bottom">
                      <div class="min-w-0">
                        <p class="text-danger">
                          <span class="text-sm font-semibold">¥ {{ item.price.toFixed(2) }}</span>
                        </p>
                        <p
                          v-if="item.memberPrice > 0 && item.memberPrice < item.price"
                          class="text-xs text-g-500"
                        >
                          会员价 ¥ {{ item.memberPrice.toFixed(2) }}
                        </p>
                      </div>
                      <span
                        class="pos-product-card__stock"
                        :class="{
                          'text-danger': item.stock <= 0,
                          'pos-product-card__stock--urgent': isUrgentStock(item)
                        }"
                      >
                        {{
                          item.stock <= 0
                            ? '售罄'
                            : isUrgentStock(item)
                              ? `仅剩 ${item.stock}`
                              : `库存 ${item.stock}`
                        }}
                      </span>
                    </div>
                  </div>
                </div>
              </template>
              <!-- 列表视图 -->
              <template v-else>
                <div
                  v-for="item in searchResults"
                  :key="`row-${item.productId}`"
                  class="pos-product-item flex-c justify-between gap-3 rounded-lg px-2 py-2.5"
                  @click="handleSelectProduct(item)"
                >
                  <div class="pos-thumb pos-thumb--sm shrink-0" @click.stop>
                    <ArtSvgIcon icon="ri:image-2-line" class="pos-thumb__placeholder" />
                    <ElImage
                      v-if="item.image"
                      class="pos-thumb__img"
                      :src="item.image"
                      :alt="item.name"
                      :preview-src-list="[item.image]"
                      preview-teleported
                      fit="cover"
                      loading="lazy"
                      @error="handleImgError"
                    />
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium">{{ item.name }}</p>
                    <p class="mt-0.5 truncate text-xs text-g-500">
                      {{ item.barcode }} · 库存 {{ item.stock }} {{ item.unit }}
                    </p>
                  </div>
                  <div class="shrink-0 text-right">
                    <p class="text-sm font-medium text-danger">¥ {{ item.price.toFixed(2) }}</p>
                    <p
                      v-if="item.memberPrice > 0 && item.memberPrice < item.price"
                      class="mt-0.5 text-xs text-g-500"
                    >
                      会员价 {{ item.memberPrice.toFixed(2) }}
                    </p>
                  </div>
                  <ArtSvgIcon icon="ri:add-circle-line" class="shrink-0 text-xl text-primary" />
                </div>
              </template>
            </template>
            <ElEmpty v-else description="暂无商品，试试搜索或切换分类" :image-size="80" />
          </div>
        </div>

        <div class="art-card px-4 py-3">
          <div class="mb-2 flex-c justify-between">
            <span class="text-sm font-medium">最近交易</span>
            <span class="text-xs text-g-500">近 {{ recentOrders.length }} 笔</span>
          </div>
          <div v-if="recentOrders.length" class="grid grid-cols-2 gap-x-4 gap-y-1">
            <div v-for="o in recentOrders" :key="o.id" class="min-w-0">
              <div class="flex-c justify-between gap-2 text-xs">
                <span class="truncate text-g-500">{{ o.orderNo }}</span>
                <span class="shrink-0 font-medium">¥ {{ o.payAmount.toFixed(2) }}</span>
              </div>
              <p class="truncate text-xs text-g-500"
                >{{ o.cashier }} · {{ o.createTime.slice(5) }}</p
              >
            </div>
          </div>
          <p v-else class="text-xs text-g-500">暂无交易记录</p>
        </div>
      </div>

      <div class="flex w-[420px] shrink-0 flex-col gap-4 min-h-0">
        <div class="art-card flex min-h-0 flex-1 flex-col">
          <div class="flex-c justify-between border-b border-gray-100 px-4 py-2.5">
            <span class="text-sm font-medium">购物车</span>
            <div class="flex-c gap-3">
              <span v-if="cartItems.length" class="text-xs text-g-500">共 {{ totalCount }} 件</span>
              <ElButton v-if="cartItems.length" link type="danger" size="small" @click="clearCart">
                清空
              </ElButton>
            </div>
          </div>
          <div v-if="cartItems.length" class="min-h-0 flex-1 overflow-y-auto">
            <div
              v-for="(item, index) in cartItems"
              :key="item.productId"
              class="pos-cart-item px-4 py-2.5"
            >
              <div class="flex-c justify-between gap-2">
                <p class="min-w-0 flex-1 truncate text-sm font-medium">{{ item.name }}</p>
                <ElButton link type="danger" @click="removeCartItem(index)">删除</ElButton>
              </div>
              <div class="mt-1.5 flex-c justify-between gap-2">
                <span class="shrink-0 text-xs text-g-500">
                  <template v-if="item.memberPrice > 0 && item.memberPrice < item.price">
                    <span class="line-through">¥ {{ item.price.toFixed(2) }}</span>
                    <span class="ml-1 text-danger">会员价 ¥ {{ item.memberPrice.toFixed(2) }}</span>
                  </template>
                  <template v-else>¥ {{ item.price.toFixed(2) }}/{{ item.unit }}</template>
                </span>
                <div class="flex-c gap-1">
                  <ElButton
                    size="small"
                    :disabled="item.quantity <= 1"
                    @click="changeQuantity(index, -1)"
                  >
                    −
                  </ElButton>
                  <span class="w-8 text-center text-sm">{{ item.quantity }}</span>
                  <ElButton
                    size="small"
                    :disabled="item.quantity >= item.stock"
                    @click="changeQuantity(index, 1)"
                  >
                    +
                  </ElButton>
                </div>
                <span class="shrink-0 text-sm font-medium"
                  >¥ {{ (item.price * item.quantity).toFixed(2) }}</span
                >
              </div>
            </div>
          </div>
          <ElEmpty v-else description="购物车为空" :image-size="72" class="my-auto" />
        </div>

        <div class="art-card px-4 py-3">
          <div class="flex-c justify-between text-sm">
            <span class="text-g-500">合计</span>
            <span>¥ {{ totalAmount.toFixed(2) }}</span>
          </div>
          <!-- 优惠金额：会员价差额 + 等级折扣自动计算（不可手动填写） -->
          <div class="mt-1.5 flex-c justify-between text-sm">
            <span class="text-g-500">
              优惠金额<template
                v-if="selectedMember && memberDiscountRate < 1 && memberDiscountAmount > 0"
                >（{{ selectedMember.levelName ?? '会员' }} {{ discountText }}）</template
              >
            </span>
            <span :class="memberDiscountAmount > 0 ? 'text-danger' : 'text-g-500'">
              {{ memberDiscountAmount > 0 ? `- ¥ ${memberDiscountAmount.toFixed(2)}` : '¥ 0.00' }}
            </span>
          </div>
          <div class="mt-2 flex-c justify-between">
            <span class="text-sm text-g-500">应收金额（已优惠）</span>
            <span class="text-xl font-semibold text-danger">¥ {{ payAmount.toFixed(2) }}</span>
          </div>

          <!-- 支付方式：来自支付账户（sys_payment_method 启用项），支持会员卡与组合支付 -->
          <ElRadioGroup v-model="payMethod" class="mt-3">
            <ElRadioButton v-for="acc in payAccounts" :key="acc.code" :value="acc.code">
              {{ acc.name }}
            </ElRadioButton>
            <ElRadioButton v-if="payAccounts.length > 1" value="combined">组合支付</ElRadioButton>
          </ElRadioGroup>

          <!-- 组合支付：多账户拆分收款，合计须等于应收金额 -->
          <div v-if="payMethod === 'combined'" class="mt-3 space-y-2">
            <div v-for="(row, idx) in combinedPayments" :key="idx" class="flex-c gap-2">
              <ElSelect v-model="row.code" size="small" class="w-28">
                <ElOption
                  v-for="acc in payAccounts"
                  :key="acc.code"
                  :label="acc.name"
                  :value="acc.code"
                  :disabled="combinedPayments.some((r, i) => i !== idx && r.code === acc.code)"
                />
              </ElSelect>
              <ElInputNumber
                v-model="row.amount"
                :min="0"
                :precision="2"
                :controls="false"
                size="small"
                class="!w-28"
                placeholder="金额"
              />
              <ElButton
                link
                type="danger"
                size="small"
                :disabled="combinedPayments.length <= 1"
                @click="combinedPayments.splice(idx, 1)"
              >
                删除
              </ElButton>
            </div>
            <div class="flex-c justify-between gap-2 text-xs">
              <ElButton link type="primary" size="small" @click="handleAddCombinedRow">
                + 添加支付方式
              </ElButton>
              <span :class="combinedGap !== 0 ? 'text-danger' : 'text-g-500'">
                收款 ¥ {{ combinedTotal.toFixed(2) }} / 应收 ¥ {{ payAmount.toFixed(2)
                }}<template v-if="combinedGap !== 0">
                  （{{ combinedGap > 0 ? '还差' : '超出' }} ¥
                  {{ Math.abs(combinedGap).toFixed(2) }}）</template
                >
              </span>
            </div>
          </div>

          <p
            v-if="storedAmount > 0"
            class="mt-2 text-xs"
            :class="storedLack ? 'text-danger' : 'text-g-500'"
          >
            <template v-if="selectedMember">
              会员卡余额 ¥ {{ selectedMember.balance.toFixed(2) }}，会员卡支付 ¥
              {{ storedAmount.toFixed(2) }}{{ storedLack ? '（余额不足）' : '' }}
            </template>
            <template v-else>请先关联会员后再使用会员卡（储值卡）支付</template>
          </p>

          <template v-if="payMethod === 'cash'">
            <div class="mt-3 flex-c justify-between gap-2 text-sm">
              <span class="shrink-0 text-g-500">实收</span>
              <ElInputNumber
                v-model="receivedAmount"
                :min="0"
                :precision="2"
                :controls="false"
                placeholder="实收金额"
                class="!w-40"
              />
            </div>
            <div class="mt-2 flex-c flex-wrap gap-2">
              <ElButton size="small" @click="receivedAmount = payAmount">正好</ElButton>
              <ElButton
                v-for="v in [100, 200, 500]"
                :key="v"
                size="small"
                @click="receivedAmount = v"
              >
                {{ v }}
              </ElButton>
            </div>
            <div class="mt-2 flex-c justify-between text-sm">
              <span class="text-g-500">找零</span>
              <span :class="cashLack ? 'text-danger' : 'text-success'">
                ¥ {{ Math.max(changeAmount, 0).toFixed(2) }}{{ cashLack ? '（现金不足）' : '' }}
              </span>
            </div>
          </template>

          <!-- 会员：按手机号查询关联，享受等级折扣 -->
          <div v-if="!selectedMember" class="mt-3 flex-c gap-2">
            <ElInput
              v-model="memberPhone"
              class="flex-1"
              size="small"
              placeholder="会员手机号（可选，回车查询）"
              clearable
              :disabled="memberLoading"
              @keyup.enter="handleMemberSearch"
            />
            <ElButton size="small" :loading="memberLoading" @click="handleMemberSearch">
              查询
            </ElButton>
          </div>
          <div v-else class="pos-member-card mt-3 rounded-lg px-3 py-2">
            <div class="flex-c justify-between gap-2">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">
                  {{ selectedMember.name }}
                  <ElTag size="small" effect="plain" class="ml-1">
                    {{ selectedMember.levelName ?? '会员' }}
                  </ElTag>
                </p>
                <p class="mt-0.5 truncate text-xs text-g-500">
                  储值余额 ¥ {{ selectedMember.balance.toFixed(2) }} · 积分
                  {{ selectedMember.points }}
                </p>
              </div>
              <ElButton link type="danger" size="small" @click="handleMemberClear">解除</ElButton>
            </div>
          </div>
          <ElInput
            v-model="remark"
            class="mt-2"
            size="small"
            placeholder="备注（可选）"
            clearable
          />

          <div class="mt-3 flex-c gap-2">
            <ElButton :disabled="!cartItems.length" @click="handleSaveHold">挂单</ElButton>
            <ElButton @click="holdDialogVisible = true">取单</ElButton>
            <ElButton
              type="primary"
              class="flex-1"
              :loading="checkingOut"
              :disabled="!cartItems.length"
              @click="handleCheckout"
            >
              结算 ¥ {{ payAmount.toFixed(2) }}
            </ElButton>
          </div>
        </div>
      </div>
    </div>

    <PosHoldDialog v-model:visible="holdDialogVisible" @restore="handleHoldRestored" />

    <ElDialog
      v-model="successVisible"
      width="360px"
      align-center
      :show-close="false"
      :close-on-click-modal="false"
    >
      <div class="py-2 text-center">
        <div class="mx-auto mb-3 flex-cc size-14 rounded-full bg-success text-3xl text-white">
          <ArtSvgIcon icon="ri:check-line" />
        </div>
        <p class="text-lg font-medium">收款成功</p>
        <div class="mt-4 space-y-1.5 text-left text-sm">
          <p class="flex-c justify-between text-g-500">
            <span>订单号</span>
            <span class="text-gray-600">{{ lastResult?.order.orderNo }}</span>
          </p>
          <p class="flex-c justify-between text-g-500">
            <span>商品件数</span>
            <span class="text-gray-600">{{ lastResult?.order.quantity }}</span>
          </p>
          <p class="flex-c justify-between text-g-500">
            <span>实收金额</span>
            <span class="font-medium text-gray-600"
              >¥ {{ (lastResult?.order.payAmount ?? 0).toFixed(2) }}</span
            >
          </p>
          <p class="flex-c justify-between text-g-500">
            <span>找零</span>
            <span class="font-medium text-success"
              >¥ {{ (lastResult?.changeAmount ?? 0).toFixed(2) }}</span
            >
          </p>
        </div>
      </div>
      <template #footer>
        <ElButton type="primary" class="w-full" @click="successVisible = false">完成</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import {
    fetchPosContext,
    fetchPosProducts,
    fetchPosCheckout,
    fetchPosSaveHold,
    fetchPosRecentOrders
  } from '@/api/pos'
  import { fetchGetProductOptions } from '@/api/product'
  import { fetchGetStockList } from '@/api/warehouse'
  import { fetchGetMemberByPhone, MEMBER_LEVELS } from '@/api/member'
  import { fetchGetPaymentAccountList } from '@/api/finance'
  import PosHoldDialog from './modules/pos-hold-dialog.vue'

  defineOptions({ name: 'PosCheckout' })

  const contextLoading = ref(true)
  const searching = ref(false)
  const checkingOut = ref(false)
  const tenantName = ref('')
  const cashier = ref('收银员')
  const warehouseId = ref('')
  const warehouses = ref<Api.Warehouse.WarehouseItem[]>([])
  const categories = ref<Api.Product.CategoryItem[]>([])

  const keyword = ref('')
  const activeCategoryId = ref('')
  const searchResults = ref<Api.Pos.CartItem[]>([])
  const optionProductIds = ref<Set<string>>(new Set())

  /** 当前门店货架库存 / 紧急线（用于低库存角标与超卖提示） */
  interface PosStockMeta {
    shelfQuantity: number
    urgentThreshold: number
  }
  const stockMeta = ref<Map<string, PosStockMeta>>(new Map())

  /** 商品列表展示方式（收银员自主选择，记住偏好） */
  type ProductView = 'list' | 'card'
  const PRODUCT_VIEW_KEY = 'pos-product-view'
  const readProductView = (): ProductView => {
    try {
      return localStorage.getItem(PRODUCT_VIEW_KEY) === 'list' ? 'list' : 'card'
    } catch {
      return 'card'
    }
  }
  const productView = ref<ProductView>(readProductView())
  const setProductView = (v: ProductView) => {
    productView.value = v
    try {
      localStorage.setItem(PRODUCT_VIEW_KEY, v)
    } catch {
      /* 忽略存储失败 */
    }
  }

  const cartItems = ref<Api.Pos.CartItem[]>([])
  /** 支付账户编码（cash/wechat/alipay/card/stored/自定义） */
  const payMethod = ref<string>('cash')
  const receivedAmount = ref<number | undefined>(undefined)
  const memberPhone = ref('')
  const memberLoading = ref(false)
  const selectedMember = ref<Api.Member.MemberItem | null>(null)
  const remark = ref('')

  /** 收银可用支付账户（来自 sys_payment_method 启用项） */
  interface PayAccountOption {
    code: string
    name: string
    balance: number
  }
  const DEFAULT_PAY_ACCOUNTS: PayAccountOption[] = [
    { code: 'cash', name: '现金', balance: 0 },
    { code: 'wechat', name: '微信', balance: 0 },
    { code: 'alipay', name: '支付宝', balance: 0 },
    { code: 'card', name: '银行卡', balance: 0 }
  ]
  const payAccounts = ref<PayAccountOption[]>(DEFAULT_PAY_ACCOUNTS)

  /** 组合支付行（code 为支付账户编码，金额之和须等于应收金额） */
  const combinedPayments = ref<Array<{ code: string; amount: number }>>([])

  const holdDialogVisible = ref(false)
  const successVisible = ref(false)
  const lastResult = ref<Api.Pos.CheckoutResult | null>(null)
  const recentOrders = ref<Api.Order.SalesOrder[]>([])

  const searchInputRef = ref<{ focus: () => void }>()

  const now = ref(new Date())
  let clockTimer: number | undefined

  const nowText = computed(() => now.value.toLocaleString('zh-CN', { hour12: false }))

  const totalCount = computed(() => cartItems.value.reduce((sum, it) => sum + it.quantity, 0))

  const totalAmount = computed(
    () =>
      Math.round(cartItems.value.reduce((sum, it) => sum + it.price * it.quantity, 0) * 100) / 100
  )

  /** 会员等级折扣系数（与后端 ums_member_level 一致，普通会员 1 不打折） */
  const memberDiscountRate = computed(() => {
    if (!selectedMember.value) return 1
    return MEMBER_LEVELS.find((l) => l.id === selectedMember.value?.levelId)?.discount ?? 1
  })

  /** 会员优惠金额：优先按商品会员价差额计算，未享受会员价的商品再按等级折扣（与后端结算一致） */
  const memberDiscountAmount = computed(() => {
    if (!selectedMember.value) return 0
    const rate = memberDiscountRate.value
    let vipSum = 0
    let plainSum = 0
    for (const it of cartItems.value) {
      const vip = Number(it.memberPrice) || 0
      if (vip > 0 && vip < it.price) vipSum += (it.price - vip) * it.quantity
      else plainSum += it.price * it.quantity
    }
    const levelPart = rate < 1 ? plainSum * (1 - rate) : 0
    return Math.round((vipSum + levelPart) * 100) / 100
  })

  /** 折扣展示文案，如 0.95 → 9.5折 */
  const discountText = computed(() => {
    const rate = memberDiscountRate.value
    if (rate >= 1) return ''
    const percent = rate * 100
    return Number.isInteger(percent) ? `${percent}折` : `${percent.toFixed(1)}折`
  })

  /** 应收金额 = 合计 - 会员优惠（优惠金额由会员等级折扣自动计算） */
  const payAmount = computed(() =>
    Math.max(Math.round((totalAmount.value - memberDiscountAmount.value) * 100) / 100, 0)
  )

  const changeAmount = computed(() => {
    if (payMethod.value !== 'cash') return 0
    const received = Number(receivedAmount.value) || 0
    return Math.round((received - payAmount.value) * 100) / 100
  })

  const cashLack = computed(
    () => payMethod.value === 'cash' && changeAmount.value < 0 && cartItems.value.length > 0
  )

  /** 会员卡（储值卡）本单需支付金额：单选 stored 为全额，组合支付为行内 stored 之和 */
  const storedAmount = computed(() => {
    if (payMethod.value === 'stored') return cartItems.value.length ? payAmount.value : 0
    if (payMethod.value === 'combined') {
      return (
        Math.round(
          combinedPayments.value
            .filter((r) => r.code === 'stored')
            .reduce((sum, r) => sum + (Number(r.amount) || 0), 0) * 100
        ) / 100
      )
    }
    return 0
  })

  /** 会员卡（储值卡）支付校验：需已关联会员且余额充足 */
  const storedLack = computed(() => {
    const amount = storedAmount.value
    if (amount <= 0) return false
    return !selectedMember.value || amount > selectedMember.value.balance
  })

  const combinedTotal = computed(
    () =>
      Math.round(
        combinedPayments.value.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) * 100
      ) / 100
  )

  /** 组合支付差额（正数=还差，负数=超出） */
  const combinedGap = computed(
    () => Math.round((payAmount.value - combinedTotal.value) * 100) / 100
  )

  /** 进入组合支付：默认第一种账户承载全部应收 */
  watch(payMethod, (v) => {
    if (v === 'combined' && !combinedPayments.value.length) {
      combinedPayments.value = [
        { code: payAccounts.value[0]?.code ?? 'cash', amount: payAmount.value }
      ]
    }
  })

  /** 组合支付仅一行时跟随应收金额变化（多行时由收银员手动拆分） */
  watch(payAmount, (v) => {
    if (payMethod.value === 'combined' && combinedPayments.value.length === 1) {
      combinedPayments.value[0].amount = v
    }
  })

  const toCartItem = (p: Api.Product.ProductItem): Api.Pos.CartItem => ({
    productId: p.id,
    barcode: p.barcode,
    name: p.name,
    unit: p.unit,
    categoryId: p.categoryId,
    price: p.salePrice,
    memberPrice: p.memberPrice,
    image: p.image ?? '',
    quantity: 1,
    stock: p.stock
  })

  /** 拉取当前门店的货架库存与紧急线，用于收银台低库存提示 */
  const loadStockMeta = async () => {
    if (!warehouseId.value) return
    try {
      const page = await fetchGetStockList({
        warehouseId: warehouseId.value,
        current: 1,
        size: 500
      })
      stockMeta.value = new Map(
        page.records.map((item) => [
          item.productId,
          {
            shelfQuantity: item.shelfQuantity,
            urgentThreshold: item.urgentThreshold
          }
        ])
      )
      // 购物车中已加购商品同步最新货架库存，避免使用过期库存判断超卖
      cartItems.value.forEach((item) => {
        const meta = stockMeta.value.get(item.productId)
        if (meta) item.stock = meta.shelfQuantity
      })
    } catch (error) {
      console.error(error)
      stockMeta.value = new Map()
    }
  }

  /** 用当前门店货架库存覆盖商品搜索结果（商品搜索接口的库存口径可能含仓库） */
  const applyStockMeta = (items: Api.Pos.CartItem[]): Api.Pos.CartItem[] =>
    items.map((item) => {
      const meta = stockMeta.value.get(item.productId)
      return meta ? { ...item, stock: meta.shelfQuantity } : item
    })

  /** 货架库存是否已触及紧急线 */
  const isUrgentStock = (item: Api.Pos.CartItem): boolean => {
    const threshold = stockMeta.value.get(item.productId)?.urgentThreshold ?? 0
    return item.stock > 0 && threshold > 0 && item.stock <= threshold
  }

  /** 商品图加载失败时隐藏，回退占位图标 */
  const handleImgError = (e: Event) => {
    const el = (e.target ?? e.currentTarget) as HTMLElement | null
    if (el) el.style.display = 'none'
  }

  const loadContext = async () => {
    contextLoading.value = true
    try {
      const ctx = await fetchPosContext()
      tenantName.value = ctx.tenantName
      cashier.value = ctx.cashier
      warehouses.value = ctx.warehouses.filter((w) => w.status === '1')
      warehouseId.value = ctx.warehouseId
      categories.value = ctx.categories
      await loadStockMeta()
      searchResults.value = applyStockMeta(searchResults.value)
    } catch (error) {
      console.error(error)
    } finally {
      contextLoading.value = false
    }
  }

  const loadRecentOrders = async () => {
    try {
      recentOrders.value = await fetchPosRecentOrders(6)
    } catch (error) {
      console.error(error)
    }
  }

  const addToCart = (item: Api.Pos.CartItem) => {
    if (item.stock <= 0) {
      ElMessage.warning(`商品「${item.name}」当前门店货架无库存`)
      return
    }
    const exist = cartItems.value.find((it) => it.productId === item.productId)
    if (exist) {
      if (exist.quantity + 1 > exist.stock) {
        ElMessage.warning(
          `商品「${item.name}」加入数量已超过货架库存（可售 ${exist.stock}${exist.unit}），请留意超卖风险`
        )
      }
      exist.quantity += 1
    } else {
      cartItems.value.push({ ...item, quantity: 1 })
    }
    ElMessage.success(`已加入购物车：${item.name}`)
  }

  const handleSelectProduct = async (item: Api.Pos.CartItem) => {
    if (optionProductIds.value.has(item.productId)) {
      try {
        const hit = (await fetchPosProducts(item.barcode, warehouseId.value)).find(
          (it) => it.productId === item.productId
        )
        if (hit) return addToCart(hit)
      } catch (error) {
        console.error(error)
      }
    }
    addToCart(item)
  }

  const handleSearch = async () => {
    const kw = keyword.value.trim()
    if (!kw || !warehouseId.value) return
    searching.value = true
    activeCategoryId.value = ''
    try {
      const [, posListRaw, options] = await Promise.all([
        loadStockMeta(),
        fetchPosProducts(kw, warehouseId.value),
        fetchGetProductOptions(kw)
      ])
      const posList = applyStockMeta(posListRaw)
      if (posList.length === 1 && posList[0].barcode === kw) {
        addToCart(posList[0])
        keyword.value = ''
        searchResults.value = []
        optionProductIds.value = new Set()
        return
      }
      const optionItems = applyStockMeta(options.map(toCartItem))
      const extras = optionItems.filter(
        (opt) => !posList.some((pos) => pos.productId === opt.productId)
      )
      optionProductIds.value = new Set(extras.map((it) => it.productId))
      searchResults.value = [...posList, ...extras]
    } catch (error) {
      console.error(error)
    } finally {
      searching.value = false
    }
  }

  /** 收集分类及其全部后代分类 id（点击父级分类时包含子分类商品） */
  const collectCategoryIds = (list: Api.Product.CategoryItem[], targetId: string): Set<string> => {
    const ids = new Set<string>()
    const walk = (nodes: Api.Product.CategoryItem[]) => {
      for (const node of nodes) {
        ids.add(node.id)
        if (node.children?.length) walk(node.children)
      }
    }
    const find = (nodes: Api.Product.CategoryItem[]): boolean => {
      for (const node of nodes) {
        if (node.id === targetId) {
          walk([node])
          return true
        }
        if (node.children?.length && find(node.children)) return true
      }
      return false
    }
    if (!find(list)) ids.add(targetId)
    return ids
  }

  /** 按分类 id 取从根到该节点的完整路径（用于展示一级/二级的从属关系） */
  const findCategoryChain = (
    list: Api.Product.CategoryItem[],
    targetId: string
  ): Api.Product.CategoryItem[] => {
    for (const node of list) {
      if (node.id === targetId) return [node]
      if (node.children?.length) {
        const rest = findCategoryChain(node.children, targetId)
        if (rest.length) return [node, ...rest]
      }
    }
    return []
  }

  /** 当前选中分类的从根路径（空数组表示未筛选分类） */
  const activeCategoryChain = computed(() =>
    activeCategoryId.value ? findCategoryChain(categories.value, activeCategoryId.value) : []
  )

  /** 筛选面包屑：全部分类 › 一级分类 › 二级分类 */
  const activeCategoryBreadcrumb = computed(() =>
    activeCategoryChain.value.length
      ? activeCategoryChain.value.map((node) => ({ id: node.id, label: node.name }))
      : [{ id: '', label: '全部分类' }]
  )

  /** 当前展开二级分类的一级分类（自身或任一后代被选中） */
  const activeRootCategory = computed(() => activeCategoryChain.value[0])

  const handleCategoryClick = async (categoryId: string) => {
    activeCategoryId.value = categoryId
    keyword.value = ''
    searching.value = true
    try {
      const [, options] = await Promise.all([loadStockMeta(), fetchGetProductOptions('')])
      const idSet = categoryId ? collectCategoryIds(categories.value, categoryId) : null
      const filtered = applyStockMeta(options.map(toCartItem))
        .filter((p) => !idSet || idSet.has(p.categoryId))
        .slice(0, 30)
      searchResults.value = filtered
      optionProductIds.value = new Set(searchResults.value.map((it) => it.productId))
    } catch (error) {
      console.error(error)
    } finally {
      searching.value = false
    }
  }

  const handleWarehouseChange = () => {
    keyword.value = ''
    handleCategoryClick(activeCategoryId.value)
  }

  const removeCartItem = (index: number) => {
    cartItems.value.splice(index, 1)
  }

  const changeQuantity = (index: number, delta: number) => {
    const item = cartItems.value[index]
    if (!item) return
    const next = item.quantity + delta
    if (next < 1) return
    if (next > item.stock) {
      ElMessage.warning(`商品「${item.name}」货架库存不足（剩余 ${item.stock}${item.unit}）`)
      return
    }
    item.quantity = next
  }

  /** 按手机号查询并关联会员（对齐后端 GET /members/by-phone，享受等级折扣） */
  const handleMemberSearch = async () => {
    const phone = memberPhone.value.trim()
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      ElMessage.warning('请输入正确的会员手机号')
      return
    }
    memberLoading.value = true
    try {
      const member = await fetchGetMemberByPhone(phone)
      if (!member) {
        ElMessage.warning('未找到该手机号对应的会员')
        return
      }
      if (member.status === '2') {
        ElMessage.warning('该会员已停用，不能享受会员价')
        return
      }
      selectedMember.value = member
      const rate = MEMBER_LEVELS.find((l) => l.id === member.levelId)?.discount ?? 1
      ElMessage.success(
        rate < 1
          ? `会员「${member.name}」已关联，享${member.levelName ?? '会员'}折扣`
          : `会员「${member.name}」已关联`
      )
    } catch (error) {
      console.error(error)
    } finally {
      memberLoading.value = false
    }
  }

  const handleMemberClear = () => {
    selectedMember.value = null
    memberPhone.value = ''
    // 会员卡支付依赖会员，解除关联时回退现金
    if (payMethod.value === 'stored') payMethod.value = 'cash'
  }

  /** 清空购物车 */
  const clearCart = () => {
    if (!cartItems.value.length) return
    cartItems.value = []
    ElMessage.success('已清空购物车')
  }

  /** 组合支付：追加一条支付行，金额默认为剩余应收 */
  const handleAddCombinedRow = () => {
    const used = new Set(combinedPayments.value.map((r) => r.code))
    const next = payAccounts.value.find((a) => !used.has(a.code))
    if (!next) {
      ElMessage.warning('没有可添加的支付方式')
      return
    }
    const remain = Math.max(combinedGap.value, 0)
    combinedPayments.value.push({ code: next.code, amount: remain })
  }

  /** 加载收银支付账户（启用项），失败回退内置四种方式 */
  const loadPayAccounts = async () => {
    try {
      const list = await fetchGetPaymentAccountList()
      const enabled = list.filter((a) => a.status === '1')
      payAccounts.value = enabled.length
        ? enabled.map((a) => ({ code: a.code, name: a.name, balance: a.balance }))
        : DEFAULT_PAY_ACCOUNTS
    } catch (error) {
      console.error(error)
      payAccounts.value = DEFAULT_PAY_ACCOUNTS
    }
    if (!payAccounts.value.some((a) => a.code === payMethod.value)) {
      payMethod.value = payAccounts.value[0]?.code ?? 'cash'
    }
  }

  const resetCheckoutForm = () => {
    cartItems.value = []
    receivedAmount.value = undefined
    handleMemberClear()
    remark.value = ''
    payMethod.value = 'cash'
    combinedPayments.value = []
  }

  const handleCheckout = async () => {
    if (!cartItems.value.length || checkingOut.value) return
    if (!warehouseId.value) {
      ElMessage.warning('请选择销售门店')
      return
    }
    if (payMethod.value === 'cash' && cashLack.value) {
      ElMessage.warning('实收金额不足，请调整实收金额')
      return
    }
    let payments: Api.Pos.CheckoutPayment[]
    if (payMethod.value === 'combined') {
      const rows = combinedPayments.value.filter((r) => Number(r.amount) > 0)
      if (!rows.length) {
        ElMessage.warning('组合支付至少需要填写一条金额大于 0 的支付记录')
        return
      }
      if (Math.abs(combinedGap.value) > 0.005) {
        ElMessage.warning(
          `组合支付收款合计与应收金额不一致（${combinedGap.value > 0 ? '还差' : '超出'} ¥ ${Math.abs(combinedGap.value).toFixed(2)}）`
        )
        return
      }
      payments = rows.map((r) => ({ method: r.code, amount: Number(r.amount) }))
    } else {
      payments = [
        {
          method: payMethod.value,
          amount:
            payMethod.value === 'cash'
              ? Number(receivedAmount.value) || payAmount.value
              : payAmount.value
        }
      ]
    }
    // 会员卡（储值卡）支付校验：单选或组合支付中的 stored 部分
    if (storedAmount.value > 0) {
      if (!selectedMember.value) {
        ElMessage.warning('会员卡（储值卡）支付需先关联会员')
        return
      }
      if (storedAmount.value > selectedMember.value.balance) {
        ElMessage.warning('会员卡余额不足，请更换支付方式或减少商品')
        return
      }
    }
    checkingOut.value = true
    try {
      const result = await fetchPosCheckout({
        items: cartItems.value.map((it) => ({ ...it })),
        payments,
        // 优惠金额由会员等级折扣在结算端计算，前端不再手动填写
        discountAmount: 0,
        memberId: selectedMember.value?.id,
        memberName: selectedMember.value?.name ?? '',
        warehouseId: warehouseId.value,
        cashier: cashier.value,
        remark: remark.value
      })
      lastResult.value = result
      successVisible.value = true
      resetCheckoutForm()
      loadRecentOrders()
      // 结算会扣减货架库存，刷新低库存角标数据
      loadStockMeta().then(() => {
        searchResults.value = applyStockMeta(searchResults.value)
      })
      // 结算会影响账户/会员卡余额，重新拉取支付账户
      loadPayAccounts()
    } catch (error) {
      console.error(error)
    } finally {
      checkingOut.value = false
    }
  }

  const handleSaveHold = async () => {
    if (!cartItems.value.length) return
    try {
      const payment = buildHoldPayment()
      await fetchPosSaveHold(
        cartItems.value.map((it) => ({ ...it })),
        {
          member: selectedMember.value ? { ...selectedMember.value } : undefined,
          remark: remark.value,
          payment
        }
      )
      const saved: string[] = []
      if (selectedMember.value) saved.push('已保存会员信息')
      if (payment) saved.push(`已保存${describeHoldPayment(payment)}`)
      ElMessage.success(saved.length ? `${saved.join('，')}` : '挂单成功')
      resetCheckoutForm()
    } catch (error) {
      console.error(error)
    }
  }

  /** 构造挂单时的支付方式快照 */
  const buildHoldPayment = (): Api.Pos.HoldPayment | undefined => {
    if (payMethod.value === 'combined') {
      return {
        method: 'combined',
        methodName: '组合支付',
        split: combinedPayments.value.map((r) => ({ code: r.code, amount: Number(r.amount) || 0 }))
      }
    }
    const acc = payAccounts.value.find((a) => a.code === payMethod.value)
    return {
      method: payMethod.value,
      methodName: acc?.name ?? payMethod.value,
      receivedAmount: payMethod.value === 'cash' ? receivedAmount.value : undefined
    }
  }

  /** 支付方式快照的展示文案 */
  const describeHoldPayment = (payment: Api.Pos.HoldPayment): string => {
    if (payment.method === 'combined') {
      const parts = (payment.split ?? [])
        .map((r) => payAccounts.value.find((a) => a.code === r.code)?.name ?? r.code)
        .filter(Boolean)
      return parts.length ? `组合支付（${parts.join('+')}）` : '组合支付'
    }
    return `支付方式「${payment.methodName ?? payment.method}」`
  }

  const handleHoldRestored = (hold: Api.Pos.HoldItem) => {
    cartItems.value = hold.items.map((it) => ({ ...it }))
    receivedAmount.value = undefined
    // 恢复挂单时已关联的会员，直接用于结算，无需重新查询
    if (hold.member) {
      selectedMember.value = { ...hold.member }
      memberPhone.value = hold.member.phone
      if (hold.member.status === '2') {
        ElMessage.warning(`会员「${hold.member.name}」已停用，请重新选择会员或取消关联`)
      }
    }
    if (hold.remark) remark.value = hold.remark
    // 恢复挂单时的支付方式，无需重新选择
    const restoredPayment = restoreHoldPayment(hold.payment)
    const tips: string[] = []
    if (restoredPayment) tips.push(`支付方式「${restoredPayment}」已恢复`)
    if (hold.member) tips.push(`会员「${hold.member.name}」`)
    ElMessage.success(
      tips.length ? `已取单「${hold.name}」（${tips.join('，')}）` : `已取单「${hold.name}」`
    )
  }

  /**
   * 恢复挂单时的支付方式
   * - 支付账户已停用/删除时回退到现金，避免结算时找不到对应账户
   * - 组合支付只有一行时跟随恢复后的应收金额（取单后商品/会员可能已变化）
   */
  const restoreHoldPayment = (payment?: Api.Pos.HoldPayment): string | undefined => {
    if (!payment) return undefined

    const enabled = (code: string) => payAccounts.value.some((a) => a.code === code)

    if (payment.method === 'combined') {
      const rows = (payment.split ?? []).filter((r) => r.code && enabled(r.code))
      if (!rows.length) {
        payMethod.value = 'cash'
        return undefined
      }
      payMethod.value = 'combined'
      combinedPayments.value = rows.map((r) => ({ code: r.code, amount: Number(r.amount) || 0 }))
      // 组合支付只有一行时跟随应收金额，多行保留原拆分
      if (rows.length === 1) combinedPayments.value[0].amount = payAmount.value
      return '组合支付'
    }

    if (!enabled(payment.method)) {
      payMethod.value = 'cash'
      return undefined
    }
    payMethod.value = payment.method
    if (payment.method === 'cash' && payment.receivedAmount != null) {
      receivedAmount.value = payment.receivedAmount
    }
    return payment.methodName ?? payment.method
  }

  onMounted(() => {
    loadContext()
    loadRecentOrders()
    loadPayAccounts()
    // 进入页面默认展示全部商品
    handleCategoryClick('')
    clockTimer = window.setInterval(() => {
      now.value = new Date()
    }, 1000)
    nextTick(() => searchInputRef.value?.focus())
  })

  onUnmounted(() => {
    if (clockTimer) window.clearInterval(clockTimer)
  })

  // keep-alive 返回收银台时刷新货架库存（上架 / 其他收银台销售后可能已变化）
  let activatedOnce = false
  onActivated(async () => {
    if (!activatedOnce) {
      activatedOnce = true
      return
    }
    await loadStockMeta()
    searchResults.value = applyStockMeta(searchResults.value)
  })
</script>

<style lang="scss" scoped>
  .pos-topbar {
    height: 56px;
  }

  .pos-view-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    color: var(--art-gray-500);
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    transition:
      color 0.2s,
      background-color 0.2s,
      border-color 0.2s;

    &:hover {
      color: var(--art-primary);
      background: var(--art-gray-100);
    }

    &.is-active {
      color: var(--art-primary);
      background: var(--art-gray-100);
      border-color: var(--art-gray-200);
    }
  }

  .pos-product-item {
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: var(--art-gray-100);
    }
  }

  /* 商品缩略图（卡片 64px / 列表行 40px），无图或加载失败回退占位图标 */
  .pos-thumb {
    position: relative;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    overflow: hidden;
    color: var(--art-gray-400, #9ca3af);
    background: var(--art-gray-100);
    border: 1px solid var(--art-gray-200);
    border-radius: 8px;

    &--sm {
      width: 40px;
      height: 40px;
      border-radius: 6px;
    }

    &__placeholder {
      font-size: 20px;

      .pos-thumb--sm & {
        font-size: 16px;
      }
    }

    &__img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;

      :deep(img) {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }
  }

  .pos-product-grid {
    padding-top: 12px;
  }

  .pos-product-card {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 8px;
    min-height: 104px;
    padding: 10px;
    background: var(--art-gray-100);
    border: 1px solid var(--art-gray-200);
    border-radius: 10px;
    cursor: pointer;
    transition:
      border-color 0.2s,
      box-shadow 0.2s,
      transform 0.1s;

    &:hover {
      border-color: var(--art-primary);
      box-shadow: 0 3px 10px rgb(0 0 0 / 8%);
      transform: translateY(-1px);
    }

    &:active {
      transform: scale(0.97);
    }

    &__add {
      position: absolute;
      top: 8px;
      right: 8px;
      line-height: 1;
    }

    &__head {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-width: 0;
    }

    &__name {
      padding-right: 22px;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      word-break: break-all;
    }

    &__meta {
      margin-top: 3px;
      font-size: 11px;
      color: var(--art-gray-500);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    &__bottom {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 6px;
    }

    &__stock {
      flex-shrink: 0;
      font-size: 11px;
      color: var(--art-gray-500);

      /* 货架库存 ≤ 紧急线：红色角标 */
      &--urgent {
        padding: 1px 7px;
        font-weight: 500;
        color: #fff;
        background: var(--el-color-danger);
        border-radius: 10px;
      }
    }

    &--disabled {
      opacity: 0.55;
      cursor: not-allowed;

      &:hover {
        border-color: var(--art-gray-200);
        box-shadow: none;
        transform: none;
      }
    }
  }

  .pos-cart-item + .pos-cart-item {
    border-top: 1px solid var(--art-gray-200);
  }

  .pos-sub-categories {
    margin-top: 2px;
    padding-left: 12px;
    border-top: 1px dashed var(--art-gray-200);
  }

  .pos-member-card {
    background: var(--art-gray-100);
    border: 1px solid var(--art-gray-200);
  }
</style>
