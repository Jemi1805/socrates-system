<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class CheckPermission
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @param  string  $permission
     * @return mixed
     */
    public function handle(Request $request, Closure $next, string $permission)
    {
        // Verificar si el usuario está autenticado
        if (!auth()->check()) {
            return response()->json([
                'error' => 'No autenticado',
                'message' => 'Debe iniciar sesión para acceder a este recurso'
            ], 401);
        }

        $user = auth()->user();

        // Verificar si el usuario está activo
        if (!$user->activo) {
            return response()->json([
                'error' => 'Usuario inactivo',
                'message' => 'Su cuenta ha sido desactivada'
            ], 403);
        }

        // Verificar si el usuario tiene el permiso requerido
        if (!$user->tienePermiso($permission)) {
            return response()->json([
                'error' => 'Sin permisos',
                'message' => 'No tiene permisos para realizar esta acción',
                'required_permission' => $permission
            ], 403);
        }

        return $next($request);
    }
}
