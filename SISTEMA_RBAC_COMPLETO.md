# 🛡️ Sistema RBAC Completo - Socrates System

## 📋 **Resumen del Sistema**

Se ha implementado un sistema completo de **Role-Based Access Control (RBAC)** para el proyecto Socrates System, basado en tu estructura de base de datos existente.

---

## 🗄️ **Estructura de Base de Datos**

### **Tablas Principales:**
- **`rol`** - Roles del sistema
- **`permiso`** - Permisos específicos
- **`rol_permiso`** - Relación muchos a muchos entre roles y permisos
- **`usuario`** - Usuarios del sistema con rol asignado

### **Campos Principales:**
```sql
-- Tabla: rol
- id, nombre, descripcion, nivel_acceso, fecha_creacion, activo

-- Tabla: permiso  
- id, codigo, nombre, descripcion

-- Tabla: rol_permiso
- id, rol_id, permiso_id, concedido

-- Tabla: usuario
- id, nombre_usuario, contrasena, email, rol_id, activo, fecha_creacion, etc.
```

---

## 🎭 **Roles Creados**

| Rol | Nivel | Descripción | Permisos |
|-----|-------|-------------|----------|
| **super_admin** | 100 | Super Administrador | Todos los permisos |
| **admin** | 80 | Administrador | Todos excepto config crítica |
| **manager** | 60 | Gerente | Gestión usuarios y reportes |
| **user** | 20 | Usuario básico | Solo lectura básica |
| **guest** | 10 | Invitado | Solo dashboard |

---

## 🔑 **Permisos del Sistema**

### **Módulos y Acciones:**
```
usuarios.crear    - Crear usuarios
usuarios.leer     - Ver usuarios  
usuarios.actualizar - Editar usuarios
usuarios.eliminar - Eliminar usuarios

roles.crear       - Crear roles
roles.leer        - Ver roles
roles.actualizar  - Editar roles  
roles.eliminar    - Eliminar roles

permisos.crear    - Crear permisos
permisos.leer     - Ver permisos
permisos.actualizar - Editar permisos
permisos.eliminar - Eliminar permisos

dashboard.leer    - Acceso al panel
reportes.crear    - Crear reportes
reportes.leer     - Ver reportes
configuracion.*   - Configuración sistema
```

---

## 👥 **Usuarios por Defecto**

| Usuario | Email | Contraseña | Rol |
|---------|-------|------------|-----|
| **admin** | admin@socrates.com | admin123 | super_admin |
| **usuario** | user@socrates.com | user123 | user |

---

## 🏗️ **Arquitectura del Sistema**

### **Modelos Eloquent:**
- **`Usuario`** - Extiende Authenticatable, usa HasApiTokens de Sanctum
- **`Rol`** - Gestión de roles con relaciones
- **`Permiso`** - Gestión de permisos con agrupación por módulos

### **Controladores API:**
- **`AuthController`** - Login, registro, logout, cambio contraseña
- **`UserController`** - CRUD usuarios con validaciones
- **`RolController`** - CRUD roles y asignación de permisos

### **Middleware:**
- **`CheckRole`** - Verificar roles específicos
- **`CheckPermission`** - Verificar permisos específicos

---

## 🌐 **Rutas API Disponibles**

### **🔐 Autenticación (Sin middleware):**
```
POST /api/auth/login          - Iniciar sesión
POST /api/auth/register       - Registrar usuario
```

### **🔒 Autenticadas (Con Sanctum):**
```
GET  /api/auth/me             - Info usuario actual
POST /api/auth/logout         - Cerrar sesión
POST /api/auth/change-password - Cambiar contraseña
GET  /api/user                - Usuario con rol y permisos
```

### **👤 Gestión de Usuarios:**
```
GET    /api/users             - Listar usuarios (permission:usuarios.leer)
POST   /api/users             - Crear usuario (permission:usuarios.crear)
GET    /api/users/{id}        - Ver usuario (permission:usuarios.leer)
PUT    /api/users/{id}        - Actualizar usuario (permission:usuarios.actualizar)
DELETE /api/users/{id}        - Eliminar usuario (permission:usuarios.eliminar)
```

### **🛡️ Gestión de Roles:**
```
GET    /api/roles             - Listar roles (permission:roles.leer)
POST   /api/roles             - Crear rol (permission:roles.crear)
GET    /api/roles/{id}        - Ver rol (permission:roles.leer)
PUT    /api/roles/{id}        - Actualizar rol (permission:roles.actualizar)
DELETE /api/roles/{id}        - Eliminar rol (permission:roles.eliminar)
GET    /api/roles/permisos    - Listar permisos disponibles
POST   /api/roles/{id}/permisos - Asignar permisos a rol
GET    /api/roles/{id}/usuarios - Usuarios de un rol
```

---

## 🔧 **Configuración Técnica**

### **Autenticación:**
- **Laravel Sanctum** para tokens API
- **Tokens personales** para autenticación stateless
- **Middleware auth:sanctum** en rutas protegidas

### **Validaciones:**
- **Usuarios únicos** por email y nombre_usuario
- **Roles únicos** por nombre
- **Permisos únicos** por código
- **Validación de estado activo** en middleware

### **Seguridad:**
- **Contraseñas hasheadas** con bcrypt
- **Verificación de usuario activo** en middleware
- **Control granular de permisos** por acción
- **Prevención de auto-eliminación** de usuarios

---

## 🚀 **Cómo Usar el Sistema**

### **1. Autenticación:**
```javascript
// Login
POST /api/auth/login
{
  "email": "admin@socrates.com",
  "password": "admin123"
}

// Respuesta incluye token
{
  "success": true,
  "data": {
    "user": {...},
    "token": "1|abc123...",
    "token_type": "Bearer"
  }
}
```

### **2. Usar Token en Requests:**
```javascript
// Headers en todas las requests autenticadas
Authorization: Bearer 1|abc123...
Accept: application/json
Content-Type: application/json
```

### **3. Verificar Permisos en Frontend:**
```javascript
// El usuario viene con sus permisos
const user = response.data.user;
const permissions = user.permissions;

// Verificar si tiene permiso
const canCreateUsers = permissions.includes('usuarios.crear');
```

---

## 🧪 **Testing con Postman/Insomnia**

### **Colección de Pruebas:**
Se puede crear una colección con:

1. **Variables de entorno:**
   - `base_url`: http://localhost:8080/api
   - `token`: (se actualiza automáticamente)

2. **Tests básicos:**
   - Login y obtener token
   - Listar usuarios (requiere permisos)
   - Crear rol (requiere permisos)
   - Asignar permisos a rol

---

## 📈 **Próximas Mejoras**

### **Backend:**
- [ ] Logs de auditoría para cambios
- [ ] Rate limiting en APIs
- [ ] Caché de permisos
- [ ] Notificaciones por email
- [ ] API de estadísticas

### **Frontend Angular:**
- [ ] Componentes de gestión de usuarios
- [ ] Componentes de gestión de roles
- [ ] Guards para rutas protegidas
- [ ] Interceptors para tokens
- [ ] UI para asignación de permisos

---

## 🆘 **Troubleshooting**

### **Errores Comunes:**

1. **"Trait HasApiTokens not found"**
   - Instalar: `composer require laravel/sanctum`
   - Ejecutar: `php artisan vendor:publish --provider="Laravel\Sanctum\SanctumServiceProvider"`

2. **"Table already exists"**
   - Las migraciones verifican si la tabla existe antes de crearla
   - Ejecutar: `php artisan migrate:status` para ver estado

3. **"Unauthenticated"**
   - Verificar token en header Authorization
   - Verificar que el usuario esté activo

4. **"Sin permisos"**
   - Verificar que el usuario tenga el permiso requerido
   - Verificar que el rol tenga el permiso asignado

---

## ✅ **Estado Actual**

- ✅ Base de datos configurada
- ✅ Modelos Eloquent creados
- ✅ Migraciones ejecutadas
- ✅ Seeders con datos iniciales
- ✅ Controladores API completos
- ✅ Middleware de seguridad
- ✅ Rutas API configuradas
- ✅ Sanctum instalado y configurado
- ⏳ Frontend Angular (pendiente)

**¡El sistema RBAC está completamente funcional y listo para usar!** 🎉
