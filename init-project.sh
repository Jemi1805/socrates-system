#!/bin/bash

# Script de inicialización del proyecto Socrates System
echo "🚀 Inicializando proyecto Socrates System..."

# Detener contenedores existentes
echo "📦 Deteniendo contenedores existentes..."
docker-compose down

# Limpiar imágenes y volúmenes si es necesario
echo "🧹 Limpiando recursos Docker..."
docker system prune -f

# Construir imágenes
echo "🔨 Construyendo imágenes Docker..."
docker-compose build --no-cache

# Copiar archivo de configuración
echo "⚙️ Configurando Laravel..."
if [ ! -f "./src/.env" ]; then
    cp ./src/.env.docker ./src/.env
    echo "✅ Archivo .env creado desde .env.docker"
else
    echo "⚠️ El archivo .env ya existe, revisa la configuración manualmente"
fi

# Levantar servicios
echo "🚀 Levantando servicios..."
docker-compose up -d mysql phpmyadmin

# Esperar a que MySQL esté listo
echo "⏳ Esperando a que MySQL esté listo..."
sleep 30

# Levantar PHP y otros servicios
docker-compose up -d php composer

# Instalar dependencias de Laravel
echo "📦 Instalando dependencias de Laravel..."
docker-compose run --rm composer install

# Generar key de aplicación
echo "🔑 Generando clave de aplicación..."
docker-compose run --rm artisan key:generate

# Ejecutar migraciones
echo "🗄️ Ejecutando migraciones..."
docker-compose run --rm artisan migrate --force

# Construir Angular
echo "🅰️ Construyendo aplicación Angular..."
docker-compose run --rm angular-builder

# Levantar servidor web
echo "🌐 Levantando servidor web..."
docker-compose up -d server

echo "✅ ¡Proyecto inicializado correctamente!"
echo ""
echo "🌐 Accesos:"
echo "   - Aplicación: http://localhost:8080"
echo "   - phpMyAdmin: http://localhost:8090"
echo "   - Angular Dev: http://localhost:4200 (si usas angular-dev)"
echo ""
echo "📊 Base de datos:"
echo "   - Host: localhost:3307"
echo "   - Usuario: root"
echo "   - Contraseña: root.pa55"
echo "   - Base de datos: socrates_db"
echo ""
echo "🔧 Comandos útiles:"
echo "   - Ver logs: docker-compose logs -f"
echo "   - Ejecutar Artisan: docker-compose run --rm artisan [comando]"
echo "   - Acceder a contenedor PHP: docker-compose exec php sh"
