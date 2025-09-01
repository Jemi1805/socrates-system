<?php

namespace Database\Seeders;

use App\Models\Permiso;
use App\Models\Rol;
use App\Models\Usuario;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeder.
     */
    public function run()
    {
        // Crear permisos básicos del sistema
        $this->createPermissions();
        
        // Crear roles básicos
        $this->createRoles();
        
        // Asignar permisos a roles
        $this->assignPermissionsToRoles();
        
        // Crear usuario administrador
        $this->createAdminUser();
    }

    /**
     * Crear permisos del sistema
     */
    private function createPermissions()
    {
        $modules = [
            'usuarios' => 'Usuarios',
            'roles' => 'Roles',
            'permisos' => 'Permisos',
            'dashboard' => 'Dashboard',
            'reportes' => 'Reportes',
            'configuracion' => 'Configuración',
        ];

        foreach ($modules as $module => $displayModule) {
            Permiso::crearPermisosCrud($module, $displayModule);
        }

        // Permisos especiales (códigos basados en módulo.acción)
        $permisosEspeciales = [
            [
                'codigo' => 'system.admin',
                'nombre' => 'Administrador del Sistema',
                'descripcion' => 'Acceso completo al sistema',
            ],
            [
                'codigo' => 'usuarios.cambiar_contrasena',
                'nombre' => 'Cambiar Contraseña de Usuarios',
                'descripcion' => 'Permite cambiar la contraseña de otros usuarios',
            ],
            [
                'codigo' => 'usuarios.activar_desactivar',
                'nombre' => 'Activar/Desactivar Usuarios',
                'descripcion' => 'Permite activar o desactivar usuarios',
            ],
        ];

        foreach ($permisosEspeciales as $permiso) {
            // Evitar duplicados si ya existen
            if (!Permiso::existeCodigo($permiso['codigo'])) {
                Permiso::create($permiso);
            }
        }
    }

    /**
     * Crear roles básicos
     */
    private function createRoles()
    {
        $roles = [
            [
                'nombre' => 'super_admin',
                'descripcion' => 'Acceso completo al sistema con todos los permisos',
                'nivel_acceso' => 5,
                'activo' => true,
            ],
            [
                'nombre' => 'admin',
                'descripcion' => 'Administrador con permisos de gestión',
                'nivel_acceso' => 4,
                'activo' => true,
            ],
            [
                'nombre' => 'manager',
                'descripcion' => 'Gerente con permisos de supervisión',
                'nivel_acceso' => 3,
                'activo' => true,
            ],
            [
                'nombre' => 'user',
                'descripcion' => 'Usuario básico del sistema',
                'nivel_acceso' => 2,
                'activo' => true,
            ],
            [
                'nombre' => 'guest',
                'descripcion' => 'Usuario invitado con permisos limitados',
                'nivel_acceso' => 1,
                'activo' => true,
            ],
        ];

        foreach ($roles as $role) {
            Rol::firstOrCreate(['nombre' => $role['nombre']], $role);
        }
    }

    /**
     * Asignar permisos a roles
     */
    private function assignPermissionsToRoles()
    {
        // Super Admin - Todos los permisos
        $superAdmin = Rol::where('nombre', 'super_admin')->first();
        if ($superAdmin) {
            $allPermissions = Permiso::pluck('id')->toArray();
            $superAdmin->asignarPermisos($allPermissions);
        }

        // Admin - Permisos de administración (usuarios, roles, permisos, dashboard, reportes)
        $admin = Rol::where('nombre', 'admin')->first();
        if ($admin) {
            $adminPermissions = Permiso::where(function ($q) {
                $q->where('codigo', 'like', 'usuarios.%')
                  ->orWhere('codigo', 'like', 'roles.%')
                  ->orWhere('codigo', 'like', 'permisos.%')
                  ->orWhere('codigo', 'like', 'dashboard.%')
                  ->orWhere('codigo', 'like', 'reportes.%');
            })->pluck('id')->toArray();
            $admin->asignarPermisos($adminPermissions);
        }

        // Manager - leer/crear/actualizar en usuarios, dashboard y reportes
        $manager = Rol::where('nombre', 'manager')->first();
        if ($manager) {
            $managerPermissions = Permiso::whereIn('codigo', [
                'usuarios.leer', 'usuarios.crear', 'usuarios.actualizar',
                'dashboard.leer', 'dashboard.crear', 'dashboard.actualizar',
                'reportes.leer', 'reportes.crear', 'reportes.actualizar',
            ])->pluck('id')->toArray();
            $manager->asignarPermisos($managerPermissions);
        }

        // User - Solo lectura del dashboard
        $user = Rol::where('nombre', 'user')->first();
        if ($user) {
            $userPermissions = Permiso::whereIn('codigo', ['dashboard.leer'])->pluck('id')->toArray();
            $user->asignarPermisos($userPermissions);
        }

        // Guest - Solo lectura del dashboard
        $guest = Rol::where('nombre', 'guest')->first();
        if ($guest) {
            $guestPermissions = Permiso::whereIn('codigo', ['dashboard.leer'])->pluck('id')->toArray();
            $guest->asignarPermisos($guestPermissions);
        }
    }

    /**
     * Crear usuario administrador por defecto
     */
    private function createAdminUser()
    {
        $superAdminRole = Rol::where('nombre', 'super_admin')->first();
        $userRole = Rol::where('nombre', 'user')->first();

        // Variables de entorno para credenciales
        $adminUsername = env('ADMIN_USERNAME', 'admin');
        $adminEmail = env('ADMIN_EMAIL', 'admin@socrates.com');
        $adminPassword = env('ADMIN_PASSWORD', 'admin123');

        $defaultUserUsername = env('DEFAULT_USER_USERNAME', 'user');
        $defaultUserEmail = env('DEFAULT_USER_EMAIL', 'user@socrates.com');
        $defaultUserPassword = env('DEFAULT_USER_PASSWORD', 'user123');

        if ($superAdminRole) {
            Usuario::firstOrCreate(
                ['email' => $adminEmail],
                [
                    'nombre_usuario' => $adminUsername,
                    'email' => $adminEmail,
                    'contrasena' => $adminPassword, // Se encripta por mutator
                    'rol_id' => $superAdminRole->id,
                    'activo' => true,
                    'fecha_creacion' => now(),
                ]
            );
        }

        if ($userRole) {
            Usuario::firstOrCreate(
                ['email' => $defaultUserEmail],
                [
                    'nombre_usuario' => $defaultUserUsername,
                    'email' => $defaultUserEmail,
                    'contrasena' => $defaultUserPassword, // Se encripta por mutator
                    'rol_id' => $userRole->id,
                    'activo' => true,
                    'fecha_creacion' => now(),
                ]
            );
        }
    }
}

