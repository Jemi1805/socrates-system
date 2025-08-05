<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
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
            'users' => 'Usuarios',
            'roles' => 'Roles',
            'permissions' => 'Permisos',
            'dashboard' => 'Dashboard',
            'reports' => 'Reportes',
            'settings' => 'Configuración',
        ];

        foreach ($modules as $module => $displayModule) {
            Permission::createCrudPermissions($module, $displayModule);
        }

        // Permisos especiales
        $specialPermissions = [
            [
                'name' => 'system.admin',
                'display_name' => 'Administrador del Sistema',
                'description' => 'Acceso completo al sistema',
                'module' => 'system',
                'action' => 'admin',
            ],
            [
                'name' => 'users.change_password',
                'display_name' => 'Cambiar Contraseña de Usuarios',
                'description' => 'Permite cambiar la contraseña de otros usuarios',
                'module' => 'users',
                'action' => 'change_password',
            ],
            [
                'name' => 'users.activate_deactivate',
                'display_name' => 'Activar/Desactivar Usuarios',
                'description' => 'Permite activar o desactivar usuarios',
                'module' => 'users',
                'action' => 'activate_deactivate',
            ],
        ];

        foreach ($specialPermissions as $permission) {
            Permission::create($permission);
        }
    }

    /**
     * Crear roles básicos
     */
    private function createRoles()
    {
        $roles = [
            [
                'name' => 'super_admin',
                'display_name' => 'Super Administrador',
                'description' => 'Acceso completo al sistema con todos los permisos',
                'is_active' => true,
            ],
            [
                'name' => 'admin',
                'display_name' => 'Administrador',
                'description' => 'Administrador con permisos de gestión',
                'is_active' => true,
            ],
            [
                'name' => 'manager',
                'display_name' => 'Gerente',
                'description' => 'Gerente con permisos de supervisión',
                'is_active' => true,
            ],
            [
                'name' => 'user',
                'display_name' => 'Usuario',
                'description' => 'Usuario básico del sistema',
                'is_active' => true,
            ],
            [
                'name' => 'guest',
                'display_name' => 'Invitado',
                'description' => 'Usuario invitado con permisos limitados',
                'is_active' => true,
            ],
        ];

        foreach ($roles as $role) {
            Role::create($role);
        }
    }

    /**
     * Asignar permisos a roles
     */
    private function assignPermissionsToRoles()
    {
        // Super Admin - Todos los permisos
        $superAdmin = Role::where('name', 'super_admin')->first();
        $allPermissions = Permission::active()->pluck('id')->toArray();
        $superAdmin->assignPermissions($allPermissions);

        // Admin - Permisos de administración
        $admin = Role::where('name', 'admin')->first();
        $adminPermissions = Permission::active()
            ->whereIn('module', ['users', 'roles', 'permissions', 'dashboard', 'reports'])
            ->pluck('id')
            ->toArray();
        $admin->assignPermissions($adminPermissions);

        // Manager - Permisos de gestión
        $manager = Role::where('name', 'manager')->first();
        $managerPermissions = Permission::active()
            ->whereIn('module', ['users', 'dashboard', 'reports'])
            ->whereIn('action', ['read', 'create', 'update'])
            ->pluck('id')
            ->toArray();
        $manager->assignPermissions($managerPermissions);

        // User - Permisos básicos
        $user = Role::where('name', 'user')->first();
        $userPermissions = Permission::active()
            ->whereIn('module', ['dashboard'])
            ->where('action', 'read')
            ->pluck('id')
            ->toArray();
        $user->assignPermissions($userPermissions);

        // Guest - Solo lectura del dashboard
        $guest = Role::where('name', 'guest')->first();
        $guestPermissions = Permission::active()
            ->where('module', 'dashboard')
            ->where('action', 'read')
            ->pluck('id')
            ->toArray();
        $guest->assignPermissions($guestPermissions);
    }

    /**
     * Crear usuario administrador por defecto
     */
    private function createAdminUser()
    {
        $superAdminRole = Role::where('name', 'super_admin')->first();

        User::create([
            'name' => 'Super Administrador',
            'first_name' => 'Super',
            'last_name' => 'Administrador',
            'email' => 'admin@socrates.com',
            'password' => 'admin123',
            'role_id' => $superAdminRole->id,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);

        // Usuario de prueba
        $userRole = Role::where('name', 'user')->first();

        User::create([
            'name' => 'Usuario de Prueba',
            'first_name' => 'Usuario',
            'last_name' => 'Prueba',
            'email' => 'user@socrates.com',
            'password' => 'user123',
            'role_id' => $userRole->id,
            'is_active' => true,
            'email_verified_at' => now(),
        ]);
    }
}
