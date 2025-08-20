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

        // Asignar permisos a roles
        $this->asignarPermisos();

        // Crear usuarios por defecto
        $this->crearUsuarios();

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        $this->command->info('✅ Roles, permisos y usuarios creados exitosamente!');
    }

    /**
     * Asignar permisos a roles
     */
    private function asignarPermisos()
    {
        $superAdmin = Rol::where('nombre', 'super_admin')->first();
        $admin = Rol::where('nombre', 'admin')->first();
        $manager = Rol::where('nombre', 'manager')->first();
        $user = Rol::where('nombre', 'user')->first();
        $guest = Rol::where('nombre', 'guest')->first();

        $todosLosPermisos = Permiso::all();

        // Super Admin: todos los permisos
        if ($superAdmin) {
            foreach ($todosLosPermisos as $permiso) {
                DB::table('rol_permiso')->updateOrInsert(
                    [
                        'rol_id' => $superAdmin->id,
                        'permiso_id' => $permiso->id,
                    ],
                    [
                        'concedido' => true,
                    ]
                );
            }
        }

        // Admin: todos excepto configuración crítica
        if ($admin) {
            $permisosAdmin = Permiso::where('codigo', 'not like', 'configuracion.eliminar')->get();
            foreach ($permisosAdmin as $permiso) {
                DB::table('rol_permiso')->updateOrInsert(
                    [
                        'rol_id' => $admin->id,
                        'permiso_id' => $permiso->id,
                    ],
                    [
                        'concedido' => true,
                    ]
                );
            }
        }

        // Manager: gestión de usuarios y reportes
        if ($manager) {
            $permisosManager = Permiso::whereIn('codigo', [
                'usuarios.crear', 'usuarios.leer', 'usuarios.actualizar',
                'roles.leer',
                'dashboard.leer',
                'reportes.leer', 'reportes.crear',
            ])->get();

            foreach ($permisosManager as $permiso) {
                DB::table('rol_permiso')->updateOrInsert(
                    [
                        'rol_id' => $manager->id,
                        'permiso_id' => $permiso->id,
                    ],
                    [
                        'concedido' => true,
                    ]
                );
            }
        }

        // User: solo lectura básica
        if ($user) {
            $permisosUser = Permiso::whereIn('codigo', [
                'dashboard.leer',
                'usuarios.leer', // solo su propio perfil
            ])->get();

            foreach ($permisosUser as $permiso) {
                DB::table('rol_permiso')->updateOrInsert(
                    [
                        'rol_id' => $user->id,
                        'permiso_id' => $permiso->id,
                    ],
                    [
                        'concedido' => true,
                    ]
                );
            }
        }

        // Guest: solo dashboard
        if ($guest) {
            $permisoGuest = Permiso::where('codigo', 'dashboard.leer')->first();
            if ($permisoGuest) {
                DB::table('rol_permiso')->updateOrInsert(
                    [
                        'rol_id' => $guest->id,
                        'permiso_id' => $permisoGuest->id,
                    ],
                    [
                        'concedido' => true,
                    ]
                );
            }
        }
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
            Usuario::updateOrCreate(
                ['email' => 'admin@socrates.com'],
                [
                    'nombre_usuario' => 'admin',
                    'contrasena' => Hash::make('admin123'),
                    'rol_id' => $superAdminRol->id,
                    'activo' => true,
                ]
            );
        }

        // Usuario básico
        if ($userRol) {
            Usuario::updateOrCreate(
                ['email' => 'user@socrates.com'],
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
