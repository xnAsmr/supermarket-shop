/**
 * API 接口类型定义模块
 *
 * 提供所有后端接口的类型定义（当前由本地 Mock Service 提供数据，接入真实后端后类型不变）
 *
 * ## 主要功能
 *
 * - 通用类型（分页参数、响应结构等）
 * - 认证类型（登录、用户信息等）
 * - 超市进销存业务类型（商品、采购、订单、仓库、财务、租户等）
 * - 全局命名空间声明
 *
 * ## 使用方式
 *
 * ```typescript
 * const params: Api.Auth.LoginParams = { userName: 'admin', password: '123456' }
 * const response: Api.Auth.UserInfo = await fetchUserInfo()
 * ```
 *
 * @module types/api/api
 * @author Art Design Pro Team
 */

declare namespace Api {
  /** 通用类型 */
  namespace Common {
    /** 分页参数 */
    interface PaginationParams {
      /** 当前页码 */
      current: number
      /** 每页条数 */
      size: number
      /** 总条数 */
      total: number
    }

    /** 通用搜索参数 */
    type CommonSearchParams = Pick<PaginationParams, 'current' | 'size'>

    /** 分页响应基础结构 */
    interface PaginatedResponse<T = any> {
      records: T[]
      current: number
      size: number
      total: number
    }

    /** 启用状态 */
    type EnableStatus = '1' | '2'

    /** 通用选项 */
    interface OptionItem {
      label: string
      value: string | number
      disabled?: boolean
    }
  }

  /** 认证类型 */
  namespace Auth {
    /** 登录参数 */
    interface LoginParams {
      userName: string
      password: string
    }

    /** 登录响应 */
    interface LoginResponse {
      token: string
      refreshToken: string
    }

    /** 用户信息 */
    interface UserInfo {
      buttons: string[]
      roles: string[]
      userId: number
      userName: string
      realName?: string
      email: string
      avatar?: string
      phone?: string
      tenantId?: string
      warehouseId?: string
      warehouseName?: string
    }

    /** 开发环境调试账号（GET /api/v1/auth/dev/accounts，仅 dev profile 返回） */
    interface DevLoginAccount {
      username: string
      realName: string
      tenantId: string
      tenantName: string
      storeId: string
      storeName: string
      userType: number
    }
  }

  /** 系统管理类型 */
  namespace SystemManage {
    /** 用户列表 */
    type UserList = Api.Common.PaginatedResponse<UserListItem>

    /** 用户列表项 */
    interface UserListItem {
      id: number
      avatar: string
      status: string
      userName: string
      userGender: string
      nickName: string
      userPhone: string
      userEmail: string
      userRoles: string[]
      /** 角色名称（用于界面展示，如"店长"；userRoles 仍为角色编码契约） */
      userRoleNames?: string[]
      /** 用户类型：1-普通用户 2-系统管理员 3-超级管理员（仅超管可见/可改） */
      userType?: number
      tenantId: string
      tenantName?: string
      createBy: string
      createTime: string
      updateBy: string
      updateTime: string
    }

    /** 用户搜索参数 */
    type UserSearchParams = Partial<
      Pick<
        UserListItem,
        'id' | 'userName' | 'userGender' | 'userPhone' | 'userEmail' | 'status' | 'tenantId'
      > &
        Api.Common.CommonSearchParams
    >

    /** 角色列表 */
    type RoleList = Api.Common.PaginatedResponse<RoleListItem>

    /** 角色范围：1=租户私有（仅本租户可用） 2=平台共享（所有租户均可用，仅超管可维护） 3=平台内置（仅超管可见可用，如系统管理员） */
    type RoleScope = 1 | 2 | 3

    /** 角色列表项 */
    interface RoleListItem {
      roleId: number
      roleName: string
      roleCode: string
      description: string
      enabled: boolean
      /** 角色范围：1=租户私有 2=平台共享（所有租户均可用，仅超管可维护） 3=平台内置（仅超管可用） */
      roleScope?: Api.SystemManage.RoleScope
      userNum?: number
      createTime: string
      /** 已授权的菜单权限节点（树 node-key：路由 name 与 `${name}_${authMark}`） */
      roleMenus?: string[]
    }

    /** 角色搜索参数 */
    type RoleSearchParams = Partial<
      Pick<RoleListItem, 'roleId' | 'roleName' | 'roleCode' | 'description' | 'enabled'> &
        Api.Common.CommonSearchParams & {
          startTime: string | null
          endTime: string | null
        }
    >
  }

  /** 多租户（连锁品牌/门店）类型 */
  namespace Tenant {
    /** 租户状态 */
    type TenantStatus = '1' | '2' | '3'

    /** 租户列表项 */
    interface TenantItem {
      id: string
      name: string
      code: string
      contact: string
      phone: string
      address: string
      status: TenantStatus
      planId: string
      planName: string
      expireTime: string
      storeNum: number
      userNum: number
      productNum: number
      createTime: string
      remark: string
    }

    /** 租户列表 */
    type TenantList = Api.Common.PaginatedResponse<TenantItem>

    /** 租户搜索参数 */
    type TenantSearchParams = Partial<
      Pick<TenantItem, 'name' | 'code' | 'status' | 'planId'> & Api.Common.CommonSearchParams
    >

    /** 租户切换选项（顶栏切换器） */
    interface TenantOption {
      id: string
      name: string
      code: string
      status: TenantStatus
    }

    /** 套餐项 */
    interface PlanItem {
      id: string
      name: string
      price: number
      duration: number
      userLimit: number
      storeLimit: number
      productLimit: number
      status: Api.Common.EnableStatus
      desc: string
      tenantNum?: number
      createTime: string
    }

    /** 套餐列表 */
    type PlanList = Api.Common.PaginatedResponse<PlanItem>

    /** 套餐搜索参数 */
    type PlanSearchParams = Partial<
      Pick<PlanItem, 'name' | 'status'> & Api.Common.CommonSearchParams
    >

    /** 品牌门店（sys_store）状态：'1' 营业 / '2' 装修 / '3' 暂停 / '4' 关闭（后端 1/0/2/3） */
    type StoreStatus = '1' | '2' | '3' | '4'

    /** 品牌门店类型：'1' 直营 / '2' 加盟（后端 1/2） */
    type StoreType = '1' | '2'

    /** 品牌门店列表项（sys_store） */
    interface StoreItem {
      id: string
      tenantId: string
      tenantName?: string
      storeNo: string
      storeName: string
      address: string
      contactPhone: string
      managerId?: string
      storeType: StoreType
      businessHours: string
      status: StoreStatus
      sort: number
      remark: string
      createTime: string
    }

    /** 品牌门店列表 */
    type StoreList = Api.Common.PaginatedResponse<StoreItem>

    /** 品牌门店搜索参数 */
    type StoreSearchParams = Partial<
      Pick<StoreItem, 'storeName' | 'storeNo' | 'status' | 'tenantId'> &
        Api.Common.CommonSearchParams
    >

    /** 品牌门店表单（新增/编辑），id 可选用于编辑定位 */
    type StoreForm = Partial<
      Pick<
        StoreItem,
        | 'id'
        | 'storeName'
        | 'address'
        | 'contactPhone'
        | 'storeType'
        | 'businessHours'
        | 'sort'
        | 'remark'
        | 'tenantId'
        | 'status'
      >
    >
  }

  /** 平台管理（系统管理员工作台）类型 */
  namespace Platform {
    /** 统计构成项（套餐分布 / 状态分布） */
    interface StatItem {
      name: string
      count: number
    }

    /** 月开通趋势项 */
    interface TrendItem {
      month: string
      count: number
    }

    /** 即将到期租户项 */
    interface ExpiringTenant {
      id: string
      tenantName: string
      expireTime: string
      planType: string
    }

    /** 平台统计（GET /api/v1/admin/tenants/stats） */
    interface Stats {
      totalTenants: number
      activeTenants: number
      totalStores: number
      totalUsers: number
      planTypeDistribution: StatItem[]
      statusDistribution: StatItem[]
      monthlyTrend: TrendItem[]
      expiringTenants: ExpiringTenant[]
    }
  }

  /** 商品管理类型 */
  namespace Product {
    /** 商品分类（树形，支持二级） */
    interface CategoryItem {
      id: string
      tenantId: string
      parentId: string | null
      name: string
      sort: number
      status: Api.Common.EnableStatus
      productNum: number
      createTime: string
      children?: CategoryItem[]
    }

    /** 分类搜索参数 */
    type CategorySearchParams = Partial<Pick<CategoryItem, 'name' | 'status'>>

    /** 供应商列表项 */
    interface SupplierItem {
      id: string
      tenantId: string
      name: string
      contact: string
      phone: string
      address: string
      status: Api.Common.EnableStatus
      productNum: number
      remark: string
      createTime: string
    }

    /** 供应商列表 */
    type SupplierList = Api.Common.PaginatedResponse<SupplierItem>

    /** 供应商搜索参数 */
    type SupplierSearchParams = Partial<
      Pick<SupplierItem, 'name' | 'contact' | 'phone' | 'status'> & Api.Common.CommonSearchParams
    >

    /** 品牌列表项 */
    interface BrandItem {
      id: string
      tenantId: string
      name: string
      logo?: string
      description?: string
      status: Api.Common.EnableStatus
      sort: number
      createTime: string
    }

    /** 品牌搜索参数 */
    type BrandSearchParams = Partial<
      Pick<BrandItem, 'name' | 'status'> & Api.Common.CommonSearchParams
    >

    /** 商品列表项（SKU 级别） */
    interface ProductItem {
      id: string
      tenantId: string
      barcode: string
      name: string
      categoryId: string
      categoryName: string
      supplierId: string
      supplierName: string
      brandId?: string
      brandName?: string
      unit: string
      spec: string
      purchasePrice: number
      salePrice: number
      memberPrice: number
      /** 商品图片（后端 /api/v1/upload/file/ 相对路径或完整 URL） */
      image?: string
      status: Api.Common.EnableStatus
      warningStock: number
      /** 库存紧急线（商品默认，后端 stockUrgentThreshold） */
      stockUrgentThreshold?: number
      stock: number
      /** 货架库存（已上架、可直接销售的数量），缺省按 0 处理 */
      shelfQuantity?: number
      salesNum: number
      grossRate: number
      remark: string
      createTime: string
      updateTime: string
    }

    /** 商品列表 */
    type ProductList = Api.Common.PaginatedResponse<ProductItem>

    /** 商品搜索参数 */
    type ProductSearchParams = Partial<
      Pick<
        ProductItem,
        'name' | 'barcode' | 'categoryId' | 'supplierId' | 'status' | 'purchasePrice' | 'salePrice'
      > &
        Api.Common.CommonSearchParams
    >

    /** 商品表单（新增/编辑） */
    type ProductForm = Omit<
      ProductItem,
      | 'tenantId'
      | 'categoryName'
      | 'supplierName'
      | 'brandName'
      | 'stock'
      | 'salesNum'
      | 'grossRate'
      | 'createTime'
      | 'updateTime'
    >

    /** 价格历史记录（建档与调价快照，memberPrice=0 表示无会员价） */
    interface PriceHistoryItem {
      id: string
      purchasePrice: number
      salePrice: number
      memberPrice: number
      /** create=建档 edit=调价 */
      source: 'create' | 'edit'
      createTime: string
    }
  }

  /** 仓库与库存类型 */
  namespace Warehouse {
    /** 单据类型 */
    type StockDocType = 'inbound' | 'outbound' | 'transfer' | 'stocktake'

    /** 单据状态
     * - draft 草稿（待审核）
     * - reviewed 已审核（待入库/待出库）
     * - done 已完成
     * - canceled 已取消
     */
    type StockDocStatus = 'draft' | 'reviewed' | 'done' | 'canceled'

    /** 仓库列表项 */
    interface WarehouseItem {
      id: string
      tenantId: string
      name: string
      code: string
      address: string
      status: Api.Common.EnableStatus
      isDefault: boolean
      stockNum: number
      stockValue: number
      createTime: string
    }

    /** 库存预警状态
     * - normal 正常
     * - warning 预警（货架 ≤ 预警线）
     * - urgent 紧急（货架 ≤ 紧急线）
     * - out_of_stock 缺货（货架 = 0）
     */
    type StockStatus = 'normal' | 'warning' | 'urgent' | 'out_of_stock'

    /** 补货方式
     * - shelf_up 仓库有货，可直接上架
     * - in_transit 仓库无货但在途有货，等收货
     * - purchase 仓库与在途都没有，需采购
     */
    type ReplenishType = 'shelf_up' | 'in_transit' | 'purchase'

    /** 库存记录项 */
    interface StockItem {
      id: string
      tenantId: string
      warehouseId: string
      warehouseName: string
      productId: string
      barcode: string
      productName: string
      categoryId: string
      unit: string
      /** 仓库库存 */
      warehouseQuantity: number
      /** 货架库存（收银台可售） */
      shelfQuantity: number
      /** 在途库存（已下单未收货） */
      pendingInQuantity: number
      /** 仓库 + 货架 */
      totalQuantity: number
      /** 生效预警线 */
      warnThreshold: number
      /** 生效紧急线 */
      urgentThreshold: number
      /** 阈值是否被门店覆盖 */
      thresholdOverridden: boolean
      /** 预警状态 */
      stockStatus: StockStatus
      /** 补货方式（仅预警时有值） */
      replenishType?: ReplenishType
      /** 兼容旧字段：= warehouseQuantity */
      quantity: number
      /** 兼容旧字段：= warnThreshold */
      safetyStock: number
      purchasePrice: number
      salePrice: number
      stockValue: number
      warning: boolean
      updateTime: string
    }

    /** 库存列表 */
    type StockList = Api.Common.PaginatedResponse<StockItem>

    /** 库存搜索参数 */
    type StockSearchParams = Partial<
      Pick<
        StockItem,
        'warehouseId' | 'productId' | 'barcode' | 'productName' | 'categoryId' | 'warning'
      > & {
        /** 预警筛选：warning=全部预警，urgent=紧急，out_of_stock=缺货 */
        warnLevel?: 'warning' | 'urgent' | 'out_of_stock'
      } & Api.Common.CommonSearchParams
    >

    /** 上架单状态：0草稿 1已上架 2已撤销 */
    type ShelfUpStatus = 'draft' | 'confirmed' | 'rolled_back'

    /** 上架单明细 */
    interface ShelfUpItem {
      id: string
      productId: string
      productName: string
      barcode: string
      spec: string
      unit: string
      /** 本次上架数量 */
      quantity: number
      /** 当前仓库库存 */
      warehouseQuantity: number
      /** 当前货架库存 */
      shelfQuantity: number
      remark: string
    }

    /** 上架单 */
    interface ShelfUpOrder {
      id: string
      shelfUpNo: string
      storeId: string
      storeName: string
      totalQuantity: number
      status: ShelfUpStatus
      operatorName: string
      shelfUpUserName: string
      shelfUpTime: string
      remark: string
      createTime: string
      items: ShelfUpItem[]
    }

    /** 上架单列表 */
    type ShelfUpOrderList = Api.Common.PaginatedResponse<ShelfUpOrder>

    /** 上架单搜索参数 */
    type ShelfUpSearchParams = Partial<{
      shelfUpNo: string
      storeId: string
      status: ShelfUpStatus
      startTime: string
      endTime: string
    }> &
      Api.Common.CommonSearchParams

    /** 单据明细 */
    interface StockDocItem {
      productId: string
      barcode: string
      productName: string
      unit: string
      quantity: number
      price: number
      /** 盘点实际数量 */
      actualQuantity?: number
    }

    /** 库存单据（入库/出库/调拨/盘点） */
    interface StockDoc {
      id: string
      tenantId: string
      type: StockDocType
      docNo: string
      warehouseId: string
      warehouseName: string
      targetWarehouseId: string
      targetWarehouseName: string
      status: StockDocStatus
      items: StockDocItem[]
      totalQty: number
      operator: string
      createTime: string
      finishTime: string
      remark: string
      /** 采购入库单：供应商名称 */
      supplierName?: string
      /** 采购入库单：审核人 */
      reviewerName?: string
      /** 采购入库单：审核时间 */
      reviewTime?: string
      /** 采购入库单：入库人 */
      stockInUserName?: string
      /** 采购入库单：总金额 */
      totalAmount?: number
      /** 采购入库单：来源采购订单号（手动入库为空） */
      sourceOrderNo?: string
    }

    /** 库存单据列表 */
    type StockDocList = Api.Common.PaginatedResponse<StockDoc>

    /** 库存单据搜索参数 */
    type StockDocSearchParams = Partial<
      Pick<StockDoc, 'type' | 'docNo' | 'warehouseId' | 'status'> & Api.Common.CommonSearchParams
    >
  }

  /** 采购管理类型 */
  namespace Purchase {
    /** 采购单状态 */
    type PurchaseStatus = 'pending' | 'received' | 'canceled'

    /** 采购明细 */
    interface PurchaseItem {
      productId: string
      barcode: string
      productName: string
      unit: string
      quantity: number
      price: number
      amount: number
    }

    /** 采购单 */
    interface PurchaseOrder {
      id: string
      tenantId: string
      orderNo: string
      supplierId: string
      supplierName: string
      warehouseId: string
      warehouseName: string
      status: PurchaseStatus
      items: PurchaseItem[]
      quantity: number
      totalAmount: number
      operator: string
      createTime: string
      receiveTime: string
      remark: string
    }

    /** 采购单列表 */
    type PurchaseList = Api.Common.PaginatedResponse<PurchaseOrder>

    /** 采购单搜索参数 */
    type PurchaseSearchParams = Partial<
      Pick<
        PurchaseOrder,
        'orderNo' | 'supplierId' | 'warehouseId' | 'status' | 'startTime' | 'endTime'
      > &
        Api.Common.CommonSearchParams & {
          startTime?: string
          endTime?: string
        }
    >

    /* ------------------------------------------------------------------ *
     * 新采购业务模型（采购订单 / 收货单 / 采购退货单）
     * 对应后端 pms_purchase_order、wms_purchase_receipt、pms_purchase_return
     * ------------------------------------------------------------------ */

    /** 采购订单状态
     * - draft 草稿
     * - pending_review 待审核
     * - approved 已审核
     * - partially_received 部分收货
     * - completed 已完成
     * - canceled 已取消
     * - partially_returned 部分退货
     * - returned 已退货
     */
    type PurchaseOrderStatus =
      | 'draft'
      | 'pending_review'
      | 'approved'
      | 'partially_received'
      | 'completed'
      | 'canceled'
      | 'partially_returned'
      | 'returned'

    /** 收货单状态
     * - draft 草稿
     * - pending_review 待审核
     * - reviewed 已审核（待入库）
     * - stocked_in 已入库（已生效）
     * - voided 已作废
     */
    type PurchaseReceiptStatus = 'draft' | 'pending_review' | 'reviewed' | 'stocked_in' | 'voided'

    /** 采购退货单状态
     * - draft 草稿
     * - pending_review 待审核
     * - reviewed 已审核（待退货）
     * - returned 已退货（已生效）
     * - voided 已作废
     */
    type PurchaseReturnStatus = 'draft' | 'pending_review' | 'reviewed' | 'returned' | 'voided'

    /** 采购订单明细 */
    interface PurchaseOrderItem {
      id: string
      productId: string
      productName: string
      barcode: string
      spec: string
      unit: string
      /** 订购数量 */
      orderedQty: number
      /** 已收数量 */
      receivedQty: number
      /** 已退数量 */
      returnedQty: number
      /** 采购单价 */
      purchasePrice: number
      /** 小计金额 */
      totalPrice: number
      remark: string
    }

    /** 采购订单 */
    interface PurchaseOrderDetail {
      id: string
      tenantId: string
      orderNo: string
      supplierId: string
      supplierName: string
      storeId: string
      storeName: string
      totalAmount: number
      totalOrderedQty: number
      totalReceivedQty: number
      totalReturnedQty: number
      status: PurchaseOrderStatus
      operatorName: string
      reviewerName: string
      reviewTime: string
      reviewRemark: string
      finishTime: string
      remark: string
      createTime: string
      items: PurchaseOrderItem[]
    }

    /** 采购订单列表 */
    type PurchaseOrderList = Api.Common.PaginatedResponse<PurchaseOrderDetail>

    /** 采购订单搜索参数 */
    type PurchaseOrderSearchParams = Partial<
      Pick<PurchaseOrderDetail, 'orderNo' | 'supplierId' | 'storeId' | 'status'> &
        Api.Common.CommonSearchParams & {
          startTime?: string
          endTime?: string
        }
    >

    /** 收货单明细 */
    interface PurchaseReceiptItem {
      id: string
      /** 来源采购订单明细ID（手工收货为空） */
      orderItemId: string
      productId: string
      productName: string
      barcode: string
      spec: string
      unit: string
      /** 本次实收数量 */
      quantity: number
      purchasePrice: number
      totalPrice: number
      batchNo: string
      expireTime: string
    }

    /** 收货单 */
    interface PurchaseReceipt {
      id: string
      tenantId: string
      receiptNo: string
      orderId: string
      orderNo: string
      supplierId: string
      supplierName: string
      storeId: string
      storeName: string
      totalAmount: number
      totalQuantity: number
      status: PurchaseReceiptStatus
      operatorName: string
      reviewerName: string
      reviewTime: string
      reviewRemark: string
      stockInUserName: string
      stockInTime: string
      remark: string
      createTime: string
      items: PurchaseReceiptItem[]
    }

    /** 收货单列表 */
    type PurchaseReceiptList = Api.Common.PaginatedResponse<PurchaseReceipt>

    /** 收货单搜索参数 */
    type PurchaseReceiptSearchParams = Partial<
      Pick<PurchaseReceipt, 'receiptNo' | 'orderNo' | 'supplierId' | 'storeId' | 'status'> &
        Api.Common.CommonSearchParams & {
          startTime?: string
          endTime?: string
        }
    >

    /** 采购退货单明细 */
    interface PurchaseReturnItem {
      id: string
      /** 来源采购订单明细ID */
      orderItemId: string
      /** 来源收货单明细ID（按收货单退货时记录） */
      receiptItemId: string
      productId: string
      productName: string
      barcode: string
      spec: string
      unit: string
      /** 本次退货数量 */
      quantity: number
      purchasePrice: number
      totalPrice: number
    }

    /** 采购退货单 */
    interface PurchaseReturn {
      id: string
      tenantId: string
      returnNo: string
      orderId: string
      orderNo: string
      receiptId: string
      receiptNo: string
      supplierId: string
      supplierName: string
      storeId: string
      storeName: string
      totalAmount: number
      totalQuantity: number
      status: PurchaseReturnStatus
      operatorName: string
      reviewerName: string
      reviewTime: string
      reviewRemark: string
      returnTime: string
      reason: string
      remark: string
      createTime: string
      items: PurchaseReturnItem[]
    }

    /** 采购退货单列表 */
    type PurchaseReturnList = Api.Common.PaginatedResponse<PurchaseReturn>

    /** 采购退货单搜索参数 */
    type PurchaseReturnSearchParams = Partial<
      Pick<
        PurchaseReturn,
        'returnNo' | 'orderNo' | 'receiptNo' | 'supplierId' | 'storeId' | 'status'
      > &
        Api.Common.CommonSearchParams & {
          startTime?: string
          endTime?: string
        }
    >
  }

  /** 订单管理类型 */
  namespace Order {
    /** 支付方式（stored 为会员储值卡/会员卡，由 sys_payment_method.code 演化而来） */
    type PayMethod = 'cash' | 'wechat' | 'alipay' | 'bank' | 'stored'

    /**
     * 订单状态（与后端 order_status 对齐）
     * - paid 已支付/已完成
     * - partial_refund 部分退款
     * - refunded 已全额退款
     * - cancelled 已取消（逻辑删除，可恢复）
     */
    type OrderStatus = 'paid' | 'partial_refund' | 'refunded' | 'cancelled'

    /** 销售订单明细 */
    interface OrderItem {
      productId: string
      barcode: string
      name: string
      unit: string
      price: number
      quantity: number
      amount: number
      /** 已退数量（可退数量 = quantity - refundedQty） */
      refundedQty: number
    }

    /** 支付记录 */
    interface PaymentRecord {
      method: PayMethod
      amount: number
    }

    /** 销售订单 */
    interface SalesOrder {
      id: string
      tenantId: string
      orderNo: string
      source: 'pos'
      warehouseId: string
      warehouseName: string
      items: OrderItem[]
      quantity: number
      totalAmount: number
      discountAmount: number
      payAmount: number
      payments: PaymentRecord[]
      status: OrderStatus
      memberName: string
      cashier: string
      createTime: string
      remark: string
      /** 取消原因（已取消订单可见） */
      cancelReason?: string
      /** 取消时间 */
      cancelTime?: string
      /** 恢复时间 */
      restoreTime?: string
      /** 取消时实际冲减的会员累计消费（恢复时按此精确回加） */
      revertConsume?: number
      /** 取消时实际冲减的会员积分（恢复时按此精确回加） */
      revertPoints?: number
    }

    /** 销售订单列表 */
    type SalesList = Api.Common.PaginatedResponse<SalesOrder>

    /** 销售订单搜索参数 */
    type SalesSearchParams = Partial<
      Pick<SalesOrder, 'orderNo' | 'status' | 'warehouseId' | 'cashier' | 'startTime' | 'endTime'> &
        Api.Common.CommonSearchParams & {
          startTime?: string
          endTime?: string
          keyword?: string
        }
    >

    /** 退货单状态 */
    type ReturnStatus = 'pending' | 'completed' | 'rejected' | 'cancelled'

    /** 退货明细 */
    interface ReturnItem {
      productId: string
      barcode: string
      name: string
      unit: string
      price: number
      quantity: number
      amount: number
    }

    /** 退货单 */
    interface ReturnOrder {
      id: string
      tenantId: string
      returnNo: string
      orderId: string
      orderNo: string
      warehouseId: string
      warehouseName: string
      items: ReturnItem[]
      refundAmount: number
      refundMethod: PayMethod
      status: ReturnStatus
      reason: string
      operator: string
      createTime: string
      /** 退款时实际冲减的会员累计消费（作废时按此精确回加） */
      revertConsume?: number
      /** 退款时实际冲减的会员积分（作废时按此精确回加） */
      revertPoints?: number
    }

    /** 退货单列表 */
    type ReturnList = Api.Common.PaginatedResponse<ReturnOrder>

    /** 退货单搜索参数 */
    type ReturnSearchParams = Partial<
      Pick<ReturnOrder, 'returnNo' | 'orderNo' | 'status'> & Api.Common.CommonSearchParams
    >
  }

  /** 会员管理类型 */
  namespace Member {
    /** 会员性别（与后端 ums_member.gender 一致：0 未知 / 1 男 / 2 女） */
    type MemberGender = 0 | 1 | 2

    /** 会员列表项（后端 MemberVO） */
    interface MemberItem {
      id: string
      tenantId: string
      memberNo: string
      name: string
      phone: string
      gender: MemberGender
      /** 生日 YYYY-MM-DD（后端返回 yyyy-MM-dd HH:mm:ss） */
      birthday?: string
      levelId?: string
      levelName?: string
      points: number
      balance: number
      totalConsume: number
      totalPoints: number
      email?: string
      address?: string
      status: Api.Common.EnableStatus
      registerTime?: string
      createTime?: string
    }

    /** 会员列表 */
    type MemberList = Api.Common.PaginatedResponse<MemberItem>

    /** 会员搜索参数（后端 MemberQueryDTO：keyword/levelId/status） */
    type MemberSearchParams = Partial<
      Pick<MemberItem, 'status'> &
        Api.Common.CommonSearchParams & {
          keyword?: string
          levelId?: string
        }
    >

    /** 新增/编辑会员入参（后端 MemberCreateDTO） */
    interface MemberUpsertPayload {
      name: string
      phone: string
      gender: MemberGender
      /** YYYY-MM-DD（提交时转 yyyy-MM-dd HH:mm:ss） */
      birthday?: string
      levelId?: string
      email?: string
      address?: string
    }

    /** 会员充值入参（PUT /members/{id}/recharge） */
    interface RechargePayload {
      /** 充值金额 */
      amount: number
      /** 赠送金额 */
      giftAmount?: number
      /** 支付方式编码：cash/wechat/alipay/card */
      payMethod?: string
      remark?: string
    }

    /** 充值记录（后端 MemberRechargeLog） */
    interface RechargeLogItem {
      id: string
      memberId: string
      memberName?: string
      /** 1-充值 2-消费抵扣 */
      type?: number
      amount: number
      giftAmount: number
      beforeBalance: number
      afterBalance: number
      payMethod?: string
      operatorName?: string
      remark?: string
      createTime: string
    }

    /** 充值记录列表 */
    type RechargeLogList = Api.Common.PaginatedResponse<RechargeLogItem>

    /** 消费记录（后端 MemberConsumeLogVO，储值卡支付订单） */
    interface ConsumeLogItem {
      id: string
      orderNo: string
      amount: number
      payAmount: number
      payMethod?: string
      payMethodName?: string
      orderStatus: number
      orderStatusName?: string
      orderTime?: string
      storeName?: string
    }

    /** 消费记录列表 */
    type ConsumeLogList = Api.Common.PaginatedResponse<ConsumeLogItem>

    /** 记录查询参数 */
    type LogSearchParams = Api.Common.CommonSearchParams
  }

  /** 收银台（POS）类型 */
  namespace Pos {
    /** 购物车项 */
    interface CartItem {
      productId: string
      barcode: string
      name: string
      unit: string
      categoryId: string
      price: number
      memberPrice: number
      /** 商品图片 */
      image?: string
      quantity: number
      stock: number
      discount?: number
    }

    /** 结算支付记录（method 为支付账户编码：cash/wechat/alipay/card/stored/自定义） */
    interface CheckoutPayment {
      method: string
      amount: number
    }

    /** 结算参数 */
    interface CheckoutParams {
      items: CartItem[]
      payments: CheckoutPayment[]
      discountAmount: number
      /** 关联会员 ID（收银台按手机号查询后传入，后端按等级折扣结算） */
      memberId?: string
      memberName: string
      warehouseId: string
      cashier: string
      remark?: string
    }

    /** 结算结果 */
    interface CheckoutResult {
      order: Order.SalesOrder
      changeAmount: number
    }

    /** 挂单时的支付方式快照（取单后直接恢复，无需重新选择） */
    interface HoldPayment {
      /** 支付账户编码（cash/wechat/alipay/card/stored/自定义）；'combined' 表示组合支付 */
      method: string
      /** 支付账户名称（展示用，账户被停用时仍可辨认原方式） */
      methodName?: string
      /** 组合支付各行金额（method 为 'combined' 时有效） */
      split?: Array<{ code: string; amount: number }>
      /** 现金实收金额（method 为 'cash' 时有效） */
      receivedAmount?: number
    }

    /** 挂单 */
    interface HoldItem {
      id: string
      tenantId: string
      name: string
      items: CartItem[]
      totalAmount: number
      quantity: number
      /** 挂单时已关联的会员快照（取单后直接恢复，无需重新查询） */
      member?: Member.MemberItem
      /** 挂单时的备注 */
      remark?: string
      /** 挂单时的支付方式快照 */
      payment?: HoldPayment
      createdAt: string
    }
  }

  /** 财务管理类型 */
  namespace Finance {
    /** 流水类型 */
    type FlowType = 'income' | 'expense'

    /** 收支流水 */
    interface FlowItem {
      id: string
      tenantId: string
      flowNo: string
      type: FlowType
      category: string
      amount: number
      method: string
      relatedNo: string
      operator: string
      createTime: string
      remark: string
    }

    /** 流水列表 */
    type FlowList = Api.Common.PaginatedResponse<FlowItem>

    /** 流水搜索参数 */
    type FlowSearchParams = Partial<
      Pick<FlowItem, 'type' | 'category' | 'flowNo' | 'relatedNo'> &
        Api.Common.CommonSearchParams & {
          startTime?: string
          endTime?: string
        }
    >

    /** 日结单 */
    interface DailyItem {
      id: string
      tenantId: string
      date: string
      salesAmount: number
      refundAmount: number
      incomeAmount: number
      expenseAmount: number
      netAmount: number
      orderCount: number
      status: 'settled' | 'pending'
      operator: string
      createTime: string
    }

    /** 日结列表 */
    type DailyList = Api.Common.PaginatedResponse<DailyItem>

    /** 日结搜索参数 */
    type DailySearchParams = Partial<
      Pick<DailyItem, 'date' | 'status'> & Api.Common.CommonSearchParams
    >

    /** 报表汇总 */
    interface ReportSummary {
      income: number
      expense: number
      net: number
      orderCount: number
      refundAmount: number
      avgOrderAmount: number
    }

    /** 报表趋势项 */
    interface ReportTrendItem {
      date: string
      income: number
      expense: number
      net: number
    }

    /** 报表分类构成项 */
    interface ReportCategoryItem {
      name: string
      amount: number
      ratio: number
      type: FlowType
    }

    /** 财务报表 */
    interface ReportData {
      summary: ReportSummary
      trend: ReportTrendItem[]
      incomeCategory: ReportCategoryItem[]
      expenseCategory: ReportCategoryItem[]
    }

    /** 支付账户（后端 sys_payment_method：收银结算按支付方式记账/累加余额） */
    interface PaymentAccountItem {
      id: string
      tenantId?: string
      name: string
      /** 支付编码：cash/wechat/alipay/card/stored 或自定义 */
      code: string
      icon?: string
      sort: number
      status: Api.Common.EnableStatus
      balance: number
      remark?: string
      createTime?: string
      updateTime?: string
    }

    /** 支付账户新增/编辑入参 */
    interface PaymentAccountUpsertPayload {
      id?: string
      name: string
      code: string
      sort?: number
      status?: Api.Common.EnableStatus
      remark?: string
    }
  }

  /** 工作台/驾驶舱类型 */
  namespace Dashboard {
    /** 统计卡片 */
    interface Stats {
      todaySales: number
      todayOrders: number
      todayProfit: number
      todayAov: number
      monthSales: number
      monthGrowth: number
      lowStockCount: number
      returnCount: number
    }

    /** 趋势项 */
    interface TrendItem {
      date: string
      sales: number
      orders: number
      profit: number
    }

    /** 销售总览趋势点（柱线组合图，日/周/月/年） */
    interface SalesTrendPoint {
      /** X 轴标签（日=MM-DD，周=周一 MM-DD，月=N月，年=yyyy） */
      label: string
      /** 订单总量 */
      orders: number
      /** 销售总额 */
      sales: number
      /** 营收（毛利） */
      profit: number
    }

    /** 会员累计消费排行项（经营驾驶舱「会员客户」区域） */
    interface MemberRankItem {
      id: string
      name: string
      phone: string
      levelName?: string
      /** 累计消费金额 */
      totalConsume: number
    }

    /** 热销商品项 */
    interface HotItem {
      productId: string
      name: string
      /** 商品图片（相对 URL，如 /api/v1/upload/file/product/xxx.png，可为空） */
      image?: string
      /** 售价 */
      price?: number
      quantity: number
      amount: number
      /** 货架库存（库存状态推导用，缺省时按 0 处理） */
      shelfQuantity?: number
      /** 仓库库存（库存状态推导用，缺省时按 0 处理） */
      warehouseQuantity?: number
    }

    /** 门店/租户排行项 */
    interface RankItem {
      name: string
      amount: number
      orders: number
    }

    /** 驾驶舱聚合数据 */
    interface Overview {
      stats: Stats
      trend: TrendItem[]
      hotProducts: HotItem[]
      rankList: RankItem[]
      lowStock: Warehouse.StockItem[]
      recentOrders: Order.SalesOrder[]
    }
  }

  /**
   * 排班模块
   * 对应后端 sch_shift / sch_schedule / sch_schedule_item / sch_shift_change 四张表。
   * 所有 id 均为字符串，避免后端 Long 精度丢失。
   */
  namespace Schedule {
    /** 班次模板（sch_shift） */
    interface ShiftItem {
      id: string
      /** 归属门店；为空表示租户通用班次 */
      storeId?: string
      name: string
      code: string
      start: string
      end: string
      /** 是否跨夜（end <= start） */
      crossDay: boolean
      /** 班次卡片配色 */
      color: string
      /** 最低在岗人数，发布前校验 */
      minStaff: number
      role: string
      /** 休息分钟数，用于工时统计 */
      rest: number
      sort: number
      enabled: boolean
      remark?: string
    }

    /** 周班表状态：草稿 / 已发布 / 已归档 */
    type WeekStatus = 'draft' | 'published' | 'archived'

    /** 周班表（sch_schedule） */
    interface WeekSchedule {
      id: string
      storeId: string
      /** 周一日期 yyyy-MM-dd */
      weekStart: string
      status: WeekStatus
      publishTime?: string
      /** 发布人姓名（未发布时为空） */
      publisherName?: string
      items: ScheduleItem[]
    }

    /** 排班明细（sch_schedule_item） */
    interface ScheduleItem {
      id: string
      scheduleId: string
      /** 营业日 yyyy-MM-dd（跨夜班记开始日） */
      date: string
      shiftId: string
      userId: string
      /** 岗位快照 */
      roleCode: string
      /** 来源：手工 / 复制上周 / 调班生成 */
      source: 'manual' | 'copy' | 'change'
    }

    /** 调班类型：1 换班 2 替班 3 请假 */
    type ChangeType = 1 | 2 | 3
    /** 审批状态：0 待审批 1 已通过 2 已拒绝 */
    type ChangeStatus = 0 | 1 | 2

    /** 调班申请（sch_shift_change） */
    interface ChangeItem {
      id: string
      storeId: string
      applicantId: string
      applicantName: string
      targetUserId: string
      targetUserName: string
      date: string
      shiftId: string
      changeType: ChangeType
      reason: string
      status: ChangeStatus
      reviewerName?: string
      reviewTime?: string
      createTime: string
    }

    /** 整周保存入参 */
    interface WeekSavePayload {
      storeId: string
      weekStart: string
      items: ScheduleItem[]
    }

    /** 新增/编辑班次入参 */
    type ShiftUpsertPayload = Partial<Omit<ShiftItem, 'id'>> & { id?: string }

    /** 发起调班入参 */
    interface ChangeCreatePayload {
      storeId: string
      date: string
      shiftId: string
      targetUserId: string
      changeType: ChangeType
      reason: string
    }

    /** 排班可选员工 */
    interface EmployeeOption {
      id: string
      name: string
      role: string
      storeId: string
    }

    /** 排班可选门店 */
    interface StoreOption {
      id: string
      name: string
      businessHours: string
    }

    /** 单条明细新增入参 */
    interface ScheduleItemCreatePayload {
      storeId: string
      date: string
      shiftId: string
      userId: string
      roleCode?: string
    }

    /** 发布前校验报告：conflicts 为阻断项，shortages 为最低在岗人数提示项 */
    interface ValidationResult {
      passable: boolean
      conflicts: string[]
      shortages: string[]
    }
  }

  /** 消息通知（消息中心 / 平台公告 / 租户通知 / 事件提醒） */
  namespace Notify {
    /** 定向范围：平台公告（全部租户/按套餐/指定租户） */
    type AnnouncementScope = 'ALL' | 'PLAN' | 'ASSIGN'

    /** 定向范围：租户通知（全员/指定门店/指定角色/指定人员） */
    type NoticeScope = 'ALL' | 'STORE' | 'ROLE' | 'USER'

    /** 公告类型：1功能更新 2系统维护 3规则变更 */
    type AnnouncementType = 1 | 2 | 3

    /** 公告状态：0草稿 1已发布 2已撤回 */
    type AnnouncementStatus = 0 | 1 | 2

    /** 消息中心 - 系统公告项（含当前用户已读/确认状态） */
    interface AnnouncementItem {
      id: string
      title: string
      content: string
      noticeType: AnnouncementType
      requireAck: boolean
      /** 定向用户类型：undefined=全部用户；2=仅系统管理员 */
      targetUserType?: number
      effectiveAt: string
      publisherName: string
      read: boolean
      readAt: string
      ackAt: string
      /** 需要当前用户确认（强制已读确认未完成） */
      needAck: boolean
      /** 未读回复数（平台对我方私密反馈的回复，未读红点用） */
      unreadComments?: number
      /** 关联业务跳转（仅事件类有值；公告恒为空） */
      bizType?: string
      bizId?: string
    }

    /** 消息中心 - 我的通知项（租户通知） */
    interface NoticeItem {
      id: string
      title: string
      content: string
      /** 通知类型：1=门店通知 2=制度规范 3=活动安排 */
      noticeType?: number
      senderName: string
      sendTime: string
      read: boolean
      readAt: string
      /** 未读留言数（别人在通知下发表的公开留言，未读红点用） */
      unreadComments?: number
      /** 以下为消息中心详情弹窗的通用展示字段（通知恒为空/无） */
      needAck?: boolean
      ackAt?: string
      bizType?: string
      bizId?: string
    }

    /** 消息中心 - 事件提醒项（系统触发） */
    interface EventItem {
      id: string
      eventType: string
      title: string
      content: string
      bizType: string
      bizId: string
      read: boolean
      createTime: string
      /** 事件无强制确认概念 */
      needAck?: boolean
      ackAt?: string
    }

    /** 未读数汇总（顶栏铃铛角标） */
    interface UnreadCount {
      announcements: number
      notices: number
      events: number
    }

    /** 平台公告管理项（超管侧） */
    interface AnnouncementAdmin {
      id: string
      title: string
      content: string
      noticeType: AnnouncementType
      targetScope: AnnouncementScope
      targetPlanType?: number
      targetTenantIds?: string
      effectiveAt: string
      expireAt: string
      requireAck: boolean
      /** 定向用户类型：undefined=全部用户；2=仅系统管理员 */
      targetUserType?: number
      status: AnnouncementStatus
      publisherName: string
      readCount: number
      ackCount: number
      /** 私密反馈工单数（顶层留言数） */
      feedbackCount?: number
      /** 待处理反馈工单数 */
      pendingFeedbackCount?: number
      createTime: string
    }

    /** 平台公告创建/更新参数 */
    interface AnnouncementSaveParams {
      id?: string
      title: string
      content: string
      noticeType: AnnouncementType
      targetScope: AnnouncementScope
      targetPlanType?: number
      targetTenantIds?: string
      effectiveAt: string
      expireAt?: string
      requireAck: boolean
      /** 定向用户类型：undefined=全部用户；2=仅系统管理员 */
      targetUserType?: number
      publishNow: boolean
    }

    /** 平台公告已读统计 - 租户维度 */
    interface AnnouncementTenantStat {
      tenantId: string
      tenantName: string
      userCount: number
      readCount: number
      ackCount: number
    }

    /** 平台公告已读统计 */
    interface AnnouncementStats {
      announcementId: string
      title: string
      requireAck: boolean
      /** 定向用户类型：undefined=全部用户；2=仅系统管理员 */
      targetUserType?: number
      userCount: number
      readCount: number
      ackCount: number
      tenants: AnnouncementTenantStat[]
    }

    /** 租户通知管理项（管理员侧） */
    interface NoticeAdmin {
      id: string
      title: string
      content: string
      targetScope: NoticeScope
      targetStoreIds?: string
      targetRoleIds?: string
      targetUserIds?: string
      storeId?: string
      senderName: string
      sendTime: string
      /** 通知类型：1=门店通知 2=制度规范 3=活动安排 */
      noticeType?: number
      /** 通知状态：0=已发送 1=已撤回 */
      status?: number
      audienceCount: number
      readCount: number
      /** 公告内留言数（顶层留言数，不含回复） */
      commentCount?: number
      createTime: string
    }

    /** 租户通知发送参数（sender 由后端会话取） */
    interface NoticeSendParams {
      title: string
      content: string
      /** 通知类型：1=门店通知 2=制度规范 3=活动安排（为空按 1 处理） */
      noticeType?: number
      targetScope: NoticeScope
      targetStoreIds?: string
      targetRoleIds?: string
      targetUserIds?: string
    }

    /** 通知未读用户 */
    interface NoticeUnreadUser {
      userId: string
      userName: string
      storeName: string
    }

    /** 通知按门店已读统计 */
    interface NoticeStoreStat {
      storeId: string
      storeName: string
      userCount: number
      readCount: number
    }

    /** 租户通知已读统计 */
    interface NoticeStats {
      noticeId: string
      title: string
      audienceCount: number
      readCount: number
      unreadCount: number
      unreadUsers: NoticeUnreadUser[]
      stores: NoticeStoreStat[]
    }

    /** 通用下拉选项（租户/门店/角色/人员） */
    interface NotifyOption {
      id: string
      name: string
      planType?: number
    }

    /** 留言可见范围：PRIVATE=平台公告私密反馈；AUDIENCE=租户通知公告内公开留言 */
    type MessageScope = 'PRIVATE' | 'AUDIENCE'

    /** 工单状态（仅平台公告私密反馈）：待处理/已回复/已关闭 */
    type FeedbackStatus = 'PENDING' | 'REPLIED' | 'CLOSED'

    /** 留言项 */
    interface MessageItem {
      id: string
      targetType: 'ANNOUNCEMENT' | 'NOTICE'
      targetId: string
      tenantId: string
      userId: string
      userName: string
      /** 1=租户用户 2=平台 */
      authorType: number
      scope: MessageScope
      /** 0=顶层留言；否则为被回复的顶层留言ID */
      parentId: string
      threadStatus?: FeedbackStatus
      replyByName?: string
      replyAt?: string
      content: string
      /** 0正常 1本人撤回 2管理员屏蔽 */
      status: number
      /** 是否置顶（仅租户通知顶层公开留言） */
      pinned?: boolean
      /** 被 @ 提醒的用户姓名（仅展示） */
      mentionedNames?: string[]
      createTime: string
      mine: boolean
      canWithdraw: boolean
    }

    /** 发表留言参数（tenant_id / user_id 由后端会话取） */
    interface MessageCreateParams {
      targetType: 'ANNOUNCEMENT' | 'NOTICE'
      targetId: string
      /** 回复的顶层留言ID（仅租户通知使用） */
      parentId?: string
      /** 被 @ 提醒的用户ID（仅租户通知使用） */
      mentionedUserIds?: string[]
      content: string
    }

    /** 平台公告私密反馈工单 */
    interface FeedbackThread {
      id: string
      tenantId: string
      tenantName?: string
      storeId?: string
      userId: string
      userName: string
      content: string
      threadStatus: FeedbackStatus
      createTime: string
      replyByName?: string
      replyAt?: string
      messageCount: number
      /** 工单详情（仅详情接口返回） */
      messages?: MessageItem[]
    }
  }

  /** 日志（操作日志 / 登录日志） */
  namespace Log {
    /** 操作日志条目 */
    interface OperationLogItem {
      id: string
      tenantId?: string
      /** 租户名称（仅系统管理员查询时返回） */
      tenantName?: string
      module: string
      operation: string
      /** 动态操作描述（如：模拟登录用户「xxx」），为空时前端回退展示 operation */
      description?: string
      /** 方法签名，如 ProductController.create(..) */
      method: string
      url: string
      /** 1-成功 0-失败 */
      status: number
      errorMsg?: string
      /** 请求参数（JSON，敏感字段已脱敏） */
      params?: string
      /** 返回结果（JSON，超长截断） */
      result?: string
      ip: string
      userId?: string
      username: string
      /** 耗时（毫秒） */
      duration?: number
      createTime: string
    }

    /** 操作日志搜索参数 */
    interface OperationSearchParams {
      module?: string
      username?: string
      status?: number
      startDate?: string
      endDate?: string
      current?: number
      size?: number
    }

    /** 操作日志分页列表 */
    type OperationLogList = Api.Common.PaginatedResponse<OperationLogItem>

    /** 登录日志条目 */
    interface LoginLogItem {
      id: string
      tenantId?: string
      /** 租户名称（平台管理员跨租户与本租户视角均返回） */
      tenantName?: string
      userId?: string
      username: string
      /** 登录类型：1-后台登录 2-POS登录 */
      loginType: number
      loginIp: string
      browser: string
      os: string
      /** 登录状态：1-成功 0-失败 */
      status: number
      msg: string
      loginTime: string
    }

    /** 登录日志搜索参数 */
    interface LoginSearchParams {
      username?: string
      status?: number
      loginType?: number
      startDate?: string
      endDate?: string
      current?: number
      size?: number
    }

    /** 登录日志分页列表 */
    type LoginLogList = Api.Common.PaginatedResponse<LoginLogItem>

    /** 日志清理参数（仅平台超级管理员可用） */
    interface ClearLogParams {
      /** 只删除该日期（yyyy-MM-dd）之前的记录，不传表示清空全部 */
      beforeDate?: string
    }
  }
}
