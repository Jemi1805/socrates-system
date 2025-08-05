# Script de configuración completa del sistema de autenticación
Write-Host "🔐 Configurando sistema de autenticación completo..." -ForegroundColor Green

# Verificar que Docker esté ejecutándose
Write-Host "📦 Verificando contenedores..." -ForegroundColor Yellow
docker-compose ps

# Instalar Laravel Sanctum
Write-Host "🛡️ Instalando Laravel Sanctum..." -ForegroundColor Yellow
docker-compose run --rm composer require laravel/sanctum

# Publicar configuración de Sanctum
Write-Host "⚙️ Publicando configuración de Sanctum..." -ForegroundColor Yellow
docker-compose run --rm artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"

# Ejecutar migraciones
Write-Host "🗄️ Ejecutando migraciones..." -ForegroundColor Yellow
docker-compose run --rm artisan migrate --force

# Ejecutar seeders
Write-Host "🌱 Ejecutando seeders..." -ForegroundColor Yellow
docker-compose run --rm artisan db:seed --force

# Limpiar cache
Write-Host "🧹 Limpiando cache..." -ForegroundColor Yellow
docker-compose run --rm artisan config:clear
docker-compose run --rm artisan route:clear
docker-compose run --rm artisan cache:clear

# Optimizar aplicación
Write-Host "⚡ Optimizando aplicación..." -ForegroundColor Yellow
docker-compose run --rm artisan config:cache
docker-compose run --rm artisan route:cache

Write-Host "✅ ¡Sistema de autenticación configurado correctamente!" -ForegroundColor Green
Write-Host ""
Write-Host "🔑 Usuarios de prueba creados:" -ForegroundColor Cyan
Write-Host "   - Super Admin: admin@socrates.com / admin123" -ForegroundColor White
Write-Host "   - Usuario: user@socrates.com / user123" -ForegroundColor White
Write-Host ""
Write-Host "🌐 Endpoints disponibles:" -ForegroundColor Cyan
Write-Host "   - POST /api/auth/login - Iniciar sesión" -ForegroundColor White
Write-Host "   - POST /api/auth/register - Registrar usuario" -ForegroundColor White
Write-Host "   - GET /api/auth/me - Información del usuario" -ForegroundColor White
Write-Host "   - GET /api/users - Listar usuarios (requiere permisos)" -ForegroundColor White
Write-Host "   - GET /api/roles - Listar roles (requiere permisos)" -ForegroundColor White
Write-Host ""
Write-Host "📖 Consulta ROLES_PERMISSIONS_GUIDE.md para más información" -ForegroundColor Yellow
