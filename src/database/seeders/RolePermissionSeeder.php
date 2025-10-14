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
        return;
    }

    /**
     * Crear permisos del sistema
     */
    private function createPermissions() { }

    /**
     * Crear roles básicos
     */
    private function createRoles() { }

    /**
     * Asignar permisos a roles
     */
    private function assignPermissionsToRoles() { }

    /**
     * Crear usuario administrador por defecto
     */
    private function createAdminUser() { }
}

