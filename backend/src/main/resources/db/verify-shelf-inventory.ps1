param([string]$Base = 'http://localhost:8085')

# ============================================================================
# 货架库存 / 上架单 / 调拨 / 库存预警 —— 端到端验证
#
# 前置：
#   1. 已执行 upgrade-shelf-inventory.sql、init-shelf-stock.sql、seed-shelf-inventory-menu.sql
#   2. 已重新编译并重启后端
#
# 用法（请用 PowerShell 7 的 pwsh 执行，Windows PowerShell 5.1 会因中文编码报语法错误）：
#   pwsh -NoProfile -File verify-shelf-inventory.ps1
#   pwsh -NoProfile -File verify-shelf-inventory.ps1 -Base http://localhost:8099
# ============================================================================

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
  $out = & $m -uroot -p123456 --default-character-set=utf8mb4 supermarket_erp -N -e $sql 2>$null
  $ErrorActionPreference = $prev
  return (($out | ForEach-Object { "$_" }) -join ' ').Trim()
}

# ---------- 登录 ----------
$login = Invoke-RestMethod -Uri "$Base/api/v1/auth/login" -Method POST -ContentType 'application/json' `
  -Body (@{ username = 'sysadmin'; password = '123456' } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.data.token)" }
Log "login ok"

# ---------- 基础数据：挑一个仓库库存充足的 门店+商品 ----------
$row = Invoke-MySql "SELECT CONCAT_WS('|', s.store_id, s.product_id, s.warehouse_quantity, s.shelf_quantity) FROM wms_stock s WHERE s.deleted=0 AND s.warehouse_quantity >= 10 ORDER BY s.id LIMIT 1;"
if (-not $row) { Log "no stock row with warehouse_quantity >= 10"; exit 1 }
$parts = $row -split '\|'
$storeId = $parts[0].Trim()
$productId = $parts[1].Trim()
$whBefore = [double]$parts[2]
$shelfBefore = [double]$parts[3]
Log "store=$storeId product=$productId warehouse=$whBefore shelf=$shelfBefore"

# 找第二个门店做调拨目标
$targetStoreId = Invoke-MySql "SELECT id FROM sys_store WHERE deleted=0 AND status=1 AND id <> $storeId ORDER BY id LIMIT 1;"
if (-not $targetStoreId) { Log "no second store for transfer test"; exit 1 }
Log "target store=$targetStoreId"

$wh = { param($s) [double](Invoke-MySql "SELECT IFNULL(warehouse_quantity,0) FROM wms_stock WHERE deleted=0 AND store_id=$s AND product_id=$productId LIMIT 1;") }
$sh = { param($s) [double](Invoke-MySql "SELECT IFNULL(shelf_quantity,0) FROM wms_stock WHERE deleted=0 AND store_id=$s AND product_id=$productId LIMIT 1;") }
function Near([double]$a, [double]$b) { return [math]::Abs($a - $b) -lt 0.01 }

# ============================================================================
Log ""
Log "=== 1. shelf-up: create -> confirm (warehouse -5, shelf +5) ==="
$body = @{
  storeId = [long]$storeId
  remark  = 'auto-test shelf up'
  items   = @(
    @{ productId = [long]$productId; quantity = 5 }
  )
} | ConvertTo-Json -Depth 5
$shelfUpId = (Invoke-RestMethod -Uri "$Base/api/v1/stock/shelf-ups" -Method POST -Headers $headers `
  -ContentType 'application/json' -Body $body).data
Ok ($shelfUpId -gt 0) "shelf-up created, id=$shelfUpId"

$detail = (Invoke-RestMethod -Uri "$Base/api/v1/stock/shelf-ups/$shelfUpId" -Headers $headers).data
Ok ($detail.status -eq 0) "new shelf-up status = 0 (draft), actual=$($detail.status)"
Ok ((Near ([double]$detail.totalQuantity) 5)) "totalQuantity = 5, actual=$($detail.totalQuantity)"

Invoke-RestMethod -Uri "$Base/api/v1/stock/shelf-ups/$shelfUpId/confirm" -Method PUT -Headers $headers | Out-Null
Ok ((Near (& $wh $storeId) ($whBefore - 5))) "warehouse  $whBefore -> $($whBefore - 5), actual=$(& $wh $storeId)"
Ok ((Near (& $sh $storeId) ($shelfBefore + 5))) "shelf  $shelfBefore -> $($shelfBefore + 5), actual=$(& $sh $storeId)"

$detail = (Invoke-RestMethod -Uri "$Base/api/v1/stock/shelf-ups/$shelfUpId" -Headers $headers).data
Ok ($detail.status -eq 1) "after confirm status = 1 (confirmed), actual=$($detail.status)"

# 重复确认应被拒
$dup = Invoke-RestMethod -Uri "$Base/api/v1/stock/shelf-ups/$shelfUpId/confirm" -Method PUT -Headers $headers
Ok ($dup.code -ne 200) "duplicate confirm rejected, code=$($dup.code)"

# ============================================================================
Log ""
Log "=== 2. shelf-up rollback (shelf -5, warehouse +5) ==="
Invoke-RestMethod -Uri "$Base/api/v1/stock/shelf-ups/$shelfUpId/rollback" -Method PUT -Headers $headers | Out-Null
Ok ((Near (& $wh $storeId) $whBefore)) "warehouse back to $whBefore, actual=$(& $wh $storeId)"
Ok ((Near (& $sh $storeId) $shelfBefore)) "shelf back to $shelfBefore, actual=$(& $sh $storeId)"

$detail = (Invoke-RestMethod -Uri "$Base/api/v1/stock/shelf-ups/$shelfUpId" -Headers $headers).data
Ok ($detail.status -eq 2) "after rollback status = 2 (rolled back), actual=$($detail.status)"

# ============================================================================
Log ""
Log "=== 3. shelf-up over-move must be rejected ==="
$overBody = @{
  storeId = [long]$storeId
  remark  = 'over'
  items   = @(
    @{ productId = [long]$productId; quantity = 999999 }
  )
} | ConvertTo-Json -Depth 5
$overId = (Invoke-RestMethod -Uri "$Base/api/v1/stock/shelf-ups" -Method POST -Headers $headers `
  -ContentType 'application/json' -Body $overBody).data
$overRes = Invoke-RestMethod -Uri "$Base/api/v1/stock/shelf-ups/$overId/confirm" -Method PUT -Headers $headers
Ok ($overRes.code -ne 200) "confirm beyond warehouse stock rejected, code=$($overRes.code)"
Ok ((Near (& $wh $storeId) $whBefore)) "warehouse unchanged after rejection, actual=$(& $wh $storeId)"

# ============================================================================
Log ""
Log "=== 4. transfer: source -3, target +3 ==="
$targetBefore = [double](Invoke-MySql "SELECT IFNULL(warehouse_quantity,0) FROM wms_stock WHERE deleted=0 AND store_id=$targetStoreId AND product_id=$productId LIMIT 1;")
$transferBody = @{
  outType       = 2
  storeId       = [long]$storeId
  targetStoreId = [long]$targetStoreId
  remark        = 'auto-test transfer'
  items         = @(
    @{ productId = [long]$productId; quantity = 3 }
  )
} | ConvertTo-Json -Depth 5
$outId = (Invoke-RestMethod -Uri "$Base/api/v1/stock-out" -Method POST -Headers $headers `
  -ContentType 'application/json' -Body $transferBody).data
Ok ($outId -gt 0) "transfer created, id=$outId"

Invoke-RestMethod -Uri "$Base/api/v1/stock-out/$outId/confirm" -Method PUT -Headers $headers | Out-Null
Ok ((Near (& $wh $storeId) ($whBefore - 3))) "source warehouse $whBefore -> $($whBefore - 3), actual=$(& $wh $storeId)"
$targetAfter = [double](Invoke-MySql "SELECT IFNULL(warehouse_quantity,0) FROM wms_stock WHERE deleted=0 AND store_id=$targetStoreId AND product_id=$productId LIMIT 1;")
Ok ((Near $targetAfter ($targetBefore + 3))) "target warehouse $targetBefore -> $($targetBefore + 3), actual=$targetAfter"

# 撤销调拨
Invoke-RestMethod -Uri "$Base/api/v1/stock-out/$outId/rollback-confirm" -Method PUT -Headers $headers | Out-Null
Ok ((Near (& $wh $storeId) $whBefore)) "source warehouse restored to $whBefore, actual=$(& $wh $storeId)"
$targetAfter = [double](Invoke-MySql "SELECT IFNULL(warehouse_quantity,0) FROM wms_stock WHERE deleted=0 AND store_id=$targetStoreId AND product_id=$productId LIMIT 1;")
Ok ((Near $targetAfter $targetBefore)) "target warehouse restored to $targetBefore, actual=$targetAfter"

# ============================================================================
Log ""
Log "=== 5. stock warning fields ==="
$stockPage = (Invoke-RestMethod -Uri "$Base/api/v1/stock?page=1&pageSize=200&storeId=$storeId" -Headers $headers).data
$stockRow = $stockPage.list | Where-Object { "$($_.productId)" -eq "$productId" } | Select-Object -First 1
Ok ($null -ne $stockRow) "stock row found in list"
if ($stockRow) {
  Ok ($null -ne $stockRow.shelfQuantity) "shelfQuantity present: $($stockRow.shelfQuantity)"
  Ok ($null -ne $stockRow.warehouseQuantity) "warehouseQuantity present: $($stockRow.warehouseQuantity)"
  Ok ($null -ne $stockRow.warnThreshold) "warnThreshold present: $($stockRow.warnThreshold)"
  Ok ($null -ne $stockRow.urgentThreshold) "urgentThreshold present: $($stockRow.urgentThreshold)"
  Ok ($null -ne $stockRow.stockStatus) "stockStatus present: $($stockRow.stockStatus)"
  $expectedTotal = [double]$stockRow.warehouseQuantity + [double]$stockRow.shelfQuantity
  Ok ((Near ([double]$stockRow.totalQuantity) $expectedTotal)) "totalQuantity = warehouse + shelf ($expectedTotal)"
}

# ============================================================================
Log ""
Log "=== 6. warnLevel filter ==="
$warnPage = (Invoke-RestMethod -Uri "$Base/api/v1/stock?page=1&pageSize=200&storeId=$storeId&warnLevel=warning" -Headers $headers).data
$allNormal = $true
foreach ($r in $warnPage.list) { if ("$($r.stockStatus)" -eq 'normal') { $allNormal = $false } }
Ok ($allNormal) "warnLevel=warning returns no normal rows (count=$($warnPage.total))"

# ============================================================================
Log ""
Log "=== 7. store-level threshold override ==="
$prodWarn = [double](Invoke-MySql "SELECT stock_warn_threshold FROM pms_product WHERE id=$productId;")
Invoke-MySql "UPDATE wms_stock SET warn_threshold=9999 WHERE deleted=0 AND store_id=$storeId AND product_id=$productId;" | Out-Null
$stockPage2 = (Invoke-RestMethod -Uri "$Base/api/v1/stock?page=1&pageSize=200&storeId=$storeId" -Headers $headers).data
$row2 = $stockPage2.list | Where-Object { "$($_.productId)" -eq "$productId" } | Select-Object -First 1
Ok ((Near ([double]$row2.warnThreshold) 9999)) "store override applied: warnThreshold=9999, actual=$($row2.warnThreshold)"
Ok ($row2.thresholdOverridden -eq $true) "thresholdOverridden = true"
Ok ("$($row2.stockStatus)" -ne 'normal') "status becomes non-normal with huge threshold, actual=$($row2.stockStatus)"
Invoke-MySql "UPDATE wms_stock SET warn_threshold=NULL WHERE deleted=0 AND store_id=$storeId AND product_id=$productId;" | Out-Null

# ============================================================================
Log ""
Log "=== cleanup ==="
Invoke-MySql "DELETE FROM wms_shelf_up_item WHERE shelf_up_id IN ($shelfUpId,$overId); DELETE FROM wms_shelf_up WHERE id IN ($shelfUpId,$overId); DELETE FROM wms_stock_out_item WHERE out_id=$outId; DELETE FROM wms_stock_out WHERE id=$outId; DELETE FROM wms_stock_log WHERE related_no IN (SELECT shelf_up_no FROM wms_shelf_up WHERE id IN ($shelfUpId,$overId));" | Out-Null
$left = Invoke-MySql "SELECT COUNT(*) FROM wms_shelf_up WHERE id IN ($shelfUpId,$overId);"
Ok ($left -eq '0') "test data cleaned, left=$left"

Log ""
if ($script:FAILED) { Log "SOME CHECKS FAILED"; exit 1 } else { Log "ALL CHECKS PASSED"; exit 0 }
