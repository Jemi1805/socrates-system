<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Rol;
use App\Models\Permiso;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class RolController extends Controller
{
    /**
     * Listar roles
     */
    public function index(Request $request)
    {
        $query = Rol::with(['permisos']);

        // Filtros
        if ($request->has('search') && $request->search) {
            $query->buscar($request->search);
        }

        if ($request->has('activo') && $request->activo !== '') {
            $query->where('activo', $request->boolean('activo'));
        }

        if ($request->has('nivel_acceso') && $request->nivel_acceso) {
            $query->where('nivel_acceso', $request->nivel_acceso);
        }

        // Paginación
        $perPage = $request->get('per_page', 15);
        $roles = $query->orderBy('nivel_acceso', 'asc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $roles->items(),
            'pagination' => [
                'current_page' => $roles->currentPage(),
                'last_page' => $roles->lastPage(),
                'per_page' => $roles->perPage(),
                'total' => $roles->total(),
            ]
        ]);
    }

    /**
     * Mostrar rol específico
     */
    public function show($id)
    {
        $rol = Rol::with(['permisos', 'usuarios'])->find($id);

        if (!$rol) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'rol' => $rol,
                'permisos_agrupados' => $rol->permisos->groupBy('modulo'),
                'total_usuarios' => $rol->usuarios->count(),
            ]
        ]);
    }

    /**
     * Crear rol
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre' => 'required|string|max:255|unique:rol',
            'descripcion' => 'nullable|string',
            'nivel_acceso' => 'required|integer|min:1|max:100',
            'activo' => 'boolean',
            'permisos' => 'array',
            'permisos.*' => 'exists:permiso,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], 422);
        }

        $rol = Rol::create([
            'nombre' => $request->nombre,
            'descripcion' => $request->descripcion,
            'nivel_acceso' => $request->nivel_acceso,
            'activo' => $request->get('activo', true),
        ]);

        // Asignar permisos si se proporcionan
        if ($request->has('permisos') && is_array($request->permisos)) {
            $rol->asignarPermisos($request->permisos);
        }

        $rol->load('permisos');

        return response()->json([
            'success' => true,
            'message' => 'Rol creado exitosamente',
            'data' => $rol
        ], 201);
    }

    /**
     * Actualizar rol
     */
    public function update(Request $request, $id)
    {
        $rol = Rol::find($id);

        if (!$rol) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre' => ['required', 'string', 'max:255', Rule::unique('rol')->ignore($rol->id)],
            'descripcion' => 'nullable|string',
            'nivel_acceso' => 'required|integer|min:1|max:100',
            'activo' => 'boolean',
            'permisos' => 'array',
            'permisos.*' => 'exists:permiso,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], 422);
        }

        $rol->update([
            'nombre' => $request->nombre,
            'descripcion' => $request->descripcion,
            'nivel_acceso' => $request->nivel_acceso,
            'activo' => $request->get('activo', $rol->activo),
        ]);

        // Actualizar permisos si se proporcionan
        if ($request->has('permisos') && is_array($request->permisos)) {
            $rol->sincronizarPermisos($request->permisos);
        }

        $rol->load('permisos');

        return response()->json([
            'success' => true,
            'message' => 'Rol actualizado exitosamente',
            'data' => $rol
        ]);
    }

    /**
     * Eliminar rol
     */
    public function destroy($id)
    {
        $rol = Rol::find($id);

        if (!$rol) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado'
            ], 404);
        }

        // Verificar si el rol tiene usuarios asignados
        if ($rol->usuarios()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'No se puede eliminar el rol porque tiene usuarios asignados'
            ], 422);
        }

        $rol->delete();

        return response()->json([
            'success' => true,
            'message' => 'Rol eliminado exitosamente'
        ]);
    }

    /**
     * Obtener todos los permisos disponibles agrupados por módulo
     */
    public function permisos()
    {
        $permisos = Permiso::activos()->orderBy('modulo')->orderBy('nombre')->get();
        $permisosAgrupados = $permisos->groupBy('modulo');

        return response()->json([
            'success' => true,
            'data' => $permisosAgrupados
        ]);
    }

    /**
     * Asignar permisos a un rol
     */
    public function asignarPermisos(Request $request, $id)
    {
        $rol = Rol::find($id);

        if (!$rol) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'permisos' => 'required|array',
            'permisos.*' => 'exists:permiso,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], 422);
        }

        $rol->sincronizarPermisos($request->permisos);
        $rol->load('permisos');

        return response()->json([
            'success' => true,
            'message' => 'Permisos asignados exitosamente',
            'data' => $rol
        ]);
    }

    /**
     * Obtener usuarios de un rol específico
     */
    public function usuarios($id)
    {
        $rol = Rol::with(['usuarios' => function ($query) {
            $query->select('id', 'nombre_usuario', 'email', 'activo', 'fecha_ultimo_acceso', 'rol_id');
        }])->find($id);

        if (!$rol) {
            return response()->json([
                'success' => false,
                'message' => 'Rol no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'rol' => [
                    'id' => $rol->id,
                    'nombre' => $rol->nombre,
                    'descripcion' => $rol->descripcion,
                ],
                'usuarios' => $rol->usuarios,
                'total_usuarios' => $rol->usuarios->count(),
            ]
        ]);
    }
}
