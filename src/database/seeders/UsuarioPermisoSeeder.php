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
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        DB::table('usuario_permiso')->truncate();
        DB::table('usuario')->truncate();
        DB::table('rol')->truncate();
        DB::table('permiso')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        $this->seedRoles();

        $this->seedPermisos();

        $admin = $this->seedUsuariosBase();

        $permIds = Permiso::pluck('id')->all();
        $sync = [];
        foreach ($permIds as $pid) { $sync[$pid] = ['concedido' => true]; }
        if ($admin) {
            $admin->permisos()->sync($sync);
        }
        $roleIds = Rol::whereIn('nombre', ['Super Admin', 'Administrador'])->pluck('id');
        if ($roleIds->count()) {
            $usuarios = Usuario::whereIn('rol_id', $roleIds)->get();
            foreach ($usuarios as $u) {
                $u->permisos()->syncWithoutDetaching($sync);
            }
        }
    }

    private function seedPermisos()
    {
        // Solo permisos generalizados solicitados por el usuario
        $permisos = [
            // Búsqueda de estudiantes (SGA)
            ['codigo' => 'sga.estudiantes.buscar', 'nombre' => 'Buscar Estudiantes', 'descripcion' => 'Permite buscar/consultar estudiantes en el SGA'],

            // Postulantes inscritos (vista principal)
            ['codigo' => 'postulantes.inscritos.leer', 'nombre' => 'Ver Postulantes Inscritos', 'descripcion' => 'Permite ver la lista de postulantes inscritos'],

            // Inscripción de modalidad
            ['codigo' => 'inscripciones.crear', 'nombre' => 'Inscribir Modalidad', 'descripcion' => 'Permite registrar la inscripción de modalidad'],
            ['codigo' => 'inscrip_modalidad.actualizar', 'nombre' => 'Editar Inscripción', 'descripcion' => 'Permite editar la inscripción de modalidad'],
            ['codigo' => 'inscrip_modalidad.leer', 'nombre' => 'Ver Inscripción de Modalidad', 'descripcion' => 'Permite ver la información de la inscripción de modalidad'],

            // Temas (alias de Proyectos)
            ['codigo' => 'temas.crear', 'nombre' => 'Registrar Tema', 'descripcion' => 'Permite registrar temas'],
            ['codigo' => 'temas.leer', 'nombre' => 'Ver Tema', 'descripcion' => 'Permite ver/listar temas y proyectos'],
            ['codigo' => 'temas.actualizar', 'nombre' => 'Editar Tema', 'descripcion' => 'Permite editar temas'],

            // Tutores y tribunales
            ['codigo' => 'tutores.crear', 'nombre' => 'Registrar Tutor', 'descripcion' => 'Permite registrar tutores'],
            ['codigo' => 'tutores.leer', 'nombre' => 'Ver Tutor', 'descripcion' => 'Permite ver/listar tutores'],
            ['codigo' => 'tutores.actualizar', 'nombre' => 'Editar Tutor', 'descripcion' => 'Permite editar tutores'],
            ['codigo' => 'tutores.activar_desactivar', 'nombre' => 'Activar o Desactivar Tutor', 'descripcion' => 'Permite habilitar o deshabilitar tutores'],
            ['codigo' => 'tutores.designar', 'nombre' => 'Designar Tutor', 'descripcion' => 'Permite designar tutor a un estudiante/tema'],

            // Convocatorias
            ['codigo' => 'convocatorias.crear', 'nombre' => 'Crear Convocatoria', 'descripcion' => 'Permite registrar convocatorias'],
            ['codigo' => 'convocatorias.leer', 'nombre' => 'Ver Convocatoria', 'descripcion' => 'Permite ver/listar convocatorias'],
            ['codigo' => 'convocatorias.actualizar', 'nombre' => 'Editar Convocatoria', 'descripcion' => 'Permite editar convocatorias'],
            ['codigo' => 'convocatorias.eliminar', 'nombre' => 'Eliminar Convocatoria', 'descripcion' => 'Permite eliminar convocatorias'],
            ['codigo' => 'convocatorias.activar_desactivar', 'nombre' => 'Activar o Desactivar Convocatoria', 'descripcion' => 'Permite activar o desactivar convocatorias'],

            // Defensas (programación y lectura)
            ['codigo' => 'defensas.programar', 'nombre' => 'Programar Defensa', 'descripcion' => 'Permite programar o actualizar defensas de proyecto'],
            ['codigo' => 'defensas.reprogramar', 'nombre' => 'Reprogramar Defensa', 'descripcion' => 'Permite reprogramar defensas ya registradas'],
            ['codigo' => 'defensas.leer', 'nombre' => 'Ver Defensas', 'descripcion' => 'Permite ver/listar defensas y documentos asociados'],

            // Usuarios y administración
            ['codigo' => 'usuarios.crear', 'nombre' => 'Crear Usuario', 'descripcion' => 'Permite crear usuarios'],
            ['codigo' => 'usuarios.actualizar', 'nombre' => 'Editar Usuario', 'descripcion' => 'Permite editar usuarios y permisos'],
            ['codigo' => 'usuarios.activar_desactivar', 'nombre' => 'Desactivar Usuario', 'descripcion' => 'Permite activar o desactivar usuarios'],
            ['codigo' => 'usuarios.editar_permisos', 'nombre' => 'Editar Permisos', 'descripcion' => 'Permite editar permisos de los usuarios'],

            ['codigo' => 'permisos.leer', 'nombre' => 'Ver Permisos', 'descripcion' => 'Permite ver permisos'],
            ['codigo' => 'permisos.actualizar', 'nombre' => 'Editar Permisos', 'descripcion' => 'Permite crear/editar permisos'],

            // Pertinencias
            ['codigo' => 'pertinencias.crear', 'nombre' => 'Crear Pertinencia', 'descripcion' => 'Permite crear pertinencias'],
            ['codigo' => 'pertinencias.actualizar', 'nombre' => 'Editar Pertinencia', 'descripcion' => 'Permite editar pertinencias'],
            ['codigo' => 'pertinencias.desactivar', 'nombre' => 'Desactivar Pertinencia', 'descripcion' => 'Permite activar/desactivar pertinencias'],
        ];
        foreach ($permisos as $p) {
            Permiso::create($p);
        }
    }

    private function seedUsuariosBase()
    {
        $superAdminRol = Rol::where('nombre', 'Super Admin')->first();
        $userRol = Rol::where('nombre', 'Usuario')->first();

        $admin = Usuario::updateOrCreate(
            ['nombre_usuario' => env('ADMIN_USERNAME', 'Administrador')],
            [
                'nombre_usuario' => env('ADMIN_USERNAME', 'Administrador'),
                'contrasena' => env('ADMIN_PASSWORD', 'admin123'),
                'email' => env('ADMIN_EMAIL', 'admin@socrates.com'),
                'rol_id' => $superAdminRol ? $superAdminRol->id : null,
                'activo' => true,
                'fecha_creacion' => now(),
            ]
        );

        Usuario::updateOrCreate(
            ['nombre_usuario' => env('DEFAULT_USER_USERNAME', 'Usuario')],
            [
                'nombre_usuario' => env('DEFAULT_USER_USERNAME', 'Usuario'),
                'contrasena' => env('DEFAULT_USER_PASSWORD', 'user123'),
                'email' => env('DEFAULT_USER_EMAIL', 'usuario@socrates.com'),
                'rol_id' => $userRol ? $userRol->id : null,
                'activo' => true,
                'fecha_creacion' => now(),
            ]
        );

        return $admin;
    }

    private function seedRoles()
    {
        $roles = [
            ['nombre' => 'Super Admin', 'descripcion' => 'Super Administrador', 'nivel_acceso' => 100, 'activo' => true],
            ['nombre' => 'Administrador', 'descripcion' => 'Administrador del sistema', 'nivel_acceso' => 90, 'activo' => true],
            ['nombre' => 'Director académico', 'descripcion' => null, 'nivel_acceso' => 80, 'activo' => true],
            ['nombre' => 'Auxiliar de Dirección Académica', 'descripcion' => null, 'nivel_acceso' => 70, 'activo' => true],
            ['nombre' => 'Asistente de Dirección Académica', 'descripcion' => null, 'nivel_acceso' => 60, 'activo' => true],
            ['nombre' => 'Responsable Gestión Académica Legal', 'descripcion' => null, 'nivel_acceso' => 50, 'activo' => true],
            ['nombre' => 'Usuario', 'descripcion' => 'Usuario', 'nivel_acceso' => 10, 'activo' => true],
        ];
        foreach ($roles as $r) {
            Rol::create($r);
        }
    }
}
