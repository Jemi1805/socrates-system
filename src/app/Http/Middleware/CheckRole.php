<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @param  string  ...$roles
     * @return mixed
     */
    public function handle(Request $request, Closure $next, ...$roles)
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

        // Verificar si el usuario tiene alguno de los roles requeridos
        if (!$user->tieneAlgunRol($roles)) {
            return response()->json([
                'error' => 'Sin autorización',
                'message' => 'No tiene el rol necesario para acceder a este recurso',
                'required_roles' => $roles,
                'user_role' => $user->rol ? $user->rol->nombre : null
            ], 403);
        }

        return $next($request);
    }
}
