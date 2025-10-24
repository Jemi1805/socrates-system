<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use App\Models\Tutor;
use App\Models\PertinenciaAcad;
use App\Models\TipoTutor;

class TutorController extends Controller
{
    /**
     * Listar tutores registrados.
     * Filtros opcionales: ?carrera=MEA|EEA|Nombre
     */
    public function index(Request $request)
    {
        $carrera = $request->query('carrera');

        $query = Tutor::query()
            ->leftJoin('carrera', 'tutores.cod_carrera', '=', 'carrera.cod_carrera')
            ->leftJoin('tipo_tutor', 'tutores.tipo_tutor_id', '=', 'tipo_tutor.id')
            ->select('tutores.*', 'carrera.nombre_carrera as carrera_nom')
            ->with(['pertinencias:id,nombre_pert']);

        if ($carrera) {
            $c = trim(strtolower($carrera));
            $cod = null;
            if (strlen($carrera) <= 3) {
                $cod = strtoupper($carrera);
            } elseif ($c === 'mecanica' || $c === 'mecánica' || strpos($c, 'automotriz') !== false) {
                $cod = 'MEA';
            } elseif ($c === 'electricidad' || strpos($c, 'electr') !== false) {
                $cod = 'EEA';
            }

            if ($cod) {
                $query->where('tutores.cod_carrera', $cod);
            } else {
                $query->where('carrera.nombre_carrera', 'like', "%$carrera%");
            }
        }

        $rows = $query->orderBy('tutores.nombre')->get();

        $data = $rows->map(function ($t) {
            $pertIds = method_exists($t, 'pertinencias') ? $t->pertinencias->pluck('id')->values()->all() : [];
            $pertNoms = method_exists($t, 'pertinencias') ? $t->pertinencias->pluck('nombre_pert')->values()->all() : [];
            return [
                'id' => $t->id,
                'nombre' => $t->nombre,
                'apellido_p' => $t->apellido_p,
                'apellido_m' => $t->apellido_m,
                'celular' => $t->celular,
                'titulo' => $t->titulo,
                'ci' => $t->ci,
                'cod_carrera' => $t->cod_carrera,
                'carrera' => $t->carrera_nom,
                'pertinencia_acad_id' => $t->pertinencia_acad_id,
                'pertinencia' => $t->pertinencia_nom,
                'pertinencia_ids' => $pertIds,
                'pertinencias' => $pertNoms,
                'activo' => (bool)$t->activo,
                'tipo_tutor_id' => $t->tipo_tutor_id,
                'tipo_tutor' => optional(TipoTutor::find($t->tipo_tutor_id))->nombre,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'total' => $data->count(),
        ]);
    }
    /**
     * Registrar/actualizar tutores en lote (directamente en tabla tutores).
     * Espera payload: { items: [{ ci, nombre, apellido_p, apellido_m, celular, cod_carrera?, pertinencia_acad_id?, pertinencia?, pertinencia_acad_ids?: number[], tipo_tutor_id?: number }] }
     */
    public function registerBulk(Request $request)
    {
        $updateOnly = (bool)$request->boolean('update_only', false);
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.ci' => 'required|string|max:50',
            'items.*.nombre' => 'required|string|max:150',
            'items.*.apellido_p' => 'nullable|string|max:150',
            'items.*.apellido_m' => 'nullable|string|max:150',
            'items.*.celular' => 'required|string|max:50',
            'items.*.cod_carrera' => 'nullable|string|max:10',
            'items.*.pertinencia_acad_id' => 'nullable|integer|exists:pertinencia_acad,id',
            'items.*.pertinencia_acad_ids' => 'nullable|array',
            'items.*.pertinencia_acad_ids.*' => 'integer|exists:pertinencia_acad,id',
            'items.*.pertinencia' => 'nullable|string|max:255',
            'items.*.titulo' => 'nullable|string|max:255',
            'items.*.tipo_tutor_id' => 'nullable|integer|exists:tipo_tutor,id',
            'items.*.activo' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $items = $validator->validated()['items'];

        $created = 0; $updated = 0; $skipped = 0;
        $result = [];

        DB::beginTransaction();
        try {
            foreach ($items as $i) {
                $ci = strtoupper(trim((string)(isset($i['ci']) ? $i['ci'] : '')));
                $idsMulti = [];
                if (isset($i['pertinencia_acad_ids']) && is_array($i['pertinencia_acad_ids'])) {
                    $idsMulti = array_values(array_unique(array_map('intval', $i['pertinencia_acad_ids'])));
                    $idsMulti = array_filter($idsMulti, function ($v) { return $v > 0; });
                }

                $primaryId = isset($i['pertinencia_acad_id'])
                    ? (int)$i['pertinencia_acad_id']
                    : (isset($idsMulti[0]) ? $idsMulti[0] : null);

                // Validar IDs existentes en pertinencia_acad antes de usar
                $validRows = [];
                if (count($idsMulti)) {
                    $validRows = PertinenciaAcad::whereIn('id', $idsMulti)
                        ->get(['id', 'nombre_pert'])
                        ->map(function ($row) {
                            return ['id' => $row->id, 'nombre' => $row->nombre_pert];
                        })
                        ->toArray();
                    $idsMulti = array_column($validRows, 'id');
                }
                if (!is_null($primaryId) && !in_array($primaryId, $idsMulti, true)) {
                    $fallback = PertinenciaAcad::find($primaryId);
                    if ($fallback) {
                        $idsMulti[] = $fallback->id;
                        $validRows[] = ['id' => $fallback->id, 'nombre' => $fallback->nombre_pert];
                    } else {
                        $primaryId = count($idsMulti) ? $idsMulti[0] : null;
                    }
                }

                // Resolver nombre(s) de pertinencia
                $pertNom = isset($i['pertinencia']) ? $i['pertinencia'] : null;
                if (!$pertNom) {
                    if (count($validRows)) {
                        $pertNom = implode(', ', array_filter(array_column($validRows, 'nombre')));
                    } elseif (!is_null($primaryId)) {
                        $single = PertinenciaAcad::find($primaryId);
                        if ($single && $single->nombre_pert) {
                            $pertNom = $single->nombre_pert;
                        }
                    }
                }

                // Construir data para Tutor
                $snapBase = [ 'ci' => $ci ];
                if (isset($i['nombre'])) $snapBase['nombre'] = $i['nombre'];
                if (isset($i['apellido_p'])) $snapBase['apellido_p'] = $i['apellido_p'];
                if (isset($i['apellido_m'])) $snapBase['apellido_m'] = $i['apellido_m'];
                if (isset($i['celular'])) $snapBase['celular'] = $i['celular'];
                if (isset($i['titulo'])) {
                    $snapBase['titulo'] = $i['titulo'];
                } elseif (isset($i['profesion'])) {
                    $snapBase['titulo'] = $i['profesion'];
                }
                if (isset($i['cod_carrera'])) $snapBase['cod_carrera'] = $i['cod_carrera'];
                if (!is_null($primaryId)) $snapBase['pertinencia_acad_id'] = $primaryId;
                if (!is_null($pertNom)) $snapBase['pertinencia_nom'] = $pertNom;
                if (isset($i['tipo_tutor_id'])) $snapBase['tipo_tutor_id'] = (int)$i['tipo_tutor_id'];

                $existing = Tutor::whereRaw('TRIM(UPPER(ci)) = ?', [$ci])->first();
                if ($existing) {
                    if (array_key_exists('activo', $i)) {
                        $snapBase['activo'] = (bool)$i['activo'];
                    }
                    $existing->fill($snapBase);
                    $existing->save();
                    // Sincronizar multi-pertinencias si se envía el arreglo
                    if (array_key_exists('pertinencia_acad_ids', $i)) {
                        $existing->pertinencias()->sync($idsMulti);
                    }
                    $updated++;
                    $tutor = $existing;
                } else {
                    if ($updateOnly) {
                        // No crear nuevos cuando update_only está activo
                        $skipped++;
                        continue;
                    }
                    $snapBase['activo'] = array_key_exists('activo', $i) ? (bool)$i['activo'] : true;
                    // Crear
                    $tutor = Tutor::create($snapBase);
                    // Registrar multi-pertinencias
                    if (count($idsMulti)) {
                        $tutor->pertinencias()->sync($idsMulti);
                    } elseif (!is_null($primaryId)) {
                        $tutor->pertinencias()->sync([$primaryId]);
                    }
                    $created++;
                }

                $result[] = $tutor->toArray();
            }

            DB::commit();
            return response()->json([
                'success' => true,
                'message' => 'Tutores registrados/actualizados correctamente',
                'data' => $result,
                'counts' => [ 'created' => $created, 'updated' => $updated, 'skipped' => $skipped ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar tutores',
            ], 500);
        }
    }

    /** Actualizar datos del tutor (incluye tipo_tutor_id obligatorio para activación) */
    public function update(Request $request, int $id)
    {
        $tutor = Tutor::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'nombre' => 'sometimes|string|max:150',
            'apellido_p' => 'sometimes|nullable|string|max:150',
            'apellido_m' => 'sometimes|nullable|string|max:150',
            'celular' => 'sometimes|nullable|string|max:50',
            'cod_carrera' => 'sometimes|nullable|string|max:10',
            'pertinencia_acad_id' => 'sometimes|nullable|integer|exists:pertinencia_acad,id',
            'titulo' => 'sometimes|nullable|string|max:255',
            'tipo_tutor_id' => 'required|integer|exists:tipo_tutor,id',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }
        $data = $validator->validated();
        $tutor->fill($data);
        $tutor->save();
        return response()->json(['success' => true, 'data' => $tutor]);
    }

    /** Alternar estado activo del tutor, validando datos completos */
    public function toggle(Request $request, int $id)
    {
        $tutor = Tutor::with('pertinencias')->findOrFail($id);
        $activo = (bool)$request->boolean('activo', !$tutor->activo);
        if ($activo) {
            // Validaciones para habilitar: tipo y pertinencia presentes
            $hasTipo = !is_null($tutor->tipo_tutor_id);
            $hasPert = $tutor->pertinencia_acad_id != null || ($tutor->pertinencias && $tutor->pertinencias->count() > 0);
            if (!$hasTipo || !$hasPert) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede habilitar: requiere Tipo de Tutor y Pertinencia académica',
                ], 422);
            }
        }
        $tutor->activo = $activo;
        $tutor->save();
        return response()->json(['success' => true, 'data' => ['id' => $tutor->id, 'activo' => (bool)$tutor->activo]]);
    }

    /** Catálogo de tipos de tutor */
    public function tipos()
    {
        $tipos = TipoTutor::where('is_active', true)->orderBy('nombre')->get(['id','nombre','is_active']);
        return response()->json(['success' => true, 'data' => $tipos]);
    }

    /**
     * Designar un tutor a un estudiante (y opcionalmente a un proyecto/tema)
     * Body esperado: { tutor_id: number, cod_ceta: number, proyecto_id?: number }
     */
    public function designar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tutor_id' => 'required|integer|exists:tutores,id',
            'cod_ceta' => 'required|integer|exists:postulantes,cod_ceta',
            'proyecto_id' => 'nullable|integer|exists:proyecto,id',
            'convocatoria_id' => 'nullable|integer|exists:convocatorias,id',
            'convocatoria_nom' => 'nullable|string|max:150',
            'user_id' => 'nullable|integer',
            'user_name' => 'nullable|string|max:150',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        $userIdFromPayload = isset($data['user_id']) ? (int) $data['user_id'] : null;
        unset($data['user_id']);

        $authUser = $request->user();
        $authUserId = $userIdFromPayload ?? ($authUser ? (int) $authUser->id : null);
        if ($authUserId !== null) {
            $existsUser = DB::table('users')->where('id', $authUserId)->exists();
            if (!$existsUser) {
                $authUserId = null;
            }
        }
        $authUserName = null;
        if ($authUser) {
            $authUserName = $authUser->nombre_usuario ?? $authUser->name ?? ($authUser->email ?? null);
            if (!$authUserName) {
                $resolvedName = DB::table('usuario')
                    ->where('id', $authUser->id)
                    ->value(DB::raw("TRIM(CONCAT(IFNULL(nombre,''),' ',IFNULL(apellido_p,''),' ',IFNULL(apellido_m,'')))"));
                if ($resolvedName) {
                    $authUserName = trim($resolvedName);
                }
            }
        }

        if (!empty($data['user_name'])) {
            $authUserName = $data['user_name'];
        }

        DB::beginTransaction();
        try {
            $now = Carbon::now();

            // Asegurar unicidad por proyecto si se envía
            if (!empty($data['proyecto_id'])) {
                $exist = DB::table('designacion_tutor')
                    ->where('proyecto_id', $data['proyecto_id'])
                    ->first();
                if ($exist && ($exist->tutor_id != $data['tutor_id'] || $exist->cod_ceta != $data['cod_ceta'])) {
                    DB::table('designacion_tutor')->where('id', $exist->id)->delete();
                }
            }

            // Fallback de nombres (por si los triggers no están disponibles)
            $p = DB::table('postulantes')->where('cod_ceta', $data['cod_ceta'])
                ->first(['nombres_est', 'ap_pat', 'ap_mat']);
            $t = DB::table('tutores')->where('id', $data['tutor_id'])
                ->first(['nombre', 'apellido_p', 'apellido_m']);
            $estNombre = $p ? trim(implode(' ', array_filter([$p->nombres_est, $p->ap_pat, $p->ap_mat]))) : null;
            $tutNombre = $t ? trim(implode(' ', array_filter([$t->nombre, $t->apellido_p, $t->apellido_m]))) : null;

            $updateData = [
                'proyecto_id' => (isset($data['proyecto_id']) ? $data['proyecto_id'] : null),
                'fecha_designacion' => $now->toDateString(),
                'convocatoria_id' => isset($data['convocatoria_id']) ? $data['convocatoria_id'] : null,
                'convocatoria_nom' => isset($data['convocatoria_nom']) ? $data['convocatoria_nom'] : null,
                'tutor_nombre' => $tutNombre,
                'estudiante_nombre' => $estNombre,
                'updated_at' => $now,
                'created_at' => $now,
            ];

            if ($authUserId !== null) {
                $updateData['user_id'] = $authUserId;
            } else {
                $updateData['user_id'] = null;
            }
            if ($authUserName !== null) {
                $updateData['user_name'] = $authUserName;
            }

            DB::table('designacion_tutor')->updateOrInsert(
                [
                    'tutor_id' => $data['tutor_id'],
                    'cod_ceta' => $data['cod_ceta'],
                ],
                $updateData
            );

            $row = DB::table('designacion_tutor')
                ->where('tutor_id', $data['tutor_id'])
                ->where('cod_ceta', $data['cod_ceta'])
                ->first();

            DB::commit();
            return response()->json([
                'success' => true,
                'message' => 'Tutor designado correctamente',
                'data' => $row,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Error al designar tutor', [
                'payload' => $request->all(),
                'exception' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'Error al designar tutor',
            ], 500);
        }
    }
}
