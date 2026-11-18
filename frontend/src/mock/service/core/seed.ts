/**
 * 超市进销存 Mock 种子数据
 *
 * 首次访问时生成 3 个租户（连锁品牌）的完整演示数据：
 * 商品/分类/供应商/仓库/库存/近 30 天销售订单/采购单/库存单据/退货/财务流水/日结
 */
import avatar1 from '@/assets/images/avatar/avatar1.webp'
import avatar2 from '@/assets/images/avatar/avatar2.webp'
import avatar3 from '@/assets/images/avatar/avatar3.webp'
import avatar4 from '@/assets/images/avatar/avatar4.webp'
import avatar5 from '@/assets/images/avatar/avatar5.webp'
import avatar6 from '@/assets/images/avatar/avatar6.webp'
import avatar7 from '@/assets/images/avatar/avatar7.webp'
import avatar8 from '@/assets/images/avatar/avatar8.webp'
import type { MockDatabase, SystemUser } from './db'
import { asyncRoutes } from '@/router/routes/asyncRoutes'
import type { AppRouteRecord } from '@/types/router'
import {
  dateOfWeek,
  daysAgoStr,
  formatDateTime,
  formatDate,
  genNo,
  hashNum,
  money,
  pick,
  randInt,
  weekStartStr
} from './helpers'
import {
  defaultUrgentThreshold,
  resolveReplenishType,
  resolveStockStatus,
  syncStockDerived
} from './inventory'

const AVATARS = [avatar1, avatar2, avatar3, avatar4, avatar5, avatar6, avatar7, avatar8]

/** 生成菜单种子数据（深拷贝 asyncRoutes，便于持久化后独立增删改） */
export function seedMenus(): AppRouteRecord[] {
  const menus = JSON.parse(JSON.stringify(asyncRoutes)) as AppRouteRecord[]
  const walk = (nodes: AppRouteRecord[]) => {
    nodes.forEach((node) => {
      node.meta.updateTime = formatDateTime(Date.now() - randInt(1, 60) * 86400000)
      if (node.meta.authList?.length) {
        node.meta.authList = node.meta.authList.map((auth, idx) => ({
          ...auth,
          sort: auth.sort ?? idx + 1
        }))
      }
      if (node.children?.length) walk(node.children)
    })
  }
  walk(menus)
  return menus
}

/** 租户（连锁品牌）定义 */
const TENANT_SEEDS = [
  {
    id: 'T001',
    name: '惠家优品超市',
    code: 'HJYP',
    contact: '王建国',
    phone: '13800138001',
    address: '杭州市西湖区文三路 199 号',
    storeNum: 6
  },
  {
    id: 'T002',
    name: '邻里生活超市',
    code: 'LJSH',
    contact: '李慧敏',
    phone: '13800138002',
    address: '宁波市鄞州区四明中路 88 号',
    storeNum: 3
  },
  {
    id: 'T003',
    name: '鲜丰便利连锁',
    code: 'XFBZ',
    contact: '陈晓峰',
    phone: '13800138003',
    address: '上海市闵行区莘庄路 210 号',
    storeNum: 9
  }
]

/** 套餐 */
const PLAN_SEEDS: Array<Omit<Api.Tenant.PlanItem, 'createTime' | 'tenantNum'>> = [
  {
    id: 'P001',
    name: '基础版',
    price: 699,
    duration: 365,
    userLimit: 10,
    storeLimit: 3,
    productLimit: 2000,
    status: '1',
    desc: '适合单店/小型超市，含商品、库存、收银基础能力'
  },
  {
    id: 'P002',
    name: '标准版',
    price: 1999,
    duration: 365,
    userLimit: 50,
    storeLimit: 15,
    productLimit: 20000,
    status: '1',
    desc: '适合连锁门店，含采购、财务报表、多仓库调拨'
  },
  {
    id: 'P003',
    name: '旗舰版',
    price: 5999,
    duration: 365,
    userLimit: 999,
    storeLimit: 99,
    productLimit: 99999,
    status: '1',
    desc: '全功能开放，含多租户数据隔离、开放 API 与专属服务'
  }
]

/** 分类结构 */
const CATEGORY_SEEDS: Array<{ name: string; children?: string[] }> = [
  { name: '粮油调味', children: ['米面杂粮', '食用油', '调味副食'] },
  { name: '休闲零食', children: ['膨化食品', '饼干糕点', '坚果炒货'] },
  { name: '饮料冲调', children: ['碳酸饮料', '茶饮果汁', '冲调饮品'] },
  { name: '生鲜果蔬', children: ['时令水果', '根茎叶菜'] },
  { name: '乳品烘焙', children: ['液态奶', '烘焙面包'] },
  { name: '日用百货', children: ['洗护清洁', '纸品家清'] },
  { name: '酒水饮品', children: ['啤酒白酒', '葡萄酒'] },
  { name: '母婴用品', children: [] }
]

/** 商品缩略图色板 */
const PRODUCT_THUMB_COLORS = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc'
]

/** 生成商品 SVG 缩略图（彩色底 + 首字），mock 数据用 */
const svgThumb = (label: string, color: string): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="12" fill="${color}"/><text x="48" y="58" font-size="40" fill="#ffffff" text-anchor="middle" font-family="sans-serif">${label}</text></svg>`
  )}`

/** 供应商 */
const SUPPLIER_SEEDS = [
  { name: '华东食品供应链有限公司', contact: '赵明', phone: '13905710001' },
  { name: '中粮糖酒浙江分公司', contact: '孙丽', phone: '13905710002' },
  { name: '鲜行农产品直供基地', contact: '周涛', phone: '13905710003' },
  { name: '恒洁日化用品有限公司', contact: '吴娟', phone: '13905710004' },
  { name: '乳悦乳业华东仓', contact: '郑凯', phone: '13905710005' },
  { name: '万佳休闲食品批发', contact: '冯军', phone: '13905710006' }
]

/** 商品目录：[名称, 分类名, 单位, 规格, 进价, 售价] */
const PRODUCT_SEEDS: Array<[string, string, string, string, number, number]> = [
  ['金龙鱼丝苗米', '米面杂粮', '袋', '5kg', 38, 45.9],
  ['福临门东北大米', '米面杂粮', '袋', '10kg', 55, 65.8],
  ['海天金标生抽', '调味副食', '瓶', '500ml', 9, 12.8],
  ['太太乐鸡精', '调味副食', '袋', '100g', 5.5, 7.9],
  ['中盐加碘食盐', '调味副食', '袋', '400g', 1.5, 2],
  ['恒顺香醋', '调味副食', '瓶', '500ml', 6.5, 9.9],
  ['王守义十三香', '调味副食', '盒', '45g', 4, 6],
  ['金龙鱼调和油', '食用油', '桶', '5L', 48, 59.9],
  ['乐事薯片原味', '膨化食品', '袋', '70g', 4.5, 6.5],
  ['奥利奥夹心饼干', '饼干糕点', '盒', '116g', 6, 8.5],
  ['旺旺雪饼', '饼干糕点', '袋', '84g', 3.5, 5],
  ['三只松鼠每日坚果', '坚果炒货', '盒', '750g', 49, 69],
  ['好丽友派', '饼干糕点', '盒', '6枚', 8, 11.5],
  ['盼盼法式小面包', '饼干糕点', '袋', '200g', 6.9, 9.9],
  ['徐福记酥心糖', '坚果炒货', '袋', '260g', 12, 16.8],
  ['农夫山泉饮用水', '碳酸饮料', '箱', '550ml*24', 22, 32],
  ['可口可乐', '碳酸饮料', '罐', '330ml*6', 15, 21],
  ['康师傅冰红茶', '茶饮果汁', '瓶', '500ml', 2.5, 4],
  ['雀巢咖啡 1+2', '冲调饮品', '盒', '15条', 28, 39.9],
  ['统一阿萨姆奶茶', '茶饮果汁', '瓶', '500ml', 3.5, 5],
  ['红富士苹果', '时令水果', '个', '约200g', 2.5, 4.5],
  ['香蕉', '时令水果', 'kg', '散装', 5.9, 7.9],
  ['农家土鸡蛋', '时令水果', '盒', '10枚', 12, 16.8],
  ['本地小白菜', '根茎叶菜', '把', '500g', 2, 3.5],
  ['沙瓤西红柿', '根茎叶菜', 'kg', '散装', 4.5, 6.8],
  ['顶花嫩黄瓜', '根茎叶菜', 'kg', '散装', 3.9, 5.9],
  ['蒙牛特仑苏纯牛奶', '液态奶', '盒', '250ml*12', 49, 65],
  ['光明莫斯利安酸奶', '液态奶', '盒', '200g*8', 25, 35],
  ['桃李切片面包', '烘焙面包', '袋', '400g', 7.9, 10.9],
  ['安佳黄油', '烘焙面包', '块', '227g', 28, 38],
  ['蓝月亮洗衣液', '洗护清洁', '瓶', '3kg', 29.9, 39.9],
  ['舒肤佳沐浴露', '洗护清洁', '瓶', '720ml', 32, 45],
  ['高露洁牙膏', '洗护清洁', '支', '180g', 9, 13.5],
  ['心相印抽纸', '纸品家清', '提', '3层*6包', 15, 21.9],
  ['一次性纸杯', '纸品家清', '包', '50只', 4.5, 6.9],
  ['洁柔卷纸', '纸品家清', '提', '10卷', 19.9, 27.9],
  ['威猛先生洁厕灵', '纸品家清', '瓶', '500ml', 8.5, 12.9],
  ['立白洗洁精', '纸品家清', '瓶', '1.5kg', 12, 16.9],
  ['青岛啤酒', '啤酒白酒', '罐', '330ml*6', 18, 26],
  ['红星二锅头', '啤酒白酒', '瓶', '56度 500ml', 16, 22],
  ['张裕解百纳干红', '葡萄酒', '瓶', '750ml', 68, 98],
  ['江小白表达瓶', '啤酒白酒', '瓶', '100ml', 15, 20],
  ['维达湿巾', '纸品家清', '包', '80抽', 5.5, 8.9]
]

const PAY_METHODS: Api.Order.PayMethod[] = ['cash', 'wechat', 'alipay', 'bank']
const PAY_LABEL: Record<Api.Order.PayMethod, string> = {
  cash: '现金',
  wechat: '微信',
  alipay: '支付宝',
  bank: '银行卡',
  stored: '储值卡'
}

const CASHIERS = ['张倩', '李梦琪', '王浩然', '陈静', '刘子墨']

/** 随机生成一段时间内的时刻 */
const randomTime = (dateStr: string): string =>
  `${dateStr} ${String(randInt(8, 21)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`

/** 会员等级（与 ums_member_level 默认种子一致，discount 为整单折扣系数） */
export const MEMBER_LEVELS: Array<{ id: string; name: string; discount: number }> = [
  { id: '1', name: '普通会员', discount: 1 },
  { id: '2', name: '银卡会员', discount: 0.98 },
  { id: '3', name: '金卡会员', discount: 0.95 },
  { id: '4', name: '钻石会员', discount: 0.9 }
]

/** 会员种子（姓名 + 性别，与 ums_member.gender 0未知/1男/2女 一致） */
const MEMBER_SEEDS: Array<{ name: string; gender: Api.Member.MemberGender }> = [
  { name: '王思远', gender: 1 },
  { name: '李雨桐', gender: 2 },
  { name: '张伟', gender: 1 },
  { name: '陈静怡', gender: 2 },
  { name: '刘洋', gender: 1 },
  { name: '赵梦琪', gender: 2 }
]

/** 生成单个租户的会员与充值记录种子数据 */
export function seedTenantMembers(
  tid: string,
  tenantIdx: number
): { members: Api.Member.MemberItem[]; memberLogs: Api.Member.RechargeLogItem[] } {
  const members: Api.Member.MemberItem[] = []
  const memberLogs: Api.Member.RechargeLogItem[] = []
  const levelPattern = [0, 1, 0, 2, 1, 3]
  const balances = [0, 50, 188.5, 520, 1000, 1500.8]
  const payMethods = ['cash', 'wechat', 'alipay', 'card']

  MEMBER_SEEDS.forEach((seed, idx) => {
    const level = MEMBER_LEVELS[levelPattern[(idx + tenantIdx) % levelPattern.length]]
    const balance = money(balances[(idx + tenantIdx) % balances.length])
    const registerTime = `${daysAgoStr(randInt(60, 420))} ${String(randInt(9, 20)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`
    const member: Api.Member.MemberItem = {
      id: `M${tid}${String(idx + 1).padStart(2, '0')}`,
      tenantId: tid,
      memberNo: `M${tenantIdx + 1}${String(idx + 1).padStart(5, '0')}`,
      name: seed.name,
      phone: `13${String(800000000 + tenantIdx * 10000000 + idx * 1234567)}`,
      gender: seed.gender,
      birthday: daysAgoStr(randInt(7000, 15000)),
      levelId: level.id,
      levelName: level.name,
      points: randInt(0, 600),
      balance,
      totalConsume: 0,
      totalPoints: 0,
      email: idx % 2 === 0 ? `member${tenantIdx + 1}${idx + 1}@example.com` : '',
      address: idx % 3 === 0 ? '浙江省杭州市西湖区文三路 199 号' : '',
      status: idx === 5 ? '2' : '1',
      registerTime,
      createTime: registerTime
    }
    members.push(member)

    if (balance > 0) {
      const charges = idx % 2 === 0 ? [balance] : [money(balance * 0.4), money(balance * 0.6)]
      let before = 0
      charges.forEach((amount, cIdx) => {
        const after = money(before + amount)
        memberLogs.push({
          id: `RL${tid}${idx}${cIdx}`,
          memberId: member.id,
          memberName: member.name,
          type: 1,
          amount,
          giftAmount: 0,
          beforeBalance: before,
          afterBalance: after,
          payMethod: payMethods[(idx + cIdx) % payMethods.length],
          operatorName: '演示店员',
          remark: cIdx === 0 ? '开卡充值' : '活动充值',
          createTime: `${daysAgoStr(randInt(3, 300 - cIdx * 2))} ${String(randInt(9, 20)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}:${String(randInt(0, 59)).padStart(2, '0')}`
        })
        before = after
      })
    }
  })

  return { members, memberLogs }
}

/** 支付账户种子（与后端 sys_payment_method 默认数据对齐） */
const PAYMENT_ACCOUNT_SEEDS: Array<
  Omit<Api.Finance.PaymentAccountItem, 'id' | 'tenantId' | 'createTime' | 'updateTime'>
> = [
  { name: '现金', code: 'cash', sort: 1, status: '1', balance: 1000, remark: '门店备用金' },
  { name: '微信支付', code: 'wechat', sort: 2, status: '1', balance: 0, remark: '' },
  { name: '支付宝', code: 'alipay', sort: 3, status: '1', balance: 0, remark: '' },
  {
    name: '建设银行柘城支行',
    code: 'card',
    sort: 4,
    status: '1',
    balance: 300000,
    remark: '对公账户'
  },
  { name: '会员储值卡', code: 'stored', sort: 5, status: '1', balance: 0, remark: '会员预存余额' }
]

/** 生成单个租户的支付账户种子 */
export function seedTenantPaymentAccounts(tid: string): Api.Finance.PaymentAccountItem[] {
  const createTime = daysAgoStr(120)
  return PAYMENT_ACCOUNT_SEEDS.map((seed, idx) => ({
    ...seed,
    id: `PA${tid}${String(idx + 1).padStart(2, '0')}`,
    tenantId: tid,
    createTime,
    updateTime: createTime
  }))
}

/** 生成全部租户的支付账户种子（供老版本本地数据兼容回填） */
export function seedPaymentAccounts(): Api.Finance.PaymentAccountItem[] {
  return TENANT_SEEDS.flatMap((tenant) => seedTenantPaymentAccounts(tenant.id))
}

/** 生成全部租户的会员种子数据（供老版本本地数据兼容回填） */
export function seedMembers(): Api.Member.MemberItem[] {
  return TENANT_SEEDS.flatMap(
    (tenant, tenantIdx) => seedTenantMembers(tenant.id, tenantIdx).members
  )
}

/** 采购新单据种子上下文 */
interface PurchaseSeedContext {
  centralWhId: string
  storeWhId: string
  products: Api.Product.ProductItem[]
  nextNo: (prefix: string) => string
}

/**
 * 生成采购订单 / 收货单 / 采购退货单演示数据
 *
 * 覆盖状态：
 * - 采购订单：草稿、待审核、已审核、部分收货、已完成、已取消、部分退货、已退货
 * - 收货单：草稿、待审核、已入库、已作废
 * - 采购退货单：草稿、待审核、已退货、已作废
 *
 * 已入库的收货单与已退货的退货单会同步调整库存，保证库存与单据一致。
 */
function seedPurchaseDocuments(db: MockDatabase, tid: string, ctx: PurchaseSeedContext): void {
  const { centralWhId, storeWhId, products, nextNo } = ctx
  if (!products.length) return

  const tenantSuppliers = db.suppliers.filter((s) => s.tenantId === tid)
  if (!tenantSuppliers.length) return

  const storeNameOf = (storeId: string): string =>
    db.warehouses.find((w) => w.id === storeId)?.name ?? ''

  /* -------------------- 采购订单明细构造 -------------------- */
  const makeOrderItems = (
    ordered: number[],
    received: number[] = [],
    returned: number[] = []
  ): Api.Purchase.PurchaseOrderItem[] =>
    ordered.map((orderedQty, idx) => {
      const p = products[idx % products.length]
      return {
        id: nextNo('POI'),
        productId: p.id,
        productName: p.name,
        barcode: p.barcode,
        spec: p.spec,
        unit: p.unit,
        orderedQty,
        receivedQty: received[idx] ?? 0,
        returnedQty: returned[idx] ?? 0,
        purchasePrice: p.purchasePrice,
        totalPrice: money(p.purchasePrice * orderedQty),
        remark: ''
      }
    })

  const createOrder = (
    status: Api.Purchase.PurchaseOrderStatus,
    items: Api.Purchase.PurchaseOrderItem[],
    storeId: string,
    supplierIdx: number,
    days: number
  ): Api.Purchase.PurchaseOrderDetail => {
    const supplier = tenantSuppliers[supplierIdx % tenantSuppliers.length]
    const order: Api.Purchase.PurchaseOrderDetail = {
      id: nextNo('POID'),
      tenantId: tid,
      orderNo: nextNo('PO'),
      supplierId: supplier.id,
      supplierName: supplier.name,
      storeId,
      storeName: storeNameOf(storeId),
      totalAmount: money(items.reduce((s, it) => s + it.totalPrice, 0)),
      totalOrderedQty: items.reduce((s, it) => s + it.orderedQty, 0),
      totalReceivedQty: items.reduce((s, it) => s + it.receivedQty, 0),
      totalReturnedQty: items.reduce((s, it) => s + it.returnedQty, 0),
      status,
      operatorName: '采购部-王强',
      reviewerName: status === 'draft' || status === 'pending_review' ? '' : '店长-Admin',
      reviewTime:
        status === 'draft' || status === 'pending_review' ? '' : daysAgoStr(days) + ' 10:20:00',
      reviewRemark: '',
      finishTime: status === 'completed' ? daysAgoStr(days) + ' 15:40:00' : '',
      remark: '',
      createTime: daysAgoStr(days) + ' 09:15:00',
      items
    }
    db.purchaseOrders.push(order)
    return order
  }

  /* -------------------- 收货单构造 -------------------- */
  const createReceipt = (
    order: Api.Purchase.PurchaseOrderDetail | null,
    status: Api.Purchase.PurchaseReceiptStatus,
    items: Array<{
      orderItemId: string
      productId: string
      quantity: number
      purchasePrice: number
    }>,
    storeId: string,
    days: number
  ): Api.Purchase.PurchaseReceipt => {
    const receiptItems: Api.Purchase.PurchaseReceiptItem[] = items.map((it) => {
      const p = products.find((item) => item.id === it.productId) ?? products[0]
      return {
        id: nextNo('RKI'),
        orderItemId: it.orderItemId,
        productId: p.id,
        productName: p.name,
        barcode: p.barcode,
        spec: p.spec,
        unit: p.unit,
        quantity: it.quantity,
        purchasePrice: it.purchasePrice,
        totalPrice: money(it.purchasePrice * it.quantity),
        batchNo: `B${days}${String(it.productId).slice(-3)}`,
        expireTime: daysAgoStr(days - 180) + ' 00:00:00'
      }
    })
    const receipt: Api.Purchase.PurchaseReceipt = {
      id: nextNo('RKID'),
      tenantId: tid,
      receiptNo: nextNo('RK'),
      orderId: order?.id ?? '',
      orderNo: order?.orderNo ?? '',
      supplierId: order?.supplierId ?? '',
      supplierName: order?.supplierName ?? '',
      storeId,
      storeName: storeNameOf(storeId),
      totalAmount: money(receiptItems.reduce((s, it) => s + it.totalPrice, 0)),
      totalQuantity: receiptItems.reduce((s, it) => s + it.quantity, 0),
      status,
      operatorName: '库管-孙强',
      reviewerName: status === 'draft' || status === 'pending_review' ? '' : '店长-Admin',
      reviewTime:
        status === 'draft' || status === 'pending_review' ? '' : daysAgoStr(days) + ' 11:05:00',
      reviewRemark: '',
      stockInUserName: status === 'stocked_in' ? '库管-孙强' : '',
      stockInTime: status === 'stocked_in' ? daysAgoStr(days) + ' 11:30:00' : '',
      remark: '',
      createTime: daysAgoStr(days) + ' 10:40:00',
      items: receiptItems
    }
    db.purchaseReceipts.push(receipt)
    return receipt
  }

  /* -------------------- 采购退货单构造 -------------------- */
  const createReturn = (
    order: Api.Purchase.PurchaseOrderDetail | null,
    receipt: Api.Purchase.PurchaseReceipt | null,
    status: Api.Purchase.PurchaseReturnStatus,
    items: Array<{
      orderItemId: string
      receiptItemId: string
      productId: string
      quantity: number
      purchasePrice: number
    }>,
    storeId: string,
    days: number
  ): Api.Purchase.PurchaseReturn => {
    const returnItems: Api.Purchase.PurchaseReturnItem[] = items.map((it) => {
      const p = products.find((item) => item.id === it.productId) ?? products[0]
      return {
        id: nextNo('THI'),
        orderItemId: it.orderItemId,
        receiptItemId: it.receiptItemId,
        productId: p.id,
        productName: p.name,
        barcode: p.barcode,
        spec: p.spec,
        unit: p.unit,
        quantity: it.quantity,
        purchasePrice: it.purchasePrice,
        totalPrice: money(it.purchasePrice * it.quantity)
      }
    })
    const ret: Api.Purchase.PurchaseReturn = {
      id: nextNo('THID'),
      tenantId: tid,
      returnNo: nextNo('TH'),
      orderId: order?.id ?? receipt?.orderId ?? '',
      orderNo: order?.orderNo ?? receipt?.orderNo ?? '',
      receiptId: receipt?.id ?? '',
      receiptNo: receipt?.receiptNo ?? '',
      supplierId: order?.supplierId ?? receipt?.supplierId ?? '',
      supplierName: order?.supplierName ?? receipt?.supplierName ?? '',
      storeId,
      storeName: storeNameOf(storeId),
      totalAmount: money(returnItems.reduce((s, it) => s + it.totalPrice, 0)),
      totalQuantity: returnItems.reduce((s, it) => s + it.quantity, 0),
      status,
      operatorName: '采购部-刘颖',
      reviewerName: status === 'draft' || status === 'pending_review' ? '' : '店长-Admin',
      reviewTime:
        status === 'draft' || status === 'pending_review' ? '' : daysAgoStr(days) + ' 16:10:00',
      reviewRemark: '',
      returnTime: status === 'returned' ? daysAgoStr(days) + ' 16:30:00' : '',
      reason: '供应商断货，多余批次退回',
      remark: '',
      createTime: daysAgoStr(days) + ' 15:30:00',
      items: returnItems
    }
    db.purchaseReturns.push(ret)
    return ret
  }

  /* -------------------- 库存联动工具 -------------------- */
  const adjustStock = (warehouseId: string, productId: string, delta: number): void => {
    const row = db.stocks.find((s) => s.warehouseId === warehouseId && s.productId === productId)
    if (!row) return
    row.warehouseQuantity = Math.max(0, Number(row.warehouseQuantity ?? row.quantity ?? 0) + delta)
    syncStockDerived(row)
  }

  /* -------------------- 构造具体单据 -------------------- */
  // 1. 草稿采购订单
  createOrder('draft', makeOrderItems([30, 20]), storeWhId, 0, 2)

  // 2. 待审核采购订单
  createOrder('pending_review', makeOrderItems([25, 35]), storeWhId, 1, 4)

  // 3. 已审核采购订单（尚未收货）
  const approvedOrder = createOrder('approved', makeOrderItems([40, 24]), storeWhId, 2, 6)
  // 追加一条「在途」演示明细：该商品卖场库存为 0，但已有已审核采购单未收货
  const transitProduct = products[7]
  if (transitProduct) {
    const transitQty = 18
    approvedOrder.items.push({
      id: nextNo('POI'),
      productId: transitProduct.id,
      productName: transitProduct.name,
      barcode: transitProduct.barcode,
      spec: transitProduct.spec,
      unit: transitProduct.unit,
      orderedQty: transitQty,
      receivedQty: 0,
      returnedQty: 0,
      purchasePrice: transitProduct.purchasePrice,
      totalPrice: money(transitProduct.purchasePrice * transitQty),
      remark: '在途补货演示'
    })
    approvedOrder.totalOrderedQty += transitQty
    approvedOrder.totalAmount = money(
      approvedOrder.totalAmount + transitProduct.purchasePrice * transitQty
    )
  }

  // 4. 部分收货采购订单（第一行全收，第二行部分收）
  const partialOrder = createOrder(
    'partially_received',
    makeOrderItems([40, 20], [40, 12]),
    storeWhId,
    3,
    8
  )
  const partialReceipt = createReceipt(
    partialOrder,
    'stocked_in',
    partialOrder.items.map((it) => ({
      orderItemId: it.id,
      productId: it.productId,
      quantity: it.receivedQty,
      purchasePrice: it.purchasePrice
    })),
    storeWhId,
    8
  )
  partialReceipt.items.forEach((it) => adjustStock(storeWhId, it.productId, it.quantity))

  // 5. 已完成采购订单（全量收货）
  const completedOrder = createOrder(
    'completed',
    makeOrderItems([30, 18], [30, 18]),
    centralWhId,
    4,
    12
  )
  const completedReceipt = createReceipt(
    completedOrder,
    'stocked_in',
    completedOrder.items.map((it) => ({
      orderItemId: it.id,
      productId: it.productId,
      quantity: it.orderedQty,
      purchasePrice: it.purchasePrice
    })),
    centralWhId,
    12
  )
  completedReceipt.items.forEach((it) => adjustStock(centralWhId, it.productId, it.quantity))

  // 6. 已取消采购订单
  createOrder('canceled', makeOrderItems([15, 12]), storeWhId, 5, 15)

  // 7. 部分退货采购订单（全收，部分退）
  const returnedOrder = createOrder(
    'partially_returned',
    makeOrderItems([36, 20], [36, 20], [10, 0]),
    storeWhId,
    0,
    18
  )
  const returnedReceipt = createReceipt(
    returnedOrder,
    'stocked_in',
    returnedOrder.items.map((it) => ({
      orderItemId: it.id,
      productId: it.productId,
      quantity: it.receivedQty,
      purchasePrice: it.purchasePrice
    })),
    storeWhId,
    18
  )
  returnedReceipt.items.forEach((it) => adjustStock(storeWhId, it.productId, it.quantity))

  // 8. 已退货采购订单（全收全退）
  const fullyReturnedOrder = createOrder(
    'returned',
    makeOrderItems([22], [22], [22]),
    storeWhId,
    1,
    20
  )
  const fullyReturnedReceipt = createReceipt(
    fullyReturnedOrder,
    'stocked_in',
    fullyReturnedOrder.items.map((it) => ({
      orderItemId: it.id,
      productId: it.productId,
      quantity: it.receivedQty,
      purchasePrice: it.purchasePrice
    })),
    storeWhId,
    20
  )
  fullyReturnedReceipt.items.forEach((it) => adjustStock(storeWhId, it.productId, it.quantity))

  /* -------------------- 收货单补充（草稿/待审核/已作废） -------------------- */
  // 草稿收货单：来源已审核采购订单
  createReceipt(
    approvedOrder,
    'draft',
    approvedOrder.items.map((it) => ({
      orderItemId: it.id,
      productId: it.productId,
      quantity: 10,
      purchasePrice: it.purchasePrice
    })),
    storeWhId,
    1
  )

  // 待审核收货单
  createReceipt(
    approvedOrder,
    'pending_review',
    approvedOrder.items.map((it) => ({
      orderItemId: it.id,
      productId: it.productId,
      quantity: 5,
      purchasePrice: it.purchasePrice
    })),
    storeWhId,
    2
  )

  // 已审核（待入库）收货单
  createReceipt(
    approvedOrder,
    'reviewed',
    approvedOrder.items.map((it) => ({
      orderItemId: it.id,
      productId: it.productId,
      quantity: 8,
      purchasePrice: it.purchasePrice
    })),
    storeWhId,
    2
  )

  // 已作废收货单
  createReceipt(
    approvedOrder,
    'voided',
    approvedOrder.items.map((it) => ({
      orderItemId: it.id,
      productId: it.productId,
      quantity: 3,
      purchasePrice: it.purchasePrice
    })),
    storeWhId,
    3
  )

  /* -------------------- 采购退货单补充（草稿/待审核/已退货/已作废） -------------------- */
  // 草稿退货单
  createReturn(
    returnedOrder,
    null,
    'draft',
    [
      {
        orderItemId: returnedOrder.items[1].id,
        receiptItemId: '',
        productId: returnedOrder.items[1].productId,
        quantity: 4,
        purchasePrice: returnedOrder.items[1].purchasePrice
      }
    ],
    storeWhId,
    2
  )

  // 待审核退货单
  createReturn(
    returnedOrder,
    null,
    'pending_review',
    [
      {
        orderItemId: returnedOrder.items[1].id,
        receiptItemId: '',
        productId: returnedOrder.items[1].productId,
        quantity: 2,
        purchasePrice: returnedOrder.items[1].purchasePrice
      }
    ],
    storeWhId,
    3
  )

  // 已退货退货单（对应部分退货采购订单，扣减库存）
  const confirmedReturn = createReturn(
    returnedOrder,
    returnedReceipt,
    'returned',
    [
      {
        orderItemId: returnedOrder.items[0].id,
        receiptItemId: returnedReceipt.items[0].id,
        productId: returnedOrder.items[0].productId,
        quantity: 10,
        purchasePrice: returnedOrder.items[0].purchasePrice
      }
    ],
    storeWhId,
    14
  )
  confirmedReturn.items.forEach((it) => adjustStock(storeWhId, it.productId, -it.quantity))

  // 已审核（待退货）退货单
  createReturn(
    returnedOrder,
    null,
    'reviewed',
    [
      {
        orderItemId: returnedOrder.items[1].id,
        receiptItemId: '',
        productId: returnedOrder.items[1].productId,
        quantity: 3,
        purchasePrice: returnedOrder.items[1].purchasePrice
      }
    ],
    storeWhId,
    4
  )

  // 已作废退货单
  createReturn(
    returnedOrder,
    null,
    'voided',
    [
      {
        orderItemId: returnedOrder.items[1].id,
        receiptItemId: '',
        productId: returnedOrder.items[1].productId,
        quantity: 1,
        purchasePrice: returnedOrder.items[1].purchasePrice
      }
    ],
    storeWhId,
    5
  )
}

/** 上架单种子上下文 */
interface ShelfUpSeedContext {
  storeWhId: string
  products: Api.Product.ProductItem[]
  nextNo: (prefix: string) => string
}

/**
 * 生成上架单演示数据（草稿 / 已上架 / 已撤销）
 *
 * 已上架单会真实地把库存从仓库搬到货架，保证库存与单据一致。
 */
function seedShelfUpDocuments(db: MockDatabase, ctx: ShelfUpSeedContext): void {
  const { storeWhId, products, nextNo } = ctx
  if (products.length < 5) return

  const storeName = db.warehouses.find((w) => w.id === storeWhId)?.name ?? ''

  const createShelfUp = (
    status: Api.Warehouse.ShelfUpStatus,
    productIndexes: number[],
    quantities: number[],
    days: number,
    operatorName: string,
    shelfUpUserName: string
  ): Api.Warehouse.ShelfUpOrder => {
    const items: Api.Warehouse.ShelfUpItem[] = productIndexes.map((productIdx, i) => {
      const product = products[productIdx % products.length]
      const stock = db.stocks.find((s) => s.warehouseId === storeWhId && s.productId === product.id)
      return {
        id: nextNo('SJUI'),
        productId: product.id,
        productName: product.name,
        barcode: product.barcode,
        spec: product.spec,
        unit: product.unit,
        quantity: quantities[i] ?? 1,
        warehouseQuantity: Number(stock?.warehouseQuantity ?? stock?.quantity ?? 0),
        shelfQuantity: Number(stock?.shelfQuantity ?? 0),
        remark: ''
      }
    })
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
    const order: Api.Warehouse.ShelfUpOrder = {
      id: nextNo('SJID'),
      shelfUpNo: nextNo('SJ'),
      storeId: storeWhId,
      storeName,
      totalQuantity,
      status,
      operatorName,
      shelfUpUserName,
      shelfUpTime: status === 'draft' ? '' : `${daysAgoStr(days)} 14:20:00`,
      remark: status === 'rolled_back' ? '盘点后调整陈列，已撤销本次上架' : '',
      createTime: `${daysAgoStr(days)} 13:50:00`,
      items
    }
    db.shelfUps.push(order)
    return order
  }

  // 草稿：已选好商品，等待确认上架
  createShelfUp('draft', [5, 6], [6, 4], 1, '库管-孙强', '')

  // 已上架：执行仓库 → 货架库存转移
  const confirmed = createShelfUp('confirmed', [2, 3], [5, 8], 3, '库管-孙强', '库管-孙强')
  confirmed.items.forEach((item) => {
    const row = db.stocks.find(
      (s) => s.warehouseId === confirmed.storeId && s.productId === item.productId
    )
    if (!row) return
    const moveQty = Math.min(item.quantity, Number(row.warehouseQuantity ?? row.quantity ?? 0))
    row.warehouseQuantity = Number(row.warehouseQuantity ?? row.quantity ?? 0) - moveQty
    row.shelfQuantity = Number(row.shelfQuantity ?? 0) + moveQty
    item.quantity = moveQty
    syncStockDerived(row)
    item.warehouseQuantity = Number(row.warehouseQuantity)
    item.shelfQuantity = Number(row.shelfQuantity)
  })
  confirmed.totalQuantity = confirmed.items.reduce((sum, item) => sum + item.quantity, 0)

  // 已撤销：库存已回到仓库
  createShelfUp('rolled_back', [4], [3], 6, '库管-孙强', '库管-孙强')
}

export function seedDatabase(): MockDatabase {
  const serial: Record<string, number> = {}
  const nextNo = (prefix: string) => {
    serial[prefix] = (serial[prefix] ?? 0) + 1
    return genNo(prefix, serial[prefix])
  }

  const db: MockDatabase = {
    version: 1,
    seq: {},
    menus: seedMenus(),
    plans: PLAN_SEEDS.map((p) => ({ ...p, createTime: daysAgoStr(120), tenantNum: 0 })),
    tenants: [],
    stores: [],
    users: [],
    roles: [],
    categories: [],
    suppliers: [],
    products: [],
    warehouses: [],
    stocks: [],
    stockDocs: [],
    purchases: [],
    purchaseOrders: [],
    purchaseReceipts: [],
    purchaseReturns: [],
    shelfUps: [],
    orders: [],
    members: [],
    memberLogs: [],
    returns: [],
    flows: [],
    dailies: [],
    holds: [],
    paymentMethods: [],
    ...seedScheduleDemo()
  }

  // ---------- 角色 ----------
  db.roles = [
    {
      roleId: 1,
      roleName: '总部超级管理员',
      roleCode: 'R_SUPER',
      description: '拥有全部权限，可管理租户、系统与经营数据',
      enabled: true,
      userNum: 0,
      createTime: daysAgoStr(200)
    },
    {
      roleId: 2,
      roleName: '门店管理员',
      roleCode: 'R_ADMIN',
      description: '管理本门店的商品、采购、库存、订单与财务',
      enabled: true,
      userNum: 0,
      createTime: daysAgoStr(180)
    },
    {
      roleId: 3,
      roleName: '收银员',
      roleCode: 'R_USER',
      description: '仅可使用收银台与查看工作台',
      enabled: true,
      userNum: 0,
      createTime: daysAgoStr(160)
    }
  ]

  const roleButtons: Record<string, string[]> = {
    R_SUPER: ['add', 'edit', 'delete', 'export', 'resetpwd', 'recharge', 'settings'],
    R_ADMIN: ['add', 'edit', 'delete', 'export', 'resetpwd', 'recharge', 'settings'],
    R_USER: []
  }
  db.roles.forEach((role) => {
    role.userNum = 0
  })

  // ---------- 用户（跨租户的演示账号） ----------
  let userSerial = 0
  const createUser = (
    userName: string,
    password: string,
    realName: string,
    roles: string[],
    tenantId: string,
    gender: string,
    warehouseName = ''
  ): SystemUser => {
    userSerial += 1
    return {
      id: userSerial,
      avatar: AVATARS[(userSerial - 1) % AVATARS.length],
      status: '1',
      userName,
      userGender: gender,
      nickName: realName,
      realName,
      userPhone: `138${String(10000000 + userSerial * 13579).slice(0, 8)}`,
      userEmail: `${userName.toLowerCase()}@shopmart.local`,
      userRoles: roles,
      password,
      tenantId,
      createBy: 'system',
      createTime: daysAgoStr(randInt(60, 180)),
      updateBy: 'system',
      updateTime: daysAgoStr(randInt(1, 50)),
      buttons: roles.flatMap((r) => roleButtons[r] ?? []),
      warehouseName
    } as SystemUser
  }

  TENANT_SEEDS.forEach((t, tenantIdx) => {
    db.users.push(
      createUser('Super', '123456', '总部管理员', ['R_SUPER'], t.id, '男'),
      createUser('Admin', '123456', `${t.name}店长`, ['R_ADMIN'], t.id, '男'),
      createUser('Cashier', '123456', '收银员小张', ['R_USER'], t.id, '女'),
      createUser(
        `Admin${tenantIdx + 2}`,
        '123456',
        `区域经理${tenantIdx + 2}`,
        ['R_ADMIN'],
        t.id,
        '女'
      ),
      createUser(
        `Cashier${tenantIdx + 2}`,
        '123456',
        `收银员${tenantIdx + 2}`,
        ['R_USER'],
        t.id,
        '男'
      )
    )
  })
  // 额外的演示账号，便于用户列表分页展示
  for (let i = 0; i < 7; i++) {
    const tenant = TENANT_SEEDS[i % TENANT_SEEDS.length]
    db.users.push(
      createUser(
        `staff${i + 1}`,
        '123456',
        pick(['何佳琪', '杨帆', '罗宇', '宋欣', '许诺', '邓超', '曹雪']),
        i % 3 === 0 ? ['R_ADMIN'] : ['R_USER'],
        tenant.id,
        i % 2 === 0 ? '男' : '女'
      )
    )
  }

  TENANT_SEEDS.forEach((tenant, tenantIdx) => {
    const tid = tenant.id

    // ---------- 租户 ----------
    const planId = PLAN_SEEDS[tenantIdx % PLAN_SEEDS.length].id
    db.tenants.push({
      id: tid,
      name: tenant.name,
      code: tenant.code,
      contact: tenant.contact,
      phone: tenant.phone,
      address: tenant.address,
      status: '1',
      planId,
      planName: PLAN_SEEDS.find((p) => p.id === planId)!.name,
      expireTime: formatDate(new Date(new Date().getFullYear() + 1, 11, 31)),
      storeNum: tenant.storeNum,
      userNum: db.users.filter((u) => u.tenantId === tid).length,
      productNum: PRODUCT_SEEDS.length,
      createTime: daysAgoStr(150 - tenantIdx * 20),
      remark: tenantIdx === 0 ? '集团总部账号，数据含全部门店' : ''
    })

    // ---------- 品牌门店（sys_store） ----------
    const STORE_NAME_POOL = ['旗舰店', '中心店', '社区店', '便民店', '标准店', '会员店', '仓储店']
    for (let s = 0; s < tenant.storeNum; s++) {
      db.stores.push({
        id: `S${tid}${String(s + 1).padStart(2, '0')}`,
        tenantId: tid,
        tenantName: tenant.name,
        storeNo: `${tenant.code}-ST${String(s + 1).padStart(2, '0')}`,
        storeName:
          s === 0
            ? `${tenant.name}${STORE_NAME_POOL[0]}`
            : `${STORE_NAME_POOL[s % STORE_NAME_POOL.length]}`,
        address: tenant.address,
        contactPhone: `13800138${String(100 + s).slice(1)}`,
        storeType: (s % 2 === 0 ? '1' : '2') as Api.Tenant.StoreType,
        businessHours: s % 2 === 0 ? '08:00-22:00' : '07:30-21:30',
        status: '1',
        sort: s + 1,
        remark: '',
        createTime: daysAgoStr(140 - tenantIdx * 20 - s)
      })
    }

    // ---------- 分类 ----------
    const catMap = new Map<string, string>()
    CATEGORY_SEEDS.forEach((root, rootIdx) => {
      const rootId = `C${tid}${rootIdx + 1}`.padEnd(8, '0')
      db.categories.push({
        id: rootId,
        tenantId: tid,
        parentId: null,
        name: root.name,
        sort: (rootIdx + 1) * 10,
        status: '1',
        productNum: 0,
        createTime: daysAgoStr(140),
        children: []
      })
      ;(root.children ?? []).forEach((childName, childIdx) => {
        const childId = `${rootId}-${childIdx + 1}`
        catMap.set(childName, childId)
        db.categories.push({
          id: childId,
          tenantId: tid,
          parentId: rootId,
          name: childName,
          sort: (childIdx + 1) * 10,
          status: '1',
          productNum: 0,
          createTime: daysAgoStr(140)
        })
      })
      catMap.set(root.name, rootId)
    })

    // ---------- 供应商 ----------
    SUPPLIER_SEEDS.forEach((s, idx) => {
      db.suppliers.push({
        id: `S${tid}${idx + 1}`.padEnd(8, '0'),
        tenantId: tid,
        name: s.name,
        contact: s.contact,
        phone: s.phone,
        address: `浙江省杭州市余杭区产业园 ${idx + 1} 号`,
        status: idx === 5 ? '2' : '1',
        productNum: 0,
        remark: '',
        createTime: daysAgoStr(130 - idx)
      })
    })

    // ---------- 仓库 ----------
    const centralWhId = `W${tid}01`.padEnd(8, '0')
    const storeWhId = `W${tid}02`.padEnd(8, '0')
    db.warehouses.push(
      {
        id: centralWhId,
        tenantId: tid,
        name: '中央仓',
        code: `${tenant.code}-WH01`,
        address: `${tenant.address} B1`,
        status: '1',
        isDefault: false,
        stockNum: 0,
        stockValue: 0,
        createTime: daysAgoStr(150)
      },
      {
        id: storeWhId,
        tenantId: tid,
        name: '旗舰店（卖场）',
        code: `${tenant.code}-WH02`,
        address: tenant.address,
        status: '1',
        isDefault: true,
        stockNum: 0,
        stockValue: 0,
        createTime: daysAgoStr(150)
      }
    )

    // ---------- 商品 + 库存 ----------
    const tenantProducts: Api.Product.ProductItem[] = []
    const tenantCategories = db.categories.filter((c) => c.tenantId === tid)
    const catLookup = new Map(tenantCategories.map((c) => [c.id, c]))
    const incCategoryCount = (categoryId: string) => {
      let currentId: string | null = categoryId
      while (currentId) {
        const node = catLookup.get(currentId)
        if (!node) break
        node.productNum += 1
        currentId = node.parentId
      }
    }

    PRODUCT_SEEDS.forEach((p, idx) => {
      const [name, catName, unit, spec, purchasePrice, salePrice] = p
      const categoryId = catMap.get(catName) ?? ''
      const supplierIdx = idx % SUPPLIER_SEEDS.length
      const supplierId = `S${tid}${supplierIdx + 1}`.padEnd(8, '0')
      const barcode = `69${(10000000000 + idx * 7919 + tenantIdx * 1013).toString()}`
      const warningStock = randInt(8, 30)
      const id = `G${tid}${String(idx + 1).padStart(3, '0')}`
      const product: Api.Product.ProductItem = {
        id,
        tenantId: tid,
        barcode,
        name,
        categoryId,
        categoryName: catLookup.get(categoryId)?.name ?? catName,
        supplierId,
        supplierName: SUPPLIER_SEEDS[supplierIdx].name,
        unit,
        spec,
        purchasePrice,
        salePrice,
        memberPrice: money(salePrice * 0.95),
        image: svgThumb(name.slice(0, 1), PRODUCT_THUMB_COLORS[idx % PRODUCT_THUMB_COLORS.length]),
        status: idx % 17 === 5 ? '2' : '1',
        warningStock,
        stock: 0,
        salesNum: randInt(30, 900),
        grossRate: money(((salePrice - purchasePrice) / salePrice) * 100),
        remark: '',
        createTime: daysAgoStr(randInt(80, 140)),
        updateTime: daysAgoStr(randInt(1, 60))
      }
      // 分类/供应商商品计数
      incCategoryCount(categoryId)
      db.suppliers
        .filter((s) => s.tenantId === tid && s.id === supplierId)
        .forEach((s) => (s.productNum += 1))

      // 卖场库存（POS 默认销售仓）+ 中央仓部分备货
      // 第 2、8 个商品初始无卖场库存，保留缺货 / 在途采购演示数据
      const storeQty = idx === 1 || idx === 7 ? 0 : randInt(warningStock, warningStock + 180)
      const centralQty = randInt(0, 80)
      // 卖场库存拆分为「仓库待上架」+「货架可售」，并保留少量缺货/紧急演示数据
      const shelfRatio = idx % 11 === 0 ? 0 : idx % 3 === 0 ? 0.08 : 0.35
      const storeShelfQty = shelfRatio === 0 ? 0 : Math.max(1, Math.round(storeQty * shelfRatio))
      const storeWarehouseQty = storeQty - storeShelfQty
      const storeUrgent = defaultUrgentThreshold(warningStock)
      const storeStatus = resolveStockStatus(storeShelfQty, warningStock, storeUrgent)
      product.stock = storeQty + centralQty

      db.stocks.push(
        {
          id: `K${tid}${idx + 1}A`,
          tenantId: tid,
          warehouseId: storeWhId,
          warehouseName: '旗舰店（卖场）',
          productId: id,
          barcode,
          productName: name,
          categoryId,
          unit,
          warehouseQuantity: storeWarehouseQty,
          shelfQuantity: storeShelfQty,
          pendingInQuantity: 0,
          totalQuantity: storeQty,
          warnThreshold: warningStock,
          urgentThreshold: storeUrgent,
          thresholdOverridden: false,
          stockStatus: storeStatus,
          replenishType:
            storeStatus === 'normal' ? undefined : resolveReplenishType(storeWarehouseQty, 0),
          quantity: storeWarehouseQty,
          safetyStock: warningStock,
          purchasePrice,
          salePrice,
          stockValue: money(storeQty * purchasePrice),
          warning: storeStatus !== 'normal',
          updateTime: formatDateTime()
        },
        {
          id: `K${tid}${idx + 1}B`,
          tenantId: tid,
          warehouseId: centralWhId,
          warehouseName: '中央仓',
          productId: id,
          barcode,
          productName: name,
          categoryId,
          unit,
          // 中央仓只承担备货，不直接产生货架零售库存，阈值为 0 时不参与预警
          warehouseQuantity: centralQty,
          shelfQuantity: 0,
          pendingInQuantity: 0,
          totalQuantity: centralQty,
          warnThreshold: 0,
          urgentThreshold: 0,
          thresholdOverridden: false,
          stockStatus: 'normal',
          replenishType: undefined,
          quantity: centralQty,
          safetyStock: 0,
          purchasePrice,
          salePrice,
          stockValue: money(centralQty * purchasePrice),
          warning: false,
          updateTime: formatDateTime()
        }
      )
      db.products.push(product)
      tenantProducts.push(product)
    })

    // ---------- 会员 + 充值记录 ----------
    const { members: tenantMembers, memberLogs: tenantMemberLogs } = seedTenantMembers(
      tid,
      tenantIdx
    )
    db.members.push(...tenantMembers)
    db.memberLogs.push(...tenantMemberLogs)
    const tenantMemberNames = tenantMembers.map((m) => m.name)

    // ---------- 支付账户 ----------
    db.paymentMethods.push(...seedTenantPaymentAccounts(tid))

    // ---------- 近 30 天销售订单 + 财务流水 ----------
    const activeProducts = tenantProducts.filter((p) => p.status === '1')

    for (let day = 29; day >= 0; day--) {
      const date = daysAgoStr(day)
      const orderCount = randInt(3, 8)

      for (let i = 0; i < orderCount; i++) {
        const itemCount = randInt(1, 5)
        const items: Api.Order.OrderItem[] = []
        const used = new Set<string>()

        for (let k = 0; k < itemCount; k++) {
          const p = pick(activeProducts)
          if (used.has(p.id)) continue
          used.add(p.id)
          const quantity = randInt(1, 3)
          items.push({
            productId: p.id,
            barcode: p.barcode,
            name: p.name,
            unit: p.unit,
            price: p.salePrice,
            quantity,
            amount: money(p.salePrice * quantity),
            refundedQty: 0
          })
        }
        if (!items.length) continue

        const totalAmount = money(items.reduce((sum, it) => sum + it.amount, 0))
        const discountAmount = Math.random() < 0.18 ? money(totalAmount * 0.1) : 0
        const payAmount = money(totalAmount - discountAmount)
        const method = pick(PAY_METHODS)
        // 少量订单作为「已取消」演示数据（可恢复），其余为已完成/部分退款
        const roll = Math.random()
        const status: Api.Order.OrderStatus =
          day > 3 && roll < 0.04 ? 'partial_refund' : day > 2 && roll < 0.07 ? 'cancelled' : 'paid'
        const refundedQtyTarget = status === 'partial_refund' ? items[0] : null
        if (refundedQtyTarget) refundedQtyTarget.refundedQty = 1

        const order: Api.Order.SalesOrder = {
          id: nextNo('OID'),
          tenantId: tid,
          orderNo: nextNo('SO'),
          source: 'pos',
          warehouseId: storeWhId,
          warehouseName: '旗舰店（卖场）',
          items,
          quantity: items.reduce((s, it) => s + it.quantity, 0),
          totalAmount,
          discountAmount,
          payAmount,
          payments: [{ method, amount: payAmount }],
          status,
          memberName:
            tenantMemberNames.length > 0 && Math.random() < 0.25 ? pick(tenantMemberNames) : '',
          cashier: pick(CASHIERS),
          createTime: randomTime(date),
          remark: '',
          ...(status === 'cancelled'
            ? { cancelReason: '客户临时取消', cancelTime: randomTime(date) }
            : {})
        }
        db.orders.push(order)

        // 销售收款流水
        db.flows.push({
          id: nextNo('FID'),
          tenantId: tid,
          flowNo: nextNo('XF'),
          type: 'income',
          category: '销售收款',
          amount: payAmount,
          method: PAY_LABEL[method],
          relatedNo: order.orderNo,
          operator: order.cashier,
          createTime: order.createTime,
          remark: ''
        })

        // 部分退款：生成退款支出流水（种子数据不再回滚库存，仅用于财务口径）
        if (status === 'partial_refund' && refundedQtyTarget) {
          const refundAmount = money(refundedQtyTarget.price)
          db.flows.push({
            id: nextNo('FID'),
            tenantId: tid,
            flowNo: nextNo('TK'),
            type: 'expense',
            category: '销售退款',
            amount: refundAmount,
            method: PAY_LABEL[method],
            relatedNo: order.orderNo,
            operator: order.cashier,
            createTime: formatDateTime(new Date(`${date} 23:00:00`)),
            remark: '部分退款'
          })
        }
      }

      // 运营支出流水
      db.flows.push({
        id: nextNo('FID'),
        tenantId: tid,
        flowNo: nextNo('ZC'),
        type: 'expense',
        category: '水电费用',
        amount: money(randInt(260, 780)),
        method: '银行代扣',
        relatedNo: '',
        operator: '系统',
        createTime: `${date} 09:30:00`,
        remark: ''
      })
      if (day % 7 === 0) {
        db.flows.push(
          {
            id: nextNo('FID'),
            tenantId: tid,
            flowNo: nextNo('ZC'),
            type: 'expense',
            category: '门店租金',
            amount: 12000,
            method: '银行转账',
            relatedNo: '',
            operator: '财务部',
            createTime: `${date} 10:00:00`,
            remark: '月租分摊'
          },
          {
            id: nextNo('FID'),
            tenantId: tid,
            flowNo: nextNo('ZC'),
            type: 'expense',
            category: '人员工资',
            amount: money(randInt(6800, 9800)),
            method: '银行转账',
            relatedNo: '',
            operator: '财务部',
            createTime: `${date} 11:00:00`,
            remark: ''
          }
        )
      }
    }

    // ---------- 汇总会员消费（会员订单 → 累计消费/积分） ----------
    tenantMembers.forEach((member) => {
      const orders = db.orders.filter((o) => o.tenantId === tid && o.memberName === member.name)
      if (!orders.length) return
      member.totalConsume = money(orders.reduce((sum, o) => sum + o.payAmount, 0))
      member.totalPoints = Math.floor(member.totalConsume)
      member.points = member.totalPoints
    })

    // ---------- 采购单 ----------
    for (let i = 0; i < 8; i++) {
      const date = daysAgoStr(randInt(1, 25))
      const supplier = pick(db.suppliers.filter((s) => s.tenantId === tid))
      const items: Api.Purchase.PurchaseItem[] = []
      const count = randInt(2, 5)
      const used = new Set<string>()
      for (let k = 0; k < count; k++) {
        const p = pick(tenantProducts)
        if (used.has(p.id)) continue
        used.add(p.id)
        const quantity = randInt(10, 60)
        items.push({
          productId: p.id,
          barcode: p.barcode,
          productName: p.name,
          unit: p.unit,
          quantity,
          price: p.purchasePrice,
          amount: money(p.purchasePrice * quantity)
        })
      }
      const status: Api.Purchase.PurchaseStatus =
        i === 0 ? 'pending' : i === 1 ? 'canceled' : 'received'
      const totalAmount = money(items.reduce((s, it) => s + it.amount, 0))
      const purchase: Api.Purchase.PurchaseOrder = {
        id: nextNo('PID'),
        tenantId: tid,
        orderNo: nextNo('PO'),
        supplierId: supplier.id,
        supplierName: supplier.name,
        warehouseId: i % 2 === 0 ? centralWhId : storeWhId,
        warehouseName: i % 2 === 0 ? '中央仓' : '旗舰店（卖场）',
        status,
        items,
        quantity: items.reduce((s, it) => s + it.quantity, 0),
        totalAmount,
        operator: pick(['采购部-王强', '采购部-刘颖', '店长-Admin']),
        createTime: randomTime(date),
        receiveTime: status === 'received' ? randomTime(date) : '',
        remark: ''
      }
      db.purchases.push(purchase)

      if (status === 'received') {
        db.flows.push({
          id: nextNo('FID'),
          tenantId: tid,
          flowNo: nextNo('ZC'),
          type: 'expense',
          category: '采购付款',
          amount: totalAmount,
          method: '银行转账',
          relatedNo: purchase.orderNo,
          operator: purchase.operator,
          createTime: purchase.receiveTime,
          remark: ''
        })
        db.stockDocs.push({
          id: nextNo('SDID'),
          tenantId: tid,
          type: 'inbound',
          docNo: nextNo('RK'),
          warehouseId: purchase.warehouseId,
          warehouseName: purchase.warehouseName,
          targetWarehouseId: '',
          targetWarehouseName: '',
          status: 'done',
          items: items.map((it) => ({
            productId: it.productId,
            barcode: it.barcode,
            productName: it.productName,
            unit: it.unit,
            quantity: it.quantity,
            price: it.price
          })),
          totalQty: purchase.quantity,
          operator: purchase.operator,
          createTime: purchase.createTime,
          finishTime: purchase.receiveTime,
          remark: `采购入库 ${purchase.orderNo}`
        })
      }
    }

    // ---------- 采购订单 / 收货单 / 采购退货单（新采购业务模型） ----------
    seedPurchaseDocuments(db, tid, {
      centralWhId,
      storeWhId,
      products: tenantProducts,
      nextNo
    })

    // ---------- 上架单（仓库 → 货架） ----------
    seedShelfUpDocuments(db, {
      storeWhId,
      products: tenantProducts,
      nextNo
    })

    // ---------- 退货单 ----------
    const refundedOrders = db.orders.filter(
      (o) => o.tenantId === tid && o.status === 'partial_refund'
    )
    const returnsSource = refundedOrders.length
      ? refundedOrders
      : db.orders.filter((o) => o.tenantId === tid).slice(0, 6)
    returnsSource.slice(0, 5).forEach((order, idx) => {
      const item = order.items[0]
      const quantity = idx % 2 === 0 ? 1 : Math.min(2, item.quantity)
      const refundAmount = money(item.price * quantity)
      const date = order.createTime.slice(0, 10)
      db.returns.push({
        id: nextNo('RTID'),
        tenantId: tid,
        returnNo: nextNo('TH'),
        orderId: order.id,
        orderNo: order.orderNo,
        warehouseId: order.warehouseId,
        warehouseName: order.warehouseName,
        items: [
          {
            productId: item.productId,
            barcode: item.barcode,
            name: item.name,
            unit: item.unit,
            price: item.price,
            quantity,
            amount: refundAmount
          }
        ],
        refundAmount,
        refundMethod: order.payments[0]?.method ?? 'cash',
        status: idx === 4 ? 'rejected' : 'completed',
        reason: pick(['商品破损', '顾客不满意', '临近保质期', '买重了']),
        operator: pick(CASHIERS),
        createTime: formatDateTime(new Date(`${date} 18:30:00`))
      })
      if (idx !== 4) {
        db.flows.push({
          id: nextNo('FID'),
          tenantId: tid,
          flowNo: nextNo('TK'),
          type: 'expense',
          category: '销售退款',
          amount: refundAmount,
          method: PAY_LABEL[order.payments[0]?.method ?? 'cash'],
          relatedNo: order.orderNo,
          operator: pick(CASHIERS),
          createTime: formatDateTime(new Date(`${date} 18:35:00`)),
          remark: '退货退款'
        })
      }
    })

    // ---------- 其它库存单据 ----------
    const docDate = daysAgoStr(randInt(2, 10))
    const outSample = activeProducts.slice(0, 3)
    db.stockDocs.push(
      {
        id: nextNo('SDID'),
        tenantId: tid,
        type: 'outbound',
        docNo: nextNo('CK'),
        warehouseId: storeWhId,
        warehouseName: '旗舰店（卖场）',
        targetWarehouseId: '',
        targetWarehouseName: '',
        status: 'done',
        items: outSample.map((p) => ({
          productId: p.id,
          barcode: p.barcode,
          productName: p.name,
          unit: p.unit,
          quantity: randInt(2, 8),
          price: p.purchasePrice
        })),
        totalQty: 0,
        operator: '库管-孙强',
        createTime: randomTime(docDate),
        finishTime: randomTime(docDate),
        remark: '报损出库'
      },
      {
        id: nextNo('SDID'),
        tenantId: tid,
        type: 'transfer',
        docNo: nextNo('DB'),
        warehouseId: centralWhId,
        warehouseName: '中央仓',
        targetWarehouseId: storeWhId,
        targetWarehouseName: '旗舰店（卖场）',
        status: 'done',
        items: activeProducts.slice(3, 6).map((p) => ({
          productId: p.id,
          barcode: p.barcode,
          productName: p.name,
          unit: p.unit,
          quantity: randInt(5, 20),
          price: p.purchasePrice
        })),
        totalQty: 0,
        operator: '库管-孙强',
        createTime: randomTime(docDate),
        finishTime: randomTime(docDate),
        remark: '补货调拨'
      },
      {
        id: nextNo('SDID'),
        tenantId: tid,
        type: 'stocktake',
        docNo: nextNo('PD'),
        warehouseId: storeWhId,
        warehouseName: '旗舰店（卖场）',
        targetWarehouseId: '',
        targetWarehouseName: '',
        status: 'draft',
        items: activeProducts.slice(6, 9).map((p) => ({
          productId: p.id,
          barcode: p.barcode,
          productName: p.name,
          unit: p.unit,
          quantity: randInt(10, 50),
          price: p.purchasePrice,
          actualQuantity: randInt(8, 50)
        })),
        totalQty: 0,
        operator: '库管-孙强',
        createTime: formatDateTime(),
        finishTime: '',
        remark: '月度盘点'
      }
    )
    db.stockDocs.forEach((doc) => {
      if (doc.totalQty === 0) {
        doc.totalQty = doc.items.reduce((s, it) => s + it.quantity, 0)
      }
    })
  })

  // ---------- 日结（近 14 天按流水汇总，今天为待结算） ----------
  db.tenants.forEach((tenant) => {
    const tid = tenant.id
    for (let day = 14; day >= 0; day--) {
      const date = daysAgoStr(day)
      const flows = db.flows.filter((f) => f.tenantId === tid && f.createTime.startsWith(date))
      const income = money(
        flows.filter((f) => f.type === 'income').reduce((s, f) => s + f.amount, 0)
      )
      const refund = money(
        flows
          .filter((f) => f.type === 'expense' && f.category === '销售退款')
          .reduce((s, f) => s + f.amount, 0)
      )
      const expense = money(
        flows.filter((f) => f.type === 'expense').reduce((s, f) => s + f.amount, 0)
      )
      const orderCount = db.orders.filter(
        (o) => o.tenantId === tid && o.createTime.startsWith(date)
      ).length
      if (!flows.length && day > 0) continue
      db.dailies.push({
        id: nextNo('DID'),
        tenantId: tid,
        date,
        salesAmount: income,
        refundAmount: refund,
        incomeAmount: income,
        expenseAmount: expense,
        netAmount: money(income - expense),
        orderCount,
        status: day === 0 ? 'pending' : 'settled',
        operator: day === 0 ? '' : '财务部',
        createTime: day === 0 ? '' : formatDateTime(new Date(`${date} 23:30:00`))
      })
    }
  })

  // 重新统计租户商品/用户数量
  db.tenants.forEach((t) => {
    t.productNum = db.products.filter((p) => p.tenantId === t.id).length
    t.userNum = db.users.filter((u) => u.tenantId === t.id).length
  })

  // 角色用户数
  db.roles.forEach((role) => {
    role.userNum = db.users.filter((u) => u.userRoles.includes(role.roleCode)).length
  })

  db.seq = serial
  return db
}

/* ==========================================================================
 * 排班模块演示数据（前端先行版）
 * TODO(BACKEND): 门店应取自 sys_store、员工应取自 sys_user（按 store_id + status 过滤），
 *                此处使用固定演示数据以保证前端独立可运行。
 * TODO(DB): shifts/schedules/scheduleItems/changeRequests 对应
 *           sch_shift / sch_schedule / sch_schedule_item / sch_shift_change
 * ========================================================================== */

/** 演示门店 */
export const SCHEDULE_STORES: Api.Schedule.StoreOption[] = [
  { id: 'S101', name: '阳光超市旗舰店', businessHours: '08:00-22:00' },
  { id: 'S102', name: '阳光超市中心店', businessHours: '07:30-21:30' }
]

/** 演示员工（当前登录者固定为 u1 张三） */
export const SCHEDULE_EMPLOYEES: Api.Schedule.EmployeeOption[] = [
  { id: 'u1', name: '张三', role: '收银员', storeId: 'S101' },
  { id: 'u2', name: '李四', role: '收银员', storeId: 'S101' },
  { id: 'u3', name: '王五', role: '收银员', storeId: 'S101' },
  { id: 'u4', name: '赵六', role: '库管员', storeId: 'S101' },
  { id: 'u5', name: '钱七', role: '收银员', storeId: 'S101' },
  { id: 'u6', name: '孙八', role: '理货员', storeId: 'S101' },
  { id: 'u7', name: '周九', role: '收银员', storeId: 'S102' },
  { id: 'u8', name: '吴十', role: '店员', storeId: 'S102' }
]

/** 当前登录员工（我的排班视角） */
export const SCHEDULE_CURRENT_USER = 'u1'

/** 班次模板（早 / 晚 / 跨夜夜班） */
export function seedShifts(): Api.Schedule.ShiftItem[] {
  return [
    {
      id: 'sh1', name: '早班', code: 'MORNING', start: '08:00', end: '16:00',
      crossDay: false, color: '#3D7FFF', minStaff: 2, role: '收银员',
      rest: 30, sort: 1, enabled: true, remark: '开业高峰，至少 2 人在岗'
    },
    {
      id: 'sh2', name: '晚班', code: 'EVENING', start: '16:00', end: '22:00',
      crossDay: false, color: '#2ED3B7', minStaff: 2, role: '收银员',
      rest: 20, sort: 2, enabled: true
    },
    {
      id: 'sh3', name: '夜班', code: 'NIGHT', start: '22:00', end: '06:00',
      crossDay: true, color: '#7C5CFF', minStaff: 1, role: '值班',
      rest: 60, sort: 3, enabled: true, remark: '闭店盘点与补货，次日 06:00 下班'
    }
  ]
}

/** 生成一周演示排班明细：含 1 处冲突 + 若干缺员，便于直观看到校验效果 */
export function buildDemoWeekItems(storeId: string, weekStart: string, shifts: Api.Schedule.ShiftItem[]) {
  const scheduleId = `${storeId}_${weekStart}`
  const pool = SCHEDULE_EMPLOYEES.filter((e) => e.storeId === storeId)
  const items: Api.Schedule.ScheduleItem[] = []
  if (!pool.length || !shifts.length) return { scheduleId, items }

  for (let di = 0; di < 7; di++) {
    const date = dateOfWeek(weekStart, di)
    shifts.forEach((shift, si) => {
      const seed = `${storeId}-${weekStart}-${di}-${si}`
      if (hashNum(seed) % 11 === 0) return // 故意留空缺 → 缺员提示
      const count = shift.minStaff + (hashNum(`${seed}-n`) % 2)
      const picked = new Set<string>()
      for (let i = 0; i < count; i++) {
        picked.add(pool[(hashNum(`${seed}-${i}`) + i) % pool.length].id)
      }
      picked.forEach((userId) => {
        const emp = SCHEDULE_EMPLOYEES.find((e) => e.id === userId)!
        items.push({
          id: `IT_${scheduleId}_${date}_${shift.id}_${userId}`,
          scheduleId, date, shiftId: shift.id, userId,
          roleCode: emp.role, source: 'manual'
        })
      })
    })
  }

  // 本周周一：张三同时出现在早班与晚班 → 冲突演示
  if (weekStart === weekStartStr(0) && storeId === 'S101') {
    const monday = dateOfWeek(weekStart, 0)
    const conflict: Api.Schedule.ScheduleItem = {
      id: `IT_${scheduleId}_${monday}_sh2_u1`,
      scheduleId, date: monday, shiftId: 'sh2', userId: 'u1',
      roleCode: '收银员', source: 'manual'
    }
    if (!items.some((i) => i.id === conflict.id)) items.push(conflict)
    if (!items.some((i) => i.date === monday && i.shiftId === 'sh1' && i.userId === 'u1')) {
      items.push({
        id: `IT_${scheduleId}_${monday}_sh1_u1`,
        scheduleId, date: monday, shiftId: 'sh1', userId: 'u1',
        roleCode: '收银员', source: 'manual'
      })
    }
  }

  return { scheduleId, items }
}

/** 排班四张集合的首次演示数据 */
export function seedScheduleDemo(): {
  shifts: Api.Schedule.ShiftItem[]
  schedules: Api.Schedule.WeekSchedule[]
  scheduleItems: Api.Schedule.ScheduleItem[]
  changeRequests: Api.Schedule.ChangeItem[]
} {
  const shifts = seedShifts()
  const weekStart = weekStartStr(0)
  const { scheduleId, items } = buildDemoWeekItems('S101', weekStart, shifts)

  const schedules: Api.Schedule.WeekSchedule[] = [
    { id: scheduleId, storeId: 'S101', weekStart, status: 'draft', items: [] }
  ]

  const changeRequests: Api.Schedule.ChangeItem[] = [
    {
      id: 'CH1', storeId: 'S101', applicantId: 'u2', applicantName: '李四',
      targetUserId: 'u3', targetUserName: '王五', date: dateOfWeek(weekStart, 2),
      shiftId: 'sh2', changeType: 2, reason: '家中有事，已与王五协商替班',
      status: 0, createTime: formatDateTime()
    },
    {
      id: 'CH2', storeId: 'S101', applicantId: 'u5', applicantName: '钱七',
      targetUserId: 'u4', targetUserName: '赵六', date: dateOfWeek(weekStart, 5),
      shiftId: 'sh1', changeType: 1, reason: '周末调休，双方互换班次',
      status: 0, createTime: formatDateTime()
    },
    {
      id: 'CH3', storeId: 'S101', applicantId: 'u6', applicantName: '孙八',
      targetUserId: 'u1', targetUserName: '张三', date: dateOfWeek(weekStart, 0),
      shiftId: 'sh3', changeType: 2, reason: '身体不适，申请替班',
      status: 1, reviewerName: '李店长', reviewTime: formatDateTime(),
      createTime: formatDateTime()
    }
  ]

  return { shifts, schedules, scheduleItems: items, changeRequests }
}
