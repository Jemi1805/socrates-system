<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use App\Models\Usuario;
use App\Models\Permiso;
use App\Models\Rol;

class UsuarioPermisoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run()
    {
        // 1) Crear permisos base (CRUD por módulo) y especiales
        $this->seedPermisos();

        // 2) Crear usuarios base (admin y usuario)
        $admin = $this->seedUsuariosBase();

        // 3) Asignar TODOS los permisos DIRECTAMENTE al admin y a TODOS los super_admin
        $permIds = Permiso::pluck('id')->all();
        $sync = [];
        foreach ($permIds as $pid) { $sync[$pid] = ['concedido' => true]; }
        if ($admin) {
            $admin->permisos()->syncWithoutDetaching($sync);
        }
        $superAdminRol = class_exists(Rol::class) ? Rol::where('nombre', 'super_admin')->first() : null;
        if ($superAdminRol) {
            $superAdmins = Usuario::where('rol_id', $superAdminRol->id)->get();
            foreach ($superAdmins as $u) {
                $u->permisos()->syncWithoutDetaching($sync);
            }
        }
    }

    private function seedPermisos()
    {
        $modulos = [
            'usuarios' => 'Gestión de Usuarios',
            'roles' => 'Gestión de Roles',
            'permisos' => 'Gestión de Permisos',
            'dashboard' => 'Panel de Control',
            'reportes' => 'Reportes y Estadísticas',
            'configuracion' => 'Configuración del Sistema',
        ];

        foreach ($modulos as $mod => $nombre) {
            // Crea crear/leer/actualizar/eliminar
            Permiso::crearPermisosCrud($mod, $nombre);
        }

        // Permisos especiales adicionales
        $especiales = [
            [
                'codigo' => 'usuarios.activar_desactivar',
                'nombre' => 'Activar/Desactivar Usuarios',
                'descripcion' => 'Permite activar o desactivar usuarios',
            ],
        ];
        foreach ($especiales as $p) {
            if (!Permiso::where('codigo', $p['codigo'])->exists()) {
                Permiso::create($p);
            }
        }
    }

    private function seedUsuariosBase()
    {
        // Asegurar existencia de roles mínimos (no se usan para permisos, solo referencia opcional)
        $superAdminRol = null;
        $userRol = null;
        if (class_exists(Rol::class)) {
            $superAdminRol = Rol::firstOrCreate(
                ['nombre' => 'super_admin'],
                [
                    'descripcion' => 'Super Administrador',
                    'nivel_acceso' => 100,
                    'activo' => true,
                ]
            );
            $userRol = Rol::firstOrCreate(
                ['nombre' => 'user'],
                [
                    'descripcion' => 'Usuario',
                    'nivel_acceso' => 10,
                    'activo' => true,
                ]
            );
        }

        $admin = Usuario::updateOrCreate(
            ['nombre_usuario' => env('ADMIN_USERNAME', 'admin')],
            [
                'nombre_usuario' => env('ADMIN_USERNAME', 'admin'),
                'contrasena' => env('ADMIN_PASSWORD', 'admin123'), // encripta por mutator
                'rol_id' => $superAdminRol ? $superAdminRol->id : null,
                'activo' => true,
                'fecha_creacion' => now(),
            ]
        );

        // Usuario básico sin permisos
        Usuario::updateOrCreate(
            ['nombre_usuario' => env('DEFAULT_USER_USERNAME', 'usuario')],
            [
                'nombre_usuario' => env('DEFAULT_USER_USERNAME', 'usuario'),
                'contrasena' => env('DEFAULT_USER_PASSWORD', 'user123'),
                'rol_id' => $userRol ? $userRol->id : null,
                'activo' => true,
                'fecha_creacion' => now(),
            ]
        );

        return $admin;
    }
}
