# 🔐 Sistema de Roles y Permisos - Socrates System

## 📋 Estructura Creada

### 🗄️ **Migraciones**
- `2024_08_01_000001_create_roles_table.php` - Tabla de roles
- `2024_08_01_000002_create_permissions_table.php` - Tabla de permisos
- `2024_08_01_000003_create_role_permission_table.php` - Tabla pivote rol-permiso
- `2024_08_01_000004_add_role_fields_to_users_table.php` - Campos adicionales en users

### 🏗️ **Modelos**
- `Role.php` - Modelo de roles con relaciones y métodos útiles
- `Permission.php` - Modelo de permisos con métodos de gestión
- `User.php` - Modelo de usuario actualizado con sistema de roles

### 🌱 **Seeders**
- `RolePermissionSeeder.php` - Datos iniciales del sistema
- `DatabaseSeeder.php` - Actualizado para incluir el seeder

### 🔒 **Middleware**
- `CheckPermission.php` - Verificar permisos específicos
- `CheckRole.php` - Verificar roles específicos

## 🚀 **Cómo Usar**

### **1. Ejecutar Migraciones y Seeders**
```bash
# Ejecutar migraciones
docker-compose run --rm artisan migrate

# Ejecutar seeders (crea roles, permisos y usuarios por defecto)
docker-compose run --rm artisan db:seed
```

### **2. Usuarios por Defecto Creados**
- **Super Admin**: `admin@socrates.com` / `admin123`
- **Usuario**: `user@socrates.com` / `user123`

### **3. Roles Creados**
- `super_admin` - Acceso completo
- `admin` - Administrador
- `manager` - Gerente
- `user` - Usuario básico
- `guest` - Invitado

### **4. Módulos de Permisos**
- `users` - Gestión de usuarios
- `roles` - Gestión de roles
- `permissions` - Gestión de permisos
- `dashboard` - Acceso al dashboard
- `reports` - Reportes
- `settings` - Configuración

### **5. Acciones de Permisos**
- `create` - Crear
- `read` - Ver/Leer
- `update` - Editar/Actualizar
- `delete` - Eliminar

## 💻 **Ejemplos de Uso en Código**

### **Verificar Permisos en Controladores**
```php
// Verificar si el usuario tiene un permiso específico
if (auth()->user()->hasPermission('users.create')) {
    // El usuario puede crear usuarios
}

// Verificar múltiples permisos
if (auth()->user()->hasAnyPermission(['users.create', 'users.update'])) {
    // El usuario puede crear O editar usuarios
}

// Verificar todos los permisos
if (auth()->user()->hasAllPermissions(['users.create', 'users.update'])) {
    // El usuario puede crear Y editar usuarios
}
```

### **Verificar Roles**
```php
// Verificar rol específico
if (auth()->user()->hasRole('admin')) {
    // Es administrador
}

// Verificar múltiples roles
if (auth()->user()->hasAnyRole(['admin', 'manager'])) {
    // Es admin O manager
}
```

### **Usar Middleware en Rutas**
```php
// Verificar permiso específico
Route::get('/users', [UserController::class, 'index'])
    ->middleware('permission:users.read');

// Verificar rol específico
Route::get('/admin', [AdminController::class, 'index'])
    ->middleware('role:admin');

// Verificar múltiples roles
Route::get('/management', [ManagementController::class, 'index'])
    ->middleware('role:admin,manager');
```

### **Gestión de Roles y Permisos**
```php
// Asignar rol a usuario
$user = User::find(1);
$user->assignRole(2); // ID del rol

// Obtener permisos del usuario
$permissions = $user->getPermissions();

// Asignar permisos a rol
$role = Role::find(1);
$role->assignPermissions([1, 2, 3]); // IDs de permisos

// Crear permisos CRUD para un módulo
Permission::createCrudPermissions('products', 'Productos');
```

## 🔧 **Configuración en Kernel.php**

Agregar los middleware en `app/Http/Kernel.php`:

```php
protected $middlewareAliases = [
    // ... otros middleware
    'permission' => \App\Http\Middleware\CheckPermission::class,
    'role' => \App\Http\Middleware\CheckRole::class,
];
```

## 📊 **Estructura de Base de Datos**

### **Tabla: roles**
- `id` - ID único
- `name` - Nombre único del rol
- `display_name` - Nombre para mostrar
- `description` - Descripción del rol
- `is_active` - Estado activo/inactivo

### **Tabla: permissions**
- `id` - ID único
- `name` - Nombre único del permiso (ej: users.create)
- `display_name` - Nombre para mostrar
- `description` - Descripción del permiso
- `module` - Módulo al que pertenece
- `action` - Acción del permiso
- `is_active` - Estado activo/inactivo

### **Tabla: role_permission**
- `role_id` - ID del rol
- `permission_id` - ID del permiso

### **Tabla: users (campos agregados)**
- `role_id` - ID del rol asignado
- `first_name` - Primer nombre
- `last_name` - Apellido
- `phone` - Teléfono
- `avatar` - Avatar/foto
- `is_active` - Estado activo/inactivo
- `last_login_at` - Último login
- `last_login_ip` - IP del último login

## 🎯 **Próximos Pasos**

1. **Registrar Middleware** en `Kernel.php`
2. **Crear Controladores** para gestión de roles y permisos
3. **Implementar en Frontend** Angular las verificaciones
4. **Crear Rutas API** protegidas con middleware
5. **Agregar Validaciones** en formularios

## 🔍 **Comandos Útiles**

```bash
# Ver usuarios con sus roles
docker-compose run --rm artisan tinker
>>> User::with('role')->get()

# Ver permisos de un rol
>>> Role::with('permissions')->find(1)

# Crear nuevo permiso
>>> Permission::create(['name' => 'products.create', 'display_name' => 'Crear Productos', 'module' => 'products', 'action' => 'create'])
```
