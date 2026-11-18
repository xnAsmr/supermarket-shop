param([string]$Base = 'http://localhost:8085')

# 采购业务模块重构 —— 端到端验证脚本
# 前置：已执行 upgrade-purchase-refactor.sql + seed-purchase-refactor-menu.sql，
#       且已重新编译并重启后端。
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File verify-purchase-refactor.ps1

$ErrorActionPreference = 'Stop'
$script:FAILED = $false

function Log($msg) { Write-Host $msg }
function Ok($cond, $msg) {
  if ($cond) { Write-Host "  [PASS] $msg" }
  else { Write-Host "  [FAIL] $msg"; $script:FAILED = $true }
}
function Invoke-MySql([string]$sql) {
  $m = (Get-Command mysql).Source
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $out = & $m -uroot -p123456 supermarket_erp -N -e $sql 2>$null
  $ErrorActionPreference = $prev
  return (($out | ForEach-Object { "$_" }) -join ' ')
}

# ---------- 登录 ----------
$login = Invoke-RestMethod -Uri "$Base/api/v1/auth/login" -Method POST -ContentType 'application/json' `
  -Body (@{ username = 'sysadmin'; password = '123456' } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.data.token)" }
Log "login ok"

# ---------- 取基础数据（直接查库，避免依赖搜索接口的参数约束） ----------
$storeId = (Invoke-MySql "SELECT id FROM sys_store WHERE deleted=0 AND status=1 ORDER BY id LIMIT 1;").Trim()
$supplierId = (Invoke-MySql "SELECT id FROM pms_supplier WHERE deleted=0 ORDER BY id LIMIT 1;").Trim()
$productRows = Invoke-MySql "SELECT id FROM pms_product WHERE deleted=0 AND status=1 ORDER BY id LIMIT 2;"
$productIds = ($productRows -split '\s+') | Where-Object { $_ -match '^\d+$' }
$pid1 = $productIds[0]
$pid2 = if ($productIds.Count -gt 1) { $productIds[1] } else { $productIds[0] }

Log "storeId=$storeId supplierId=$supplierId"
Log "products: $pid1 / $pid2"
if (-not $storeId -or -not $supplierId -or -not $pid1) {
  Log "missing base data (store/supplier/product)"; exit 1
}

# 取一个门店的商品进价
$stockBefore = Invoke-MySql "SELECT IFNULL(SUM(shelf_quantity),0) FROM wms_stock WHERE store_id=$storeId;"
Log "initial shelf stock = $stockBefore"

# ================= 场景 1：新建采购订单（草稿）→ 编辑 → 提交 → 审核 =================
Log ""
Log "=== 1. purchase order lifecycle ==="
$orderBody = @{
  supplierId = $supplierId
  storeId    = $storeId
  remark     = 'auto-test'
  items      = @(
    @{ productId = $pid1; orderedQty = 100; purchasePrice = 5.50 },
    @{ productId = $pid2; orderedQty = 40;  purchasePrice = 3.20 }
  )
} | ConvertTo-Json -Depth 5

$orderId = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders" -Method POST -Headers $headers `
  -ContentType 'application/json' -Body $orderBody).data
Ok ($orderId -gt 0) "purchase order created, id=$orderId"

$order = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId" -Headers $headers).data
Ok ($order.status -eq 0) "new order status = 0 (draft), actual=$($order.status)"
Ok ($order.items.Count -eq 2) "order has 2 items, actual=$($order.items.Count)"
Ok ([math]::Abs([double]$order.totalOrderedQty - 140) -lt 0.01) "totalOrderedQty = 140, actual=$($order.totalOrderedQty)"

# 编辑（草稿可改数量）
$editBody = @{
  supplierId = $supplierId
  storeId    = $storeId
  items      = @(
    @{ productId = $pid1; orderedQty = 60; purchasePrice = 5.50 }
  )
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId" -Method PUT -Headers $headers `
  -ContentType 'application/json' -Body $editBody | Out-Null
$order = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId" -Headers $headers).data
Ok ($order.items.Count -eq 1) "edited order has 1 item, actual=$($order.items.Count)"
Ok ([math]::Abs([double]$order.totalOrderedQty - 60) -lt 0.01) "totalOrderedQty = 60 after edit, actual=$($order.totalOrderedQty)"

# 已审核后不可编辑
Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId/submit" -Method PUT -Headers $headers | Out-Null
$order = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId" -Headers $headers).data
Ok ($order.status -eq 1) "after submit status = 1 (pending review), actual=$($order.status)"

$editRes = Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId" -Method PUT -Headers $headers `
  -ContentType 'application/json' -Body $editBody
Ok ($editRes.code -ne 200) "editing a reviewed order is rejected, code=$($editRes.code)"

Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId/review" -Method PUT -Headers $headers `
  -ContentType 'application/json' -Body '{}' | Out-Null
$order = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId" -Headers $headers).data
Ok ($order.status -eq 2) "after review status = 2 (approved), actual=$($order.status)"

# ================= 场景 2：部分入库（第一张收货单：只收 30） =================
Log ""
Log "=== 2. partial receipt (30 of 60) ==="
$receivable = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId/receivable-items" -Headers $headers).data
Ok ($receivable.Count -eq 1) "receivable items = 1, actual=$($receivable.Count)"
Ok ([math]::Abs([double]$receivable[0].orderedQty - 60) -lt 0.01) "receivable orderedQty = 60"
Ok ([math]::Abs([double]$receivable[0].receivedQty) -lt 0.01) "receivable receivedQty = 0"

$orderItemId = $receivable[0].id
$receiptBody = @{
  orderId = $orderId
  storeId = $storeId
  remark  = 'auto-test receipt'
  items   = @(
    @{ productId = $pid1; orderItemId = $orderItemId; quantity = 30; purchasePrice = 5.50 }
  )
} | ConvertTo-Json -Depth 5

$receiptId = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-receipts" -Method POST -Headers $headers `
  -ContentType 'application/json' -Body $receiptBody).data
Ok ($receiptId -gt 0) "receipt created, id=$receiptId"

# 超量收货必须被拒
$overBody = @{
  orderId = $orderId
  storeId = $storeId
  items   = @(
    @{ productId = $pid1; orderItemId = $orderItemId; quantity = 999; purchasePrice = 5.50 }
  )
} | ConvertTo-Json -Depth 5
$overRes = Invoke-RestMethod -Uri "$Base/api/v1/purchase-receipts" -Method POST -Headers $headers `
  -ContentType 'application/json' -Body $overBody
Ok ($overRes.code -ne 200) "over-receipt is rejected, code=$($overRes.code)"

# 入库生效
Invoke-RestMethod -Uri "$Base/api/v1/purchase-receipts/$receiptId/submit" -Method PUT -Headers $headers | Out-Null
Invoke-RestMethod -Uri "$Base/api/v1/purchase-receipts/$receiptId/review" -Method PUT -Headers $headers `
  -ContentType 'application/json' -Body '{}' | Out-Null
Invoke-RestMethod -Uri "$Base/api/v1/purchase-receipts/$receiptId/stock-in" -Method PUT -Headers $headers | Out-Null

$order = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId" -Headers $headers).data
Ok ($order.status -eq 3) "after partial receipt status = 3 (partially received), actual=$($order.status)"
Ok ([math]::Abs([double]$order.totalReceivedQty - 30) -lt 0.01) "totalReceivedQty = 30, actual=$($order.totalReceivedQty)"
Ok ([math]::Abs([double]$order.items[0].receivedQty - 30) -lt 0.01) "item receivedQty = 30, actual=$($order.items[0].receivedQty)"

# ================= 场景 3：第二张收货单收完剩余 30 =================
Log ""
Log "=== 3. second receipt (remaining 30) ==="
$receiptBody2 = @{
  orderId = $orderId
  storeId = $storeId
  items   = @(
    @{ productId = $pid1; orderItemId = $orderItemId; quantity = 30; purchasePrice = 5.50 }
  )
} | ConvertTo-Json -Depth 5
$receiptId2 = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-receipts" -Method POST -Headers $headers `
  -ContentType 'application/json' -Body $receiptBody2).data
Ok ($receiptId2 -gt 0 -and $receiptId2 -ne $receiptId) "second receipt created (one order -> many receipts), id=$receiptId2"

Invoke-RestMethod -Uri "$Base/api/v1/purchase-receipts/$receiptId2/submit" -Method PUT -Headers $headers | Out-Null
Invoke-RestMethod -Uri "$Base/api/v1/purchase-receipts/$receiptId2/review" -Method PUT -Headers $headers `
  -ContentType 'application/json' -Body '{}' | Out-Null
Invoke-RestMethod -Uri "$Base/api/v1/purchase-receipts/$receiptId2/stock-in" -Method PUT -Headers $headers | Out-Null

$order = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId" -Headers $headers).data
Ok ($order.status -eq 4) "after full receipt status = 4 (completed), actual=$($order.status)"
Ok ([math]::Abs([double]$order.totalReceivedQty - 60) -lt 0.01) "totalReceivedQty = 60, actual=$($order.totalReceivedQty)"

# ================= 场景 4：采购退货（退 10） =================
Log ""
Log "=== 4. purchase return (10 of 60) ==="
$returnable = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId/returnable-items" -Headers $headers).data
Ok ($returnable.Count -eq 1) "returnable items = 1, actual=$($returnable.Count)"
Ok ([math]::Abs([double]$returnable[0].receivedQty - 60) -lt 0.01) "returnable receivedQty = 60"

$returnBody = @{
  orderId = $orderId
  storeId = $storeId
  reason  = 'auto-test return'
  items   = @(
    @{ productId = $pid1; orderItemId = $orderItemId; quantity = 10; purchasePrice = 5.50 }
  )
} | ConvertTo-Json -Depth 5
$returnId = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-returns" -Method POST -Headers $headers `
  -ContentType 'application/json' -Body $returnBody).data
Ok ($returnId -gt 0) "purchase return created, id=$returnId"

# 超量退货必须被拒
$overReturnBody = @{
  orderId = $orderId
  storeId = $storeId
  reason  = 'over'
  items   = @(
    @{ productId = $pid1; orderItemId = $orderItemId; quantity = 999; purchasePrice = 5.50 }
  )
} | ConvertTo-Json -Depth 5
$overReturnRes = Invoke-RestMethod -Uri "$Base/api/v1/purchase-returns" -Method POST -Headers $headers `
  -ContentType 'application/json' -Body $overReturnBody
Ok ($overReturnRes.code -ne 200) "over-return is rejected, code=$($overReturnRes.code)"

Invoke-RestMethod -Uri "$Base/api/v1/purchase-returns/$returnId/submit" -Method PUT -Headers $headers | Out-Null
Invoke-RestMethod -Uri "$Base/api/v1/purchase-returns/$returnId/review" -Method PUT -Headers $headers `
  -ContentType 'application/json' -Body '{}' | Out-Null
Invoke-RestMethod -Uri "$Base/api/v1/purchase-returns/$returnId/confirm" -Method PUT -Headers $headers | Out-Null

$order = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId" -Headers $headers).data
Ok ($order.status -eq 6) "after partial return status = 6 (partially returned), actual=$($order.status)"
Ok ([math]::Abs([double]$order.totalReturnedQty - 10) -lt 0.01) "totalReturnedQty = 10, actual=$($order.totalReturnedQty)"

# ================= 场景 5：作废退货单 → 数据回滚 =================
Log ""
Log "=== 5. void purchase return ==="
Invoke-RestMethod -Uri "$Base/api/v1/purchase-returns/$returnId/cancel" -Method PUT -Headers $headers `
  -ContentType 'application/json' -Body (@{ reason = 'void' } | ConvertTo-Json) | Out-Null
$order = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId" -Headers $headers).data
Ok ([math]::Abs([double]$order.totalReturnedQty) -lt 0.01) "totalReturnedQty back to 0, actual=$($order.totalReturnedQty)"
Ok ($order.status -eq 4) "status back to 4 (completed), actual=$($order.status)"

# ================= 场景 6：作废收货单 → 库存与已收数量回滚 =================
Log ""
Log "=== 6. void receipt (rollback) ==="
$stockBeforeVoid = Invoke-MySql "SELECT IFNULL(SUM(shelf_quantity),0) FROM wms_stock WHERE store_id=$storeId;"
Invoke-RestMethod -Uri "$Base/api/v1/purchase-receipts/$receiptId2/cancel" -Method PUT -Headers $headers `
  -ContentType 'application/json' -Body (@{ reason = 'void' } | ConvertTo-Json) | Out-Null
$order = (Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId" -Headers $headers).data
Ok ([math]::Abs([double]$order.totalReceivedQty - 30) -lt 0.01) "totalReceivedQty back to 30, actual=$($order.totalReceivedQty)"
Ok ($order.status -eq 3) "status back to 3 (partially received), actual=$($order.status)"

# ================= 场景 7：已收货订单不可取消 =================
Log ""
Log "=== 7. cancel is blocked after receipt ==="
$cancelRes = Invoke-RestMethod -Uri "$Base/api/v1/purchase-orders/$orderId/cancel" -Method PUT -Headers $headers `
  -ContentType 'application/json' -Body (@{ reason = 'x' } | ConvertTo-Json)
Ok ($cancelRes.code -ne 200) "cancel after receipt is rejected, code=$($cancelRes.code)"

# ================= 清理 =================
Log ""
Log "=== cleanup ==="
Invoke-MySql "DELETE FROM pms_purchase_return_item WHERE return_id=$returnId; DELETE FROM pms_purchase_return WHERE id=$returnId; DELETE FROM wms_purchase_receipt_item WHERE receipt_id IN ($receiptId,$receiptId2); DELETE FROM wms_purchase_receipt WHERE id IN ($receiptId,$receiptId2); DELETE FROM pms_purchase_order_item WHERE order_id=$orderId; DELETE FROM pms_purchase_order WHERE id=$orderId;"
$left = Invoke-MySql "SELECT COUNT(*) FROM pms_purchase_order WHERE id=$orderId;"
Ok ($left.Trim() -eq '0') "test data cleaned, left=$($left.Trim())"

Log ""
if ($script:FAILED) { Log "SOME CHECKS FAILED"; exit 1 } else { Log "ALL CHECKS PASSED"; exit 0 }
