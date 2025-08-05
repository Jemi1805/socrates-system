<?php

use App\Http\Controllers\ProductosController;
use App\Http\Controllers\PostulanteController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\RolController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SgaController;

// 🔐 RUTAS DE AUTENTICACIÓN (Sin middleware)
Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('register', [AuthController::class, 'register']);
    
    // Rutas protegidas por autenticación
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('logout', [AuthController::class, 'logout']);
        Route::post('change-password', [AuthController::class, 'changePassword']);
    });
});

// 👥 RUTAS PROTEGIDAS CON AUTENTICACIÓN
Route::middleware('auth:sanctum')->group(function () {
    
    // Información del usuario autenticado
    Route::get('/user', function (Request $request) {
        return $request->user()->load('rol.permisos');
    });
    
    // 👤 GESTIÓN DE USUARIOS (Requiere permisos)
    Route::prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index'])->middleware('permission:users.read');
        Route::post('/', [UserController::class, 'store'])->middleware('permission:users.create');
        Route::get('/roles', [UserController::class, 'getRoles'])->middleware('permission:users.read');
        Route::get('/{id}', [UserController::class, 'show'])->middleware('permission:users.read');
        Route::put('/{id}', [UserController::class, 'update'])->middleware('permission:users.update');
        Route::delete('/{id}', [UserController::class, 'destroy'])->middleware('permission:users.delete');
        Route::patch('/{id}/toggle-status', [UserController::class, 'toggleStatus'])->middleware('permission:users.activate_deactivate');
    });
    
    // 🛡️ GESTIÓN DE ROLES (Requiere permisos)
    Route::prefix('roles')->group(function () {
        Route::get('/', [RolController::class, 'index'])->middleware('permission:roles.leer');
        Route::post('/', [RolController::class, 'store'])->middleware('permission:roles.crear');
        Route::get('/permisos', [RolController::class, 'permisos'])->middleware('permission:roles.leer');
        Route::get('/{id}', [RolController::class, 'show'])->middleware('permission:roles.leer');
        Route::put('/{id}', [RolController::class, 'update'])->middleware('permission:roles.actualizar');
        Route::delete('/{id}', [RolController::class, 'destroy'])->middleware('permission:roles.eliminar');
        Route::post('/{id}/permisos', [RolController::class, 'asignarPermisos'])->middleware('permission:roles.actualizar');
        Route::get('/{id}/usuarios', [RolController::class, 'usuarios'])->middleware('permission:roles.leer');
    });
});

// 📦 RUTAS DE PRODUCTOS (Mantener existentes)
Route::get('/productos', [ProductosController::class, 'index']);
Route::post('/productos', [ProductosController::class, 'store']);
Route::get('/productos/{id}', [ProductosController::class, 'show']);
Route::put('/productos/{id}', [ProductosController::class, 'update']);
Route::delete('/productos/{id}', [ProductosController::class, 'destroy']);

// 👨‍🎓 RUTAS PARA POSTULANTES (Mantener existentes)
Route::apiResource('postulantes', PostulanteController::class);

// 🎓 RUTAS PARA SGA (Mantener existentes)
Route::prefix('sga')->group(function () {
    Route::get('estudiantes', [SgaController::class, 'getEstudiantes']);
    Route::get('estudiantes/{codCeta}', [SgaController::class, 'getEstudianteByCodigo']);
    Route::get('carreras', [SgaController::class, 'getCarreras']);
    Route::get('gestiones', [SgaController::class, 'getGestiones']);
    Route::post('sync-estudiante', [SgaController::class, 'syncEstudiante']);
});