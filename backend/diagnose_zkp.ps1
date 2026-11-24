Write-Host "=== 1. Node/npm/npx availability ===" -ForegroundColor Cyan
foreach ($cmd in @('node', 'npm', 'npx')) {
    $found = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($found) {
        $version = & $cmd --version 2>&1 | Select-Object -First 1
        Write-Host "  ✅ $cmd : $version  ($($found.Source))" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $cmd : NOT FOUND on PATH" -ForegroundColor Red
    }
}

Write-Host "`n=== 2. snarkjs availability ===" -ForegroundColor Cyan
$snarkjs = & npx snarkjs --version 2>&1 | Select-Object -First 1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✅ snarkjs : $snarkjs" -ForegroundColor Green
} else {
    Write-Host "  ❌ snarkjs : $snarkjs" -ForegroundColor Red
}

Write-Host "`n=== 3. Circuit files ===" -ForegroundColor Cyan
$wasm = "circuits\qr_proof\build\qr_proof_js\qr_proof.wasm"
$zkey = "circuits\qr_proof\build\circuit_final.zkey"
foreach ($f in @($wasm, $zkey)) {
    if (Test-Path $f) {
        $size = (Get-Item $f).Length
        $sizeMB = [math]::Round($size / 1MB, 2)
        Write-Host "  ✅ $f  ($sizeMB MB)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $f  NOT FOUND" -ForegroundColor Red
    }
}

Write-Host "`n=== 4. Local snarkjs install ===" -ForegroundColor Cyan
if (Test-Path "node_modules\snarkjs") {
    $pkg = Get-Content "node_modules\snarkjs\package.json" | ConvertFrom-Json
    Write-Host "  ✅ backend/node_modules/snarkjs : $($pkg.version)" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  backend/node_modules/snarkjs : NOT INSTALLED" -ForegroundColor Yellow
}
if (Test-Path "app\services\node_modules\snarkjs") {
    $pkg = Get-Content "app\services\node_modules\snarkjs\package.json" | ConvertFrom-Json
    Write-Host "  ✅ app/services/node_modules/snarkjs : $($pkg.version)" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  app/services/node_modules/snarkjs : NOT INSTALLED" -ForegroundColor Yellow
}

Write-Host "`n=== 5. Python subprocess test ===" -ForegroundColor Cyan
python -c "import subprocess; r = subprocess.run(['npx', 'snarkjs', '--version'], capture_output=True, text=True); print('  returncode:', r.returncode); print('  stdout:', r.stdout.strip()[:200]); print('  stderr:', r.stderr.strip()[:200])"
