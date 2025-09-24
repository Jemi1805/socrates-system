<?php

use App\Http\Controllers\ProductosController;
use App\Http\Controllers\PostulanteController;
use App\Http\Controllers\InscripcionController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\RolController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SgaController;
use App\Http\Controllers\Api\ArancelesEstController;
use App\Http\Controllers\Api\ModalidadController;
use App\Http\Controllers\Api\PractIndController;
use App\Http\Controllers\Api\ProyectoController;
use App\Http\Controllers\Api\InscripModalidadController;
use App\Http\Controllers\Api\DatosCarreraController;
use App\Http\Controllers\Api\DocumentosRequeridosController;
use App\Http\Controllers\Api\DocumentosAdjuntosController;
use App\Http\Controllers\Api\DiplomaBachillerController;
use App\Http\Controllers\Api\RaHomolExController;
use App\Http\Controllers\Api\GradoHomolController;
use App\Http\Controllers\Api\TransitabilidadEduRegController;
use App\Http\Controllers\Api\TransitabilidadInstTecController;
use App\Http\Controllers\Api\TraspasosInstitutoController;
use App\Http\Controllers\Api\ResHomolCpController;
use App\Http\Controllers\Api\GradosHomolCpController;
use App\Http\Controllers\Api\GradosTraspController;
use App\Http\Controllers\Api\CarreraController;
use App\Http\Controllers\Api\PensumController;

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

    // 📚 CRUD API RESOURCES (protegidos)
    // Listado filtrado para aranceles_est (evita conflicto de firma con CrudController@index)
    Route::get('aranceles_est/list', [ArancelesEstController::class, 'list']);
    Route::apiResource('aranceles_est', ArancelesEstController::class);
    Route::apiResource('modalidad', ModalidadController::class);
    Route::apiResource('pract_ind', PractIndController::class);
    Route::apiResource('proyecto', ProyectoController::class);
    Route::apiResource('inscrip_modalidad', InscripModalidadController::class);
    Route::apiResource('documentos_requeridos', DocumentosRequeridosController::class);
    Route::apiResource('documentos_adjuntos', DocumentosAdjuntosController::class);
    Route::apiResource('diploma_bachiller', DiplomaBachillerController::class);
    Route::post('diploma_bachiller/upsert', [DiplomaBachillerController::class, 'upsert']);
    Route::apiResource('ra_homol_ex', RaHomolExController::class);
    Route::apiResource('grado_homol', GradoHomolController::class);
    Route::apiResource('transitabilidad_edu_reg', TransitabilidadEduRegController::class);
    Route::apiResource('transitabilidad_inst_tec', TransitabilidadInstTecController::class);
    Route::apiResource('traspasos_instituto', TraspasosInstitutoController::class);
    Route::apiResource('res_homol_cp', ResHomolCpController::class);
    // Eliminación por cod_ceta_est
    Route::post('transitabilidad_edu_reg/delete_by_cod', [TransitabilidadEduRegController::class, 'deleteByCodCeta']);
    Route::post('transitabilidad_inst_tec/delete_by_cod', [TransitabilidadInstTecController::class, 'deleteByCodCeta']);
    Route::post('traspasos_instituto/delete_by_cod', [TraspasosInstitutoController::class, 'deleteByCodCeta']);
    Route::post('res_homol_cp/delete_by_cod', [ResHomolCpController::class, 'deleteByCodCeta']);
    // Upsert por cod_ceta_est
    Route::post('traspasos_instituto/upsert_by_cod', [TraspasosInstitutoController::class, 'upsertByCod']);
    Route::post('res_homol_cp/upsert_by_cod', [ResHomolCpController::class, 'upsertByCod']);
    // (Se mueven las rutas get_by_cod fuera del grupo protegido)
    Route::apiResource('grados_homol_cp', GradosHomolCpController::class);
    Route::apiResource('grados_trasp', GradosTraspController::class);
    // Datos de carrera (inicio / conclusión)
    Route::apiResource('datos_carrera', DatosCarreraController::class);
    Route::post('datos_carrera/upsert', [DatosCarreraController::class, 'upsert']);
    // Registro de inscripción con aranceles seleccionados
    Route::post('inscripciones', [InscripModalidadController::class, 'storeWithAranceles']);
    // Catálogos base
    Route::apiResource('carrera', CarreraController::class);
    Route::apiResource('pensum', PensumController::class);
});

// 📦 RUTAS DE PRODUCTOS (Mantener existentes)
Route::get('/productos', [ProductosController::class, 'index']);
Route::post('/productos', [ProductosController::class, 'store']);
Route::get('/productos/{id}', [ProductosController::class, 'show']);
Route::put('/productos/{id}', [ProductosController::class, 'update']);
Route::delete('/productos/{id}', [ProductosController::class, 'destroy']);

// 👨‍🎓 RUTAS PARA POSTULANTES (Mantener existentes)
Route::apiResource('postulantes', PostulanteController::class);
Route::get('postulantes/{cod_ceta}/modalidad', [PostulanteController::class, 'getModalidad']);
Route::post('postulantes/{cod_ceta}/modalidad', [PostulanteController::class, 'setModalidad']);
// Endpoint composite para vista "Ver inscripción"
Route::get('postulantes/{cod_ceta}/inscripcion', [InscripcionController::class, 'showByCodCeta']);

// 🎓 RUTAS PARA SGA (Mantener existentes)
Route::prefix('sga')->group(function () {
    // Test simple sin controller
    Route::get('test', function() {
        return response()->json(['status' => 'OK', 'message' => 'SGA routes working']);
    });
    
    // Rutas de conectividad y autenticación
    Route::get('check-connection', [SgaController::class, 'checkConnection']);
    Route::get('available-urls', [SgaController::class, 'getAvailableUrls']);
    Route::get('diagnostico/{carrera}', [SgaController::class, 'diagnosticarConexion']);
    Route::post('authenticate', [SgaController::class, 'authenticate']);
    
    // Rutas de estudiantes
    Route::get('estudiantes', [SgaController::class, 'getEstudiantes']);
    Route::get('estudiantes/{codCeta}', [SgaController::class, 'getEstudianteByCodigo']);
    Route::post('buscar-estudiantes', [SgaController::class, 'buscarEstudiantes']);
    // Pagos de Material Extra por estudiante
    Route::get('estudiantes/{codCeta}/pagos/material-extra', [SgaController::class, 'getPagosMaterialExtra']);
    
    // Rutas de datos generales
    Route::get('carreras', [SgaController::class, 'getCarreras']);
    Route::get('gestiones', [SgaController::class, 'getGestiones']);
    Route::get('pensums', [SgaController::class, 'getPensums']);
    Route::get('inscripciones/{codCeta}', [SgaController::class, 'getInscripciones']);
    
    Route::post('sync-estudiante', [SgaController::class, 'syncEstudiante']);
});

// 📈 RUTA PÚBLICA: listado de modalidades (solo lectura)
// Permite que el frontend cargue las modalidades sin requerir autenticación
Route::get('modalidades', [ModalidadController::class, 'index']);

// =========================
// RUTAS PÚBLICAS (SOLO LECTURA)
// Visualización de datos guardados SIN autenticación
// =========================
Route::get('traspasos_instituto/get_by_cod', [TraspasosInstitutoController::class, 'getByCodCeta']);
Route::get('res_homol_cp/get_by_cod', [ResHomolCpController::class, 'getByCodCeta']);

// Diagnóstico: rutas públicas temporales
Route::get('ping_public', fn() => response()->json(['ok' => true]));

// Endpoints públicos alternativos (evitar cualquier colisión con rutas previas bajo auth)
Route::prefix('public')->group(function () {
    Route::get('traspasos_instituto/get_by_cod', [TraspasosInstitutoController::class, 'getByCodCeta']);
    Route::get('res_homol_cp/get_by_cod', [ResHomolCpController::class, 'getByCodCeta']);
});
