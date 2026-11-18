/**
 * 商品管理服务（分类 / 供应商 / 商品）
 */
import { getDb, persistDb, type MockDatabase } from './core/db'
import { delay, formatDateTime, genId, includesKeyword, money, paginate } from './core/helpers'
import { defaultUrgentThreshold, resolveStockStatus, shelfQtyOf, totalQtyOf } from './core/inventory'
import { fail } from './core/result'
import { useTenantStore } from '@/store/modules/tenant'

const currentTid = (): string => useTenantStore().currentId

/** 计算商品实时库存（仓库 + 货架） */
const calcStock = (db: MockDatabase, productId: string): number =>
  db.stocks.filter((s) => s.productId === productId).reduce((sum, s) => sum + totalQtyOf(s), 0)

/** 计算商品货架库存（已上架、可直接销售） */
const calcShelfStock = (db: MockDatabase, productId: string): number =>
  db.stocks.filter((s) => s.productId === productId).reduce((sum, s) => sum + shelfQtyOf(s), 0)

/** 计算分类商品数（含子分类） */
const countCategoryProducts = (db: MockDatabase, tenantId: string, categoryId: string): number => {
  const catMap = new Map(db.categories.filter((c) => c.tenantId === tenantId).map((c) => [c.id, c]))
  return db.products.filter((p) => {
    if (p.tenantId !== tenantId) return false
    let currentId: string | null = p.categoryId
    while (currentId) {
      if (currentId === categoryId) return true
      currentId = catMap.get(currentId)?.parentId ?? null
    }
    return false
  }).length
}

/** 组装商品实时字段 */
const decorateProduct = (
  db: MockDatabase,
  product: Api.Product.ProductItem
): Api.Product.ProductItem => {
  const stock = calcStock(db, product.id)
  return {
    ...product,
    stock,
    shelfQuantity: calcShelfStock(db, product.id),
    grossRate: product.salePrice
      ? money(((product.salePrice - product.purchasePrice) / product.salePrice) * 100)
      : 0
  }
}

/* ------------------------------ 分类 ------------------------------ */

/** 分类树（仅返回匹配节点，父节点会自动带出） */
export async function fetchCategoryTree(
  params: Api.Product.CategorySearchParams = {}
): Promise<Api.Product.CategoryItem[]> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const matched = db.categories.filter(
    (c) =>
      c.tenantId === tenantId &&
      includesKeyword(c.name, params.name) &&
      (!params.status || c.status === params.status)
  )
  const matchedIds = new Set(matched.map((c) => c.id))

  const nodes: Api.Product.CategoryItem[] = db.categories
    .filter((c) => c.tenantId === tenantId)
    .map((c) => ({
      ...c,
      productNum: countCategoryProducts(db, tenantId, c.id),
      children: undefined
    }))
    .filter((c) => matchedIds.has(c.id) || matched.some((m) => m.parentId === c.id))

  const roots = nodes.filter((n) => !n.parentId)
  roots.forEach((root) => {
    root.children = nodes.filter((n) => n.parentId === root.id).sort((a, b) => a.sort - b.sort)
  })
  return roots.sort((a, b) => a.sort - b.sort)
}

/** 平铺分类（供下拉选择） */
export async function fetchCategoryOptions(): Promise<Api.Product.CategoryItem[]> {
  await delay(60)
  const tenantId = currentTid()
  return getDb()
    .categories.filter((c) => c.tenantId === tenantId)
    .sort((a, b) => a.sort - b.sort)
}

/** 新增分类 */
export async function fetchCreateCategory(
  data: Partial<Api.Product.CategoryItem>
): Promise<Api.Product.CategoryItem> {
  await delay(160)
  const db = getDb()
  const tenantId = currentTid()
  const name = (data.name || '').trim()
  if (!name) fail('请输入分类名称')
  if (
    db.categories.some(
      (c) => c.tenantId === tenantId && c.parentId === (data.parentId ?? null) && c.name === name
    )
  ) {
    fail('同级下已存在相同分类名称')
  }
  if (
    data.parentId &&
    db.categories.filter((c) => c.tenantId === tenantId).every((c) => c.id !== data.parentId)
  ) {
    fail('上级分类不存在')
  }

  const category: Api.Product.CategoryItem = {
    id: genId('C'),
    tenantId,
    parentId: data.parentId ?? null,
    name,
    sort: Number(data.sort) || 0,
    status: data.status ?? '1',
    productNum: 0,
    createTime: formatDateTime()
  }
  db.categories.push(category)
  persistDb()
  return category
}

/** 编辑分类 */
export async function fetchUpdateCategory(
  data: Partial<Api.Product.CategoryItem>
): Promise<Api.Product.CategoryItem> {
  await delay(140)
  const db = getDb()
  const tenantId = currentTid()
  const category = db.categories.find((c) => c.id === data.id && c.tenantId === tenantId)
  if (!category) fail('分类不存在')

  const name = (data.name || '').trim()
  if (!name) fail('请输入分类名称')
  if (
    db.categories.some(
      (c) =>
        c.tenantId === tenantId &&
        c.id !== category.id &&
        c.parentId === (data.parentId ?? null) &&
        c.name === name
    )
  ) {
    fail('同级下已存在相同分类名称')
  }

  // 禁止把分类移动到自己的子分类下
  if (data.parentId) {
    let cursor: string | null = data.parentId
    while (cursor) {
      if (cursor === category.id) fail('不能将分类移动到自身或其子分类下')
      cursor = db.categories.find((c) => c.id === cursor)?.parentId ?? null
    }
  }

  category.name = name
  category.parentId = data.parentId ?? null
  category.sort = Number(data.sort) || category.sort
  category.status = data.status ?? category.status
  persistDb()
  return category
}

/** 删除分类（有子分类或商品时不允许） */
export async function fetchDeleteCategory(id: string): Promise<void> {
  await delay(140)
  const db = getDb()
  const tenantId = currentTid()
  const category = db.categories.find((c) => c.id === id && c.tenantId === tenantId)
  if (!category) fail('分类不存在')
  if (db.categories.some((c) => c.parentId === id)) fail('请先删除该分类下的子分类')
  if (db.products.some((p) => p.tenantId === tenantId && p.categoryId === id)) {
    fail('该分类下存在商品，无法删除')
  }

  db.categories = db.categories.filter((c) => c.id !== id)
  persistDb()
}

/* ------------------------------ 供应商 ------------------------------ */

/** 供应商列表 */
export async function fetchSupplierList(
  params: Api.Product.SupplierSearchParams
): Promise<Api.Product.SupplierList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const list = db.suppliers
    .filter(
      (s) =>
        s.tenantId === tenantId &&
        includesKeyword(s.name, params.name) &&
        includesKeyword(s.contact, params.contact) &&
        includesKeyword(s.phone, params.phone) &&
        (!params.status || s.status === params.status)
    )
    .map((s) => ({
      ...s,
      productNum: db.products.filter((p) => p.tenantId === tenantId && p.supplierId === s.id).length
    }))
    .sort((a, b) => b.createTime.localeCompare(a.createTime))
  return paginate(list, params)
}

/** 供应商选项（下拉） */
export async function fetchSupplierOptions(): Promise<Api.Product.SupplierItem[]> {
  await delay(60)
  const tenantId = currentTid()
  return getDb()
    .suppliers.filter((s) => s.tenantId === tenantId && s.status === '1')
    .map((s) => ({ ...s, productNum: 0 }))
}

/** 新增供应商 */
export async function fetchCreateSupplier(
  data: Partial<Api.Product.SupplierItem>
): Promise<Api.Product.SupplierItem> {
  await delay(160)
  const db = getDb()
  const tenantId = currentTid()
  const name = (data.name || '').trim()
  if (!name) fail('请输入供应商名称')
  if (db.suppliers.some((s) => s.tenantId === tenantId && s.name === name)) {
    fail('该供应商已存在')
  }

  const supplier: Api.Product.SupplierItem = {
    id: genId('S'),
    tenantId,
    name,
    contact: data.contact || '',
    phone: data.phone || '',
    address: data.address || '',
    status: data.status ?? '1',
    productNum: 0,
    remark: data.remark || '',
    createTime: formatDateTime()
  }
  db.suppliers.push(supplier)
  persistDb()
  return supplier
}

/** 编辑供应商 */
export async function fetchUpdateSupplier(
  data: Partial<Api.Product.SupplierItem>
): Promise<Api.Product.SupplierItem> {
  await delay(140)
  const db = getDb()
  const tenantId = currentTid()
  const supplier = db.suppliers.find((s) => s.id === data.id && s.tenantId === tenantId)
  if (!supplier) fail('供应商不存在')

  const name = (data.name || '').trim()
  if (!name) fail('请输入供应商名称')
  if (
    db.suppliers.some((s) => s.tenantId === tenantId && s.id !== supplier.id && s.name === name)
  ) {
    fail('该供应商已存在')
  }

  Object.assign(supplier, {
    name,
    contact: data.contact ?? supplier.contact,
    phone: data.phone ?? supplier.phone,
    address: data.address ?? supplier.address,
    status: data.status ?? supplier.status,
    remark: data.remark ?? supplier.remark
  })
  persistDb()
  return supplier
}

/** 删除供应商 */
export async function fetchDeleteSupplier(id: string): Promise<void> {
  await delay(140)
  const db = getDb()
  const tenantId = currentTid()
  const supplier = db.suppliers.find((s) => s.id === id && s.tenantId === tenantId)
  if (!supplier) fail('供应商不存在')
  if (db.products.some((p) => p.tenantId === tenantId && p.supplierId === id)) {
    fail('该供应商下存在商品，无法删除')
  }
  db.suppliers = db.suppliers.filter((s) => s.id !== id)
  persistDb()
}

/* ------------------------------ 商品 ------------------------------ */

/** 商品列表（含实时库存） */
export async function fetchProductList(
  params: Api.Product.ProductSearchParams
): Promise<Api.Product.ProductList> {
  await delay()
  const db = getDb()
  const tenantId = currentTid()
  const list = db.products
    .filter(
      (p) =>
        p.tenantId === tenantId &&
        includesKeyword(p.name, params.name) &&
        includesKeyword(p.barcode, params.barcode) &&
        (!params.categoryId || p.categoryId === params.categoryId) &&
        (!params.supplierId || p.supplierId === params.supplierId) &&
        (!params.status || p.status === params.status)
    )
    .map((p) => decorateProduct(db, p))
    .sort((a, b) => b.updateTime.localeCompare(a.updateTime))
  return paginate(list, params)
}

/** 商品选项（POS 搜索 / 下拉 / 明细选择） */
export async function fetchProductOptions(keyword = ''): Promise<Api.Product.ProductItem[]> {
  await delay(60)
  const db = getDb()
  const tenantId = currentTid()
  const kw = keyword.trim().toLowerCase()
  return db.products
    .filter(
      (p) =>
        p.tenantId === tenantId &&
        p.status === '1' &&
        (!kw || p.name.toLowerCase().includes(kw) || p.barcode.includes(kw))
    )
    .slice(0, 30)
    .map((p) => decorateProduct(db, p))
}

/** 新增商品 */
export async function fetchCreateProduct(
  data: Partial<Api.Product.ProductForm> & { initStock?: number; warehouseId?: string }
): Promise<Api.Product.ProductItem> {
  await delay(200)
  const db = getDb()
  const tenantId = currentTid()

  const name = (data.name || '').trim()
  const barcode = (data.barcode || '').trim()
  if (!name) fail('请输入商品名称')
  if (!barcode) fail('请输入商品条码')
  if (db.products.some((p) => p.tenantId === tenantId && p.barcode === barcode)) {
    fail('该条码已被其它商品占用')
  }
  if (!data.categoryId) fail('请选择商品分类')
  if (Number(data.salePrice) <= 0) fail('售价必须大于 0')

  const category = db.categories.find((c) => c.id === data.categoryId)
  const supplier = db.suppliers.find((s) => s.id === data.supplierId)
  const product: Api.Product.ProductItem = {
    id: genId('G'),
    tenantId,
    barcode,
    name,
    categoryId: data.categoryId!,
    categoryName: category?.name ?? '',
    supplierId: data.supplierId || '',
    supplierName: supplier?.name ?? '',
    unit: data.unit || '件',
    spec: data.spec || '',
    purchasePrice: money(Number(data.purchasePrice) || 0),
    salePrice: money(Number(data.salePrice) || 0),
    memberPrice: money(Number(data.memberPrice) || Number(data.salePrice) * 0.95),
    status: data.status ?? '1',
    warningStock: Number(data.warningStock) || 10,
    stock: 0,
    salesNum: 0,
    grossRate: 0,
    remark: data.remark || '',
    image: data.image || '',
    createTime: formatDateTime(),
    updateTime: formatDateTime()
  }
  product.grossRate = product.salePrice
    ? money(((product.salePrice - product.purchasePrice) / product.salePrice) * 100)
    : 0
  db.products.push(product)

  // 初始库存（可选）写入指定仓库
  const initStock = Number(data.initStock) || 0
  if (initStock > 0) {
    const warehouses = db.warehouses.filter((w) => w.tenantId === tenantId)
    const warehouse =
      warehouses.find((w) => w.id === data.warehouseId) ||
      warehouses.find((w) => w.isDefault) ||
      warehouses[0]
    if (warehouse) {
      const urgentThreshold = defaultUrgentThreshold(product.warningStock)
      db.stocks.push({
        id: genId('K'),
        tenantId,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
        productId: product.id,
        barcode: product.barcode,
        productName: product.name,
        categoryId: product.categoryId,
        unit: product.unit,
        // 新增商品的初始库存进入仓库，需通过上架单搬到货架后才可收银销售
        warehouseQuantity: initStock,
        shelfQuantity: 0,
        pendingInQuantity: 0,
        totalQuantity: initStock,
        warnThreshold: product.warningStock,
        urgentThreshold,
        thresholdOverridden: false,
        stockStatus: resolveStockStatus(0, product.warningStock, urgentThreshold),
        replenishType: 'shelf_up',
        quantity: initStock,
        safetyStock: product.warningStock,
        purchasePrice: product.purchasePrice,
        salePrice: product.salePrice,
        stockValue: money(initStock * product.purchasePrice),
        warning: true,
        updateTime: formatDateTime()
      })
      product.stock = initStock
    }
  }

  persistDb()
  return decorateProduct(db, product)
}

/** 编辑商品 */
export async function fetchUpdateProduct(
  data: Partial<Api.Product.ProductForm>
): Promise<Api.Product.ProductItem> {
  await delay(180)
  const db = getDb()
  const tenantId = currentTid()
  const product = db.products.find((p) => p.id === data.id && p.tenantId === tenantId)
  if (!product) fail('商品不存在')

  const name = (data.name || '').trim()
  const barcode = (data.barcode || '').trim()
  if (!name) fail('请输入商品名称')
  if (!barcode) fail('请输入商品条码')
  if (
    db.products.some((p) => p.tenantId === tenantId && p.id !== product.id && p.barcode === barcode)
  ) {
    fail('该条码已被其它商品占用')
  }
  if (!data.categoryId) fail('请选择商品分类')
  if (Number(data.salePrice) <= 0) fail('售价必须大于 0')

  const category = db.categories.find((c) => c.id === data.categoryId)
  const supplier = db.suppliers.find((s) => s.id === data.supplierId)
  const oldBarcode = product.barcode

  Object.assign(product, {
    name,
    barcode,
    categoryId: data.categoryId!,
    categoryName: category?.name ?? product.categoryName,
    supplierId: data.supplierId ?? product.supplierId,
    supplierName: supplier?.name ?? product.supplierName,
    unit: data.unit ?? product.unit,
    spec: data.spec ?? product.spec,
    purchasePrice: money(Number(data.purchasePrice) || product.purchasePrice),
    salePrice: money(Number(data.salePrice) || product.salePrice),
    memberPrice: money(Number(data.memberPrice) || product.memberPrice),
    status: data.status ?? product.status,
    warningStock: Number(data.warningStock) || product.warningStock,
    stockUrgentThreshold:
      data.stockUrgentThreshold != null
        ? Number(data.stockUrgentThreshold)
        : product.stockUrgentThreshold,
    remark: data.remark ?? product.remark,
    image: data.image ?? product.image ?? '',
    updateTime: formatDateTime()
  })
  product.grossRate = product.salePrice
    ? money(((product.salePrice - product.purchasePrice) / product.salePrice) * 100)
    : 0

  // 条码变更同步库存记录
  if (oldBarcode !== barcode) {
    db.stocks
      .filter((s) => s.productId === product.id)
      .forEach((s) => {
        s.barcode = barcode
        s.productName = name
        s.salePrice = product.salePrice
        s.purchasePrice = product.purchasePrice
        s.stockValue = money(totalQtyOf(s) * product.purchasePrice)
      })
  }

  persistDb()
  return decorateProduct(db, product)
}

/** 删除商品（含库存记录） */
export async function fetchDeleteProduct(id: string): Promise<void> {
  await delay(160)
  const db = getDb()
  const tenantId = currentTid()
  const product = db.products.find((p) => p.id === id && p.tenantId === tenantId)
  if (!product) fail('商品不存在')

  db.products = db.products.filter((p) => p.id !== id)
  db.stocks = db.stocks.filter((s) => s.productId !== id)
  persistDb()
}
