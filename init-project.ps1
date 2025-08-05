# Script de inicialización del proyecto Socrates System para Windows
Write-Host "🚀 Inicializando proyecto Socrates System..." -ForegroundColor Green

# Detener contenedores existentes
Write-Host "📦 Deteniendo contenedores existentes..." -ForegroundColor Yellow
docker-compose down

# Limpiar imágenes y volúmenes si es necesario
Write-Host "🧹 Limpiando recursos Docker..." -ForegroundColor Yellow
docker system prune -f

# Construir imágenes
Write-Host "🔨 Construyendo imágenes Docker..." -ForegroundColor Yellow
docker-compose build --no-cache

# Copiar archivo de configuración
Write-Host "⚙️ Configurando Laravel..." -ForegroundColor Yellow
if (-not (Test-Path "./src/.env")) {
    Copy-Item "./src/.env.docker" "./src/.env"
    Write-Host "✅ Archivo .env creado desde .env.docker" -ForegroundColor Green
} else {
    Write-Host "⚠️ El archivo .env ya existe, revisa la configuración manualmente" -ForegroundColor Red
}

# Levantar servicios
Write-Host "🚀 Levantando servicios..." -ForegroundColor Yellow
docker-compose up -d mysql phpmyadmin

# Esperar a que MySQL esté listo
Write-Host "⏳ Esperando a que MySQL esté listo..." -ForegroundColor Yellow
Start-Sleep -Seconds 30

# Levantar PHP y otros servicios
docker-compose up -d php composer

# Instalar dependencias de Laravel
Write-Host "📦 Instalando dependencias de Laravel..." -ForegroundColor Yellow
docker-compose run --rm composer install

# Generar key de aplicación
Write-Host "🔑 Generando clave de aplicación..." -ForegroundColor Yellow
docker-compose run --rm artisan key:generate

# Ejecutar migraciones
Write-Host "🗄️ Ejecutando migraciones..." -ForegroundColor Yellow
docker-compose run --rm artisan migrate --force

# Construir Angular
Write-Host "🅰️ Construyendo aplicación Angular..." -ForegroundColor Yellow
docker-compose run --rm angular-builder

# Levantar servidor web
Write-Host "🌐 Levantando servidor web..." -ForegroundColor Yellow
docker-compose up -d server

Write-Host "✅ ¡Proyecto inicializado correctamente!" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Accesos:" -ForegroundColor Cyan
Write-Host "   - Aplicación: http://localhost:8080" -ForegroundColor White
Write-Host "   - phpMyAdmin: http://localhost:8090" -ForegroundColor White
Write-Host "   - Angular Dev: http://localhost:4200 (si usas angular-dev)" -ForegroundColor White
Write-Host ""
Write-Host "📊 Base de datos:" -ForegroundColor Cyan
Write-Host "   - Host: localhost:3307" -ForegroundColor White
Write-Host "   - Usuario: root" -ForegroundColor White
Write-Host "   - Contraseña: root.pa55" -ForegroundColor White
Write-Host "   - Base de datos: socrates_db" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Comandos útiles:" -ForegroundColor Cyan
Write-Host "   - Ver logs: docker-compose logs -f" -ForegroundColor White
Write-Host "   - Ejecutar Artisan: docker-compose run --rm artisan [comando]" -ForegroundColor White
Write-Host "   - Acceder a contenedor PHP: docker-compose exec php sh" -ForegroundColor White
