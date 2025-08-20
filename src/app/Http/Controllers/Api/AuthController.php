<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    /**
     * Login de usuario
     */
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string|min:6',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], 422);
        }

        // Buscar usuario por email
        $usuario = Usuario::where('email', $request->email)->first();

        if (!$usuario || !Hash::check($request->password, $usuario->contrasena)) {
            return response()->json([
                'success' => false,
                'message' => 'Credenciales incorrectas'
            ], 401);
        }

        // Verificar si el usuario está activo
        if (!$usuario->activo || $usuario->estaBloqueado()) {
            return response()->json([
                'success' => false,
                'message' => 'Su cuenta ha sido desactivada o bloqueada'
            ], 403);
        }

        // Actualizar fecha de actualización
        $usuario->update(['fecha_actualizacion' => now()]);

        // Crear token de acceso
        $token = $usuario->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login exitoso',
            'data' => [
                'usuario' => [
                    'id' => $usuario->id,
                    'nombre_usuario' => $usuario->nombre_usuario,
                    'email' => $usuario->email,
                    'activo' => $usuario->activo,
                    'rol' => $usuario->rol ? [
                        'id' => $usuario->rol->id,
                        'nombre' => $usuario->rol->nombre,
                        'descripcion' => $usuario->rol->descripcion,
                        'nivel_acceso' => $usuario->rol->nivel_acceso,
                    ] : null,
                    'permisos' => $usuario->permisos()->pluck('codigo')->toArray(),
                ],
                'token' => $token,
                'token_type' => 'Bearer',
            ]
        ]);
    }

    /**
     * Registro de usuario
     */
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'nombre_usuario' => 'required|string|max:255|unique:usuario',
            'email' => 'required|string|email|max:255|unique:usuario',
            'password' => 'required|string|min:8|confirmed',
            'rol_id' => 'required|exists:rol,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], 422);
        }

        // Crear usuario
        $usuario = Usuario::create([
            'nombre_usuario' => $request->nombre_usuario,
            'email' => $request->email,
            'contrasena' => $request->password, // Se encripta automáticamente en el mutator
            'rol_id' => $request->rol_id,
            'activo' => true,
            'fecha_creacion' => now(),
        ]);

        // Crear token de acceso
        $token = $usuario->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Usuario registrado exitosamente',
            'data' => [
                'usuario' => [
                    'id' => $usuario->id,
                    'nombre_usuario' => $usuario->nombre_usuario,
                    'email' => $usuario->email,
                    'rol' => $usuario->rol ? [
                        'id' => $usuario->rol->id,
                        'nombre' => $usuario->rol->nombre,
                        'descripcion' => $usuario->rol->descripcion,
                    ] : null,
                ],
                'token' => $token,
                'token_type' => 'Bearer',
            ]
        ], 201);
    }

    /**
     * Obtener información del usuario autenticado
     */
    public function me(Request $request)
    {
        $usuario = $request->user();

        return response()->json([
            'success' => true,
            'data' => [
                'usuario' => [
                    'id' => $usuario->id,
                    'nombre_usuario' => $usuario->nombre_usuario,
                    'email' => $usuario->email,
                    'activo' => $usuario->activo,
                    'fecha_creacion' => $usuario->fecha_creacion,
                    'fecha_actualizacion' => $usuario->fecha_actualizacion,
                    'rol' => $usuario->rol ? [
                        'id' => $usuario->rol->id,
                        'nombre' => $usuario->rol->nombre,
                        'descripcion' => $usuario->rol->descripcion,
                        'nivel_acceso' => $usuario->rol->nivel_acceso,
                    ] : null,
                    'permisos' => $usuario->permisos()->map(function ($permiso) {
                        return [
                            'id' => $permiso->id,
                            'codigo' => $permiso->codigo,
                            'nombre' => $permiso->nombre,
                            'descripcion' => $permiso->descripcion,
                        ];
                    }),
                ]
            ]
        ]);
    }

    /**
     * Logout de usuario
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logout exitoso'
        ]);
    }

    /**
     * Cambiar contraseña
     */
    public function changePassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos de validación incorrectos',
                'errors' => $validator->errors()
            ], 422);
        }

        $usuario = $request->user();

        // Verificar contraseña actual
        if (!Hash::check($request->current_password, $usuario->contrasena)) {
            return response()->json([
                'success' => false,
                'message' => 'La contraseña actual es incorrecta'
            ], 422);
        }

        // Actualizar contraseña
        $usuario->update([
            'contrasena' => $request->new_password, // Se encripta automáticamente
            'fecha_actualizacion' => now()
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Contraseña actualizada exitosamente'
        ]);
    }

}
