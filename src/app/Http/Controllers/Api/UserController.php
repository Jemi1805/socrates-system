<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Usuario;
use App\Models\Rol;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Listar usuarios
     */
    public function index(Request $request)
    {
        $query = Usuario::with(['rol']);

        // Filtros
        if ($request->has('search') && $request->search) {
            $query->buscar($request->search);
        }

        if ($request->has('rol') && $request->rol) {
            $query->porRol($request->rol);
        }

        if ($request->has('activo') && $request->activo !== '') {
            $query->where('activo', $request->boolean('activo'));
        }

        // Paginación
        $perPage = $request->get('per_page', 15);
        $usuarios = $query->orderBy('fecha_creacion', 'desc')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $usuarios->items(),
            'pagination' => [
                'current_page' => $usuarios->currentPage(),
                'last_page' => $usuarios->lastPage(),
                'per_page' => $usuarios->perPage(),
                'total' => $usuarios->total(),
            ]
        ]);
    }

    /**
     * Mostrar usuario específico
     */
    public function show($id)
    {
        $user = User::with(['role.permissions'])->find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'full_name' => $user->full_name,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar' => $user->avatar,
                'is_active' => $user->is_active,
                'last_login_at' => $user->last_login_at,
                'last_login_ip' => $user->last_login_ip,
                'created_at' => $user->created_at,
                'role' => $user->role ? [
                    'id' => $user->role->id,
                    'name' => $user->role->name,
                    'display_name' => $user->role->display_name,
                    'description' => $user->role->description,
                ] : null,
                'permissions' => $user->getPermissions()->map(function ($permission) {
                    return [
                        'id' => $permission->id,
                        'name' => $permission->name,
                        'display_name' => $permission->display_name,
                        'module' => $permission->module,
                        'action' => $permission->action,
                    ];
            ]
        ]);
    }

    /**
     * Crear usuario
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre_usuario' => 'required|string|max:255|unique:usuario',
            'email' => 'required|string|email|max:255|unique:usuario',
            'contrasena' => 'required|string|min:8',
            'rol_id' => 'required|exists:rol,id',
            'activo' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], 422);
        }

        $usuario = Usuario::create([
            'nombre_usuario' => $request->nombre_usuario,
            'email' => $request->email,
            'contrasena' => $request->contrasena,
            'rol_id' => $request->rol_id,
            'activo' => $request->get('activo', true),
        ]);

        $usuario->load('rol');

        return response()->json([
            'success' => true,
            'message' => 'Usuario creado exitosamente',
            'data' => $usuario
        ], 201);
    }

    /**
     * Actualizar usuario
     */
    public function update(Request $request, $id)
    {
        $usuario = Usuario::find($id);

        if (!$usuario) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'nombre_usuario' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('usuario')->ignore($usuario->id)],
            'contrasena' => 'nullable|string|min:8',
            'rol_id' => 'required|exists:rol,id',
            'activo' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], 422);
        }

        $updateData = [
            'nombre_usuario' => $request->nombre_usuario,
            'email' => $request->email,
            'rol_id' => $request->rol_id,
            'activo' => $request->get('activo', $usuario->activo),
        ];

        // Solo actualizar contraseña si se proporciona
        if ($request->filled('contrasena')) {
            $updateData['contrasena'] = $request->contrasena;
        }

        $usuario->update($updateData);
        $usuario->load('rol');

        return response()->json([
            'success' => true,
            'message' => 'Usuario actualizado exitosamente',
            'data' => $usuario
        ]);
    }

    /**
     * Eliminar usuario
     */
    public function destroy($id)
    {
        $usuario = Usuario::find($id);

        if (!$usuario) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        // No permitir eliminar al usuario actual
        if ($usuario->id === auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'No puedes eliminar tu propia cuenta'
            ], 422);
        }

        $usuario->delete();

        return response()->json([
            'success' => true,
            'message' => 'Usuario eliminado exitosamente'
        ]);
    }

    /**
     * Activar/Desactivar usuario
     */
    public function toggleStatus($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Usuario no encontrado'
            ], 404);
        }

        // No permitir desactivar al usuario actual
        if ($user->id === auth()->id()) {
            return response()->json([
                'success' => false,
                'message' => 'No puedes desactivar tu propia cuenta'
            ], 422);
        }

        $user->update(['is_active' => !$user->is_active]);

        return response()->json([
            'success' => true,
            'message' => $user->is_active ? 'Usuario activado' : 'Usuario desactivado',
            'data' => $user
        ]);
    }

    /**
     * Obtener roles disponibles
     */
    public function getRoles()
    {
        $roles = Role::active()->orderBy('display_name')->get();

        return response()->json([
            'success' => true,
            'data' => $roles
        ]);
    }
}
