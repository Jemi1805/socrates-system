<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Rol;
use App\Models\Permiso;
use App\Models\Usuario;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class RolPermisoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run()
    {
        // Limpiar tablas existentes (opcional)
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        
        // Crear Roles
        $roles = [
            [
                'nombre' => 'super_admin',
                'descripcion' => 'Super Administrador con acceso completo al sistema',
                'nivel_acceso' => 100,
                'activo' => true,
            ],
            [
                'nombre' => 'admin',
                'descripcion' => 'Administrador del sistema',
                'nivel_acceso' => 80,
                'activo' => true,
            ],
            [
                'nombre' => 'manager',
                'descripcion' => 'Gerente con permisos de gestión',
                'nivel_acceso' => 60,
                'activo' => true,
            ],
            [
                'nombre' => 'user',
                'descripcion' => 'Usuario básico del sistema',
                'nivel_acceso' => 20,
                'activo' => true,
            ],
            [
                'nombre' => 'guest',
                'descripcion' => 'Usuario invitado con permisos limitados',
                'nivel_acceso' => 10,
                'activo' => true,
            ],
        ];

        foreach ($roles as $rolData) {
            Rol::updateOrCreate(
                ['nombre' => $rolData['nombre']],
                $rolData
            );
        }

        // Crear Permisos
        $modulos = [
            'usuarios' => 'Gestión de Usuarios',
            'roles' => 'Gestión de Roles',
            'permisos' => 'Gestión de Permisos',
            'dashboard' => 'Panel de Control',
            'reportes' => 'Reportes y Estadísticas',
            'configuracion' => 'Configuración del Sistema',
        ];

        $acciones = [
            'crear' => 'Crear',
            'leer' => 'Ver/Leer',
            'actualizar' => 'Editar/Actualizar',
            'eliminar' => 'Eliminar',
        ];

        foreach ($modulos as $modulo => $nombreModulo) {
            foreach ($acciones as $accion => $nombreAccion) {
                $codigo = $modulo . '.' . $accion;
                $nombre = $nombreAccion . ' ' . $nombreModulo;
                $descripcion = 'Permite ' . strtolower($nombreAccion) . ' ' . strtolower($nombreModulo);

                Permiso::updateOrCreate(
                    ['codigo' => $codigo],
                    [
                        'nombre' => $nombre,
                        'descripcion' => $descripcion,
                    ]
                );
            }
        }

        // Sin asignación de permisos por rol: solo permisos directos por usuario

        // Crear usuarios por defecto
        $this->crearUsuarios();

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $this->command->info('✅ Roles, permisos y usuarios creados exitosamente!');
    }


    /**
     * Crear usuarios por defecto
     */
    private function crearUsuarios()
    {
        $superAdminRol = Rol::where('nombre', 'super_admin')->first();
        $userRol = Rol::where('nombre', 'user')->first();

        // Super Admin
        if ($superAdminRol) {
            $adminUser = Usuario::updateOrCreate(
                ['nombre_usuario' => 'admin'],
                [
                    'nombre_usuario' => 'admin',
                    'contrasena' => Hash::make('admin123'),
                    'rol_id' => $superAdminRol->id,
                    'activo' => true,
                ]
            );
            // Asignar TODOS los permisos DIRECTAMENTE al usuario admin
            $permIds = Permiso::pluck('id')->all();
            $sync = [];
            foreach ($permIds as $pid) { $sync[$pid] = ['concedido' => true]; }
            $adminUser->permisos()->syncWithoutDetaching($sync);
        }

        // Usuario básico
        if ($userRol) {
            Usuario::updateOrCreate(
                ['nombre_usuario' => 'usuario'],
                [
                    'nombre_usuario' => 'usuario',
                    'contrasena' => Hash::make('user123'),
                    'rol_id' => $userRol->id,
                    'activo' => true,
                ]
            );
        }
    }
}
