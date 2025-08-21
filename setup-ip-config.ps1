# Script para configurar automaticamente la IP en todos los archivos del proyecto
Write-Host "Configurando IP del sistema..." -ForegroundColor Green

# Usar directamente la IP conocida para este sistema
$localIP = '192.168.0.78'

Write-Host "IP detectada: $localIP" -ForegroundColor Cyan

# Actualizar archivo de configuracion central
$ipConfig = @"
// Archivo de configuracion central para la IP del sistema
const HOST_IP = '$localIP';

module.exports = {
  HOST_IP: HOST_IP,
  API_URL: 'http://' + HOST_IP + ':8080/api',
  FRONTEND_URL: 'http://' + HOST_IP + ':4200',
  PHPMYADMIN_URL: 'http://' + HOST_IP + ':8090',
  LARAVEL_URL: 'http://' + HOST_IP + ':8080'
};
"@

Set-Content -Path "$PSScriptRoot\ip-config.js" -Value $ipConfig
Write-Host "Archivo ip-config.js actualizado" -ForegroundColor Green

# Actualizar .env y .env.example de Laravel
$envContent = Get-Content -Path "$PSScriptRoot\src\.env" -ErrorAction SilentlyContinue
if (-not $envContent) {
    if (Test-Path "$PSScriptRoot\src\.env.example") {
        $envContent = Get-Content -Path "$PSScriptRoot\src\.env.example"
    }
    else {
        $envContent = @()
    }
}

$newEnvContent = @()
$hostIPFound = $false
$appUrlFound = $false

foreach ($line in $envContent) {
    if ($line -match "^HOST_IP=") {
        $newEnvContent += "HOST_IP=$localIP"
        $hostIPFound = $true
    }
    elseif ($line -match "^APP_URL=") {
        $newEnvContent += "APP_URL=http://$localIP`:8080"
        $appUrlFound = $true
    }
    else {
        $newEnvContent += $line
    }
}

if (-not $hostIPFound) {
    $newEnvContent += "HOST_IP=$localIP"
}

if (-not $appUrlFound) {
    $newEnvContent += "APP_URL=http://$localIP`:8080"
}

Set-Content -Path "$PSScriptRoot\src\.env" -Value $newEnvContent
Set-Content -Path "$PSScriptRoot\src\.env.example" -Value $newEnvContent
Write-Host "Archivos .env y .env.example actualizados" -ForegroundColor Green

# Actualizar environment.ts y environment.prod.ts de Angular
$angularEnvContent = @"
export const environment = {
  production: false,
  apiUrl: 'http://$localIP`:8080/api'
};
"@

$angularEnvProdContent = @"
export const environment = {
  production: true,
  apiUrl: 'http://$localIP`:8080/api'
};
"@

Set-Content -Path "$PSScriptRoot\frontend\src\app\environments\environment.ts" -Value $angularEnvContent
Set-Content -Path "$PSScriptRoot\frontend\src\app\environments\environment.prod.ts" -Value $angularEnvProdContent
Write-Host "Archivos de entorno Angular actualizados" -ForegroundColor Green

# Actualizar api-tests.json
$apiTests = Get-Content -Path "$PSScriptRoot\api-tests.json" -Raw | ConvertFrom-Json

foreach ($test in $apiTests.tests) {
    if ($test.url -match "http://.*?:") {
        $test.url = $test.url -replace "http://.*?:", "http://$localIP`:"
    }
}

for ($i = 0; $i -lt $apiTests.instructions.Length; $i++) {
    $apiTests.instructions[$i] = $apiTests.instructions[$i] -replace "http://.*?:", "http://$localIP`:"
}

$apiTests | ConvertTo-Json -Depth 4 | Set-Content -Path "$PSScriptRoot\api-tests.json"
Write-Host "Archivo api-tests.json actualizado" -ForegroundColor Green

Write-Host "`nConfiguracion de IP completada exitosamente`n" -ForegroundColor Green
Write-Host "Para aplicar los cambios, reinicia los contenedores con:" -ForegroundColor Yellow
Write-Host "docker-compose down" -ForegroundColor Cyan
Write-Host "docker-compose up -d" -ForegroundColor Cyan
