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
use App\Http\Controllers\Api\DocenteController;
use App\Http\Controllers\Api\TutorController;
use App\Http\Controllers\Api\PertinenciaController;

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
        return $request->user()->load(['rol', 'permisos']);
    });
    
    // 👤 GESTIÓN DE USUARIOS (Requiere permisos)
    // Nota: Los códigos de permiso se generan como 'usuarios.*' en el seeder
    Route::prefix('users')->group(function () {
        Route::get('/', [UserController::class, 'index'])->middleware('permission:usuarios.actualizar');
        Route::post('/', [UserController::class, 'store'])->middleware('permission:usuarios.crear');
        Route::get('/roles', [UserController::class, 'getRoles'])->middleware('permission:usuarios.actualizar');
        Route::get('/{id}', [UserController::class, 'show'])->middleware('permission:usuarios.actualizar');
        Route::put('/{id}', [UserController::class, 'update'])->middleware('permission:usuarios.actualizar');
        Route::delete('/{id}', [UserController::class, 'destroy'])->middleware('permission:usuarios.actualizar');
        Route::patch('/{id}/toggle-status', [UserController::class, 'toggleStatus'])->middleware('permission:usuarios.activar_desactivar');
        // Permisos directos del usuario
        Route::get('/{id}/permissions', [UserController::class, 'getPermissions'])->middleware('permission:usuarios.editar_permisos');
        Route::post('/{id}/permissions', [UserController::class, 'setPermissions'])->middleware('permission:usuarios.editar_permisos');
    });
    
    // 🛡️ GESTIÓN DE ROLES (Requiere permisos)
    Route::prefix('roles')->group(function () {
        Route::get('/', [RolController::class, 'index'])->middleware('permission:permisos.leer');
        Route::post('/', [RolController::class, 'store'])->middleware('permission:permisos.actualizar');
        Route::get('/{id}', [RolController::class, 'show'])->middleware('permission:permisos.leer');
        Route::put('/{id}', [RolController::class, 'update'])->middleware('permission:permisos.actualizar');
        Route::delete('/{id}', [RolController::class, 'destroy'])->middleware('permission:permisos.actualizar');
        Route::get('/{id}/usuarios', [RolController::class, 'usuarios'])->middleware('permission:permisos.leer');
    });

    // 📚 CRUD API RESOURCES (protegidos)
    // Listado filtrado para aranceles_est (evita conflicto de firma con CrudController@index)
    Route::get('aranceles_est/list', [ArancelesEstController::class, 'listar']);
    Route::apiResource('aranceles_est', ArancelesEstController::class);
    Route::post('aranceles_est/upsert_by_cod', [ArancelesEstController::class, 'upsertByCod']);
    Route::apiResource('modalidad', ModalidadController::class);
    Route::apiResource('pract_ind', PractIndController::class);
    // Proyectos/Temas con permisos granulares
    Route::apiResource('proyecto', ProyectoController::class)
        ->only(['store'])
        ->middleware('permission:temas.crear');
    Route::apiResource('proyecto', ProyectoController::class)
        ->except(['store'])
        ->where(['proyecto' => '\\d+']) // evita colisión con 'by_cod'
        ->middleware('permission:temas.actualizar');
    Route::apiResource('inscrip_modalidad', InscripModalidadController::class)
        ->middleware('permission:inscrip_modalidad.actualizar');
    Route::apiResource('documentos_requeridos', DocumentosRequeridosController::class);
    Route::apiResource('documentos_adjuntos', DocumentosAdjuntosController::class);
    Route::apiResource('diploma_bachiller', DiplomaBachillerController::class);
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
    // upsert por cod_ceta_est
    Route::post('traspasos_instituto/upsert_by_cod', [TraspasosInstitutoController::class, 'upsertByCod']);
    Route::post('res_homol_cp/upsert_by_cod', [ResHomolCpController::class, 'upsertByCod']);
    // (Se mueven las rutas get_by_cod fuera del grupo protegido)
        Route::apiResource('grados_homol_cp', GradosHomolCpController::class);
        Route::apiResource('grados_trasp', GradosTraspController::class);
        // Datos de carrera (inicio / conclusión)
        Route::apiResource('datos_carrera', DatosCarreraController::class);
        Route::post('datos_carrera/upsert', [DatosCarreraController::class, 'upsert']);
        // Pertinencias académicas (CRUD local)
        Route::apiResource('pertinencias', PertinenciaController::class)
            ->middleware('permission:pertinencias.actualizar');
        // Registro de inscripción con aranceles seleccionados
        Route::post('inscripciones', [InscripModalidadController::class, 'storeWithAranceles'])
            ->middleware('permission:inscripciones.crear');
    // Catálogos base
    Route::apiResource('carrera', CarreraController::class);
    Route::apiResource('pensum', PensumController::class);
    // Docentes: upsert por CI
    Route::post('docentes/upsert_by_ci', [DocenteController::class, 'upsertByCi']);
        Route::get('docentes', [DocenteController::class, 'index']);
        // Docentes: actualizar por ID (y sincroniza tutor)
        Route::put('docentes/{id}', [DocenteController::class, 'update']);
        Route::patch('docentes/{id}', [DocenteController::class, 'update']);

        // Tutores: registro masivo desde docentes seleccionados
    Route::post('tutores/register_bulk', [TutorController::class, 'registerBulk'])
        ->middleware('permission:tutores.crear');
    // Tutores: listado
    Route::get('tutores', [TutorController::class, 'index'])
        ->middleware('permission:tutores.leer');
    // Tutores: designación
    Route::post('tutores/designar', [TutorController::class, 'designar'])
        ->middleware('permission:tutores.designar');
    });

// 📦 RUTAS DE PRODUCTOS (Mantener existentes)
// Route::get('/productos', [ProductosController::class, 'index']);
// Route::post('/productos', [ProductosController::class, 'store']);
// Route::get('/productos/{id}', [ProductosController::class, 'show']);
// Route::delete('/productos/{id}', [ProductosController::class, 'destroy']);

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
        Route::post('buscar-estudiantes', [SgaController::class, 'buscarEstudiantes'])
            ->middleware(['auth:sanctum', 'permission:sga.estudiantes.buscar']);
    // Pagos de Material Extra por estudiante
    Route::get('estudiantes/{codCeta}/pagos/material-extra', [SgaController::class, 'getPagosMaterialExtra']);
    
    // Rutas de datos generales
    Route::get('carreras', [SgaController::class, 'getCarreras']);
    Route::get('gestiones', [SgaController::class, 'getGestiones']);
    Route::get('pensums', [SgaController::class, 'getPensums']);
    Route::get('pertinencias', [SgaController::class, 'getPertinencias']);
    Route::get('docentes', [SgaController::class, 'getDocentes']);
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
Route::get('proyecto/by_cod', [ProyectoController::class, 'getByCodCeta'])
    ->withoutMiddleware('auth:sanctum');

// Diagnóstico: rutas públicas temporales
Route::get('ping_public', function () {
    return response()->json(['ok' => true]);
});

// Endpoints públicos alternativos (evitar cualquier colisión con rutas previas bajo auth)
Route::prefix('public')->group(function () {
    Route::get('traspasos_instituto/get_by_cod', [TraspasosInstitutoController::class, 'getByCodCeta']);
    Route::get('res_homol_cp/get_by_cod', [ResHomolCpController::class, 'getByCodCeta']);
});
