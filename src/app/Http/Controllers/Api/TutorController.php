<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Models\Docente;
use App\Models\Tutor;
use App\Models\PertinenciaAcad;

class TutorController extends Controller
{
    /**
     * Listar tutores registrados.
     * Filtros opcionales: ?carrera=MEA|EEA|Nombre, ?gestion=1/YYYY|2/YYYY
     */
    public function index(Request $request)
    {
        $carrera = $request->query('carrera');
        $gestion = $request->query('gestion');

        $query = Tutor::query()
            ->leftJoin('carrera', 'tutores.cod_carrera', '=', 'carrera.cod_carrera')
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

        if ($gestion) {
            $query->where('tutores.gestion_registro', $gestion);
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
                'ci' => $t->ci,
                'cod_carrera' => $t->cod_carrera,
                'carrera' => $t->carrera_nom,
                'pertinencia_acad_id' => $t->pertinencia_acad_id,
                'pertinencia' => $t->pertinencia_nom,
                'pertinencia_ids' => $pertIds,
                'pertinencias' => $pertNoms,
                'gestion_registro' => $t->gestion_registro,
                'activo' => (bool)$t->activo,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'total' => $data->count(),
        ]);
    }
    /**
     * Registrar tutores en lote a partir de docentes seleccionados.
     * Espera payload: { items: [{ ci, nombre, apellido_p, apellido_m, celular, profesion?, cod_carrera?, pertinencia_acad_id?, pertinencia? }] }
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
            'items.*.profesion' => 'nullable|string|max:255',
            'items.*.cod_carrera' => 'nullable|string|max:10',
            'items.*.pertinencia_acad_id' => 'nullable|integer|exists:pertinencia_acad,id',
            'items.*.pertinencia_acad_ids' => 'nullable|array',
            'items.*.pertinencia_acad_ids.*' => 'integer|exists:pertinencia_acad,id',
            'items.*.pertinencia' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $items = $validator->validated()['items'];

        $now = Carbon::now();
        $gestion = ($now->month >= 7) ? ('2/' . $now->year) : ('1/' . $now->year);

        $created = 0; $updated = 0; $skipped = 0;
        $result = [];

        DB::beginTransaction();
        try {
            foreach ($items as $i) {
                $ci = strtoupper(trim((string)(isset($i['ci']) ? $i['ci'] : '')));
                $idsMulti = [];
                if (isset($i['pertinencia_acad_ids']) && is_array($i['pertinencia_acad_ids'])) {
                    $idsMulti = array_values(array_unique(array_map('intval', $i['pertinencia_acad_ids'])));
                    $idsMulti = array_filter($idsMulti, fn($v) => $v > 0);
                }
                $primaryId = isset($i['pertinencia_acad_id']) ? (int)$i['pertinencia_acad_id'] : ( ($idsMulti[0] ?? null) );
                // Construir data parcial para Docente
                $docData = [];
                if (isset($i['nombre'])) $docData['nombre'] = $i['nombre'];
                if (isset($i['apellido_p'])) $docData['apellido_p'] = $i['apellido_p'];
                if (isset($i['apellido_m'])) $docData['apellido_m'] = $i['apellido_m'];
                if (isset($i['celular'])) $docData['celular'] = $i['celular'];
                if (isset($i['profesion'])) $docData['profesion'] = $i['profesion'];
                if (!is_null($primaryId)) $docData['pertinencia_acad_id'] = $primaryId;
                if (isset($i['cod_carrera'])) $docData['cod_carrera'] = $i['cod_carrera'];
                $docData['activo'] = true;
                if ($updateOnly) {
                    // No crear docentes nuevos en modo actualización únicamente
                    $doc = Docente::whereRaw('TRIM(UPPER(ci)) = ?', [$ci])->first();
                    if (!$doc) {
                        $skipped++;
                        continue;
                    }
                    $doc->fill($docData);
                    $doc->save();
                } else {
                    // Evitar duplicados por espacios/caso: buscar primero por CI normalizado
                    $doc = Docente::whereRaw('TRIM(UPPER(ci)) = ?', [$ci])->first();
                    if ($doc) {
                        $doc->fill($docData);
                        // Asegurar normalización de CI en registro existente
                        $doc->ci = $ci;
                        $doc->save();
                    } else {
                        $doc = Docente::create(array_merge(['ci' => $ci], $docData));
                    }
                }

                // Resolver nombre(s) de pertinencia
                $pertNom = isset($i['pertinencia']) ? $i['pertinencia'] : null;
                if (!$pertNom) {
                    $idsForNames = $idsMulti;
                    if (!count($idsForNames) && !is_null($primaryId)) $idsForNames = [$primaryId];
                    if (count($idsForNames)) {
                        $names = PertinenciaAcad::whereIn('id', $idsForNames)->pluck('nombre_pert')->toArray();
                        if (count($names)) $pertNom = implode(', ', $names);
                    }
                }

                // Construir snapshot parcial para Tutor (si no existe no se sobreescriben con null)
                $snapBase = [ 'ci' => $ci, 'activo' => true ];
                if (isset($i['nombre'])) $snapBase['nombre'] = $i['nombre'];
                if (isset($i['apellido_p'])) $snapBase['apellido_p'] = $i['apellido_p'];
                if (isset($i['apellido_m'])) $snapBase['apellido_m'] = $i['apellido_m'];
                if (isset($i['celular'])) $snapBase['celular'] = $i['celular'];
                if (isset($i['cod_carrera'])) $snapBase['cod_carrera'] = $i['cod_carrera'];
                if (!is_null($primaryId)) $snapBase['pertinencia_acad_id'] = $primaryId;
                if (!is_null($pertNom)) $snapBase['pertinencia_nom'] = $pertNom;

                $existing = Tutor::where('docente_id', $doc->id)
                    ->orWhereRaw('TRIM(UPPER(ci)) = ?', [$ci])
                    ->first();
                if ($existing) {
                    // No cambiar gestion_registro en actualización
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
                    // Crear con gestión actual
                    $tutor = Tutor::create(array_merge(['docente_id' => $doc->id], $snapBase, ['gestion_registro' => $gestion]));
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
                'message' => 'Tutores registrados correctamente',
                'data' => $result,
                'counts' => [ 'created' => $created, 'updated' => $updated, 'skipped' => $skipped ],
                'gestion' => $gestion,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar tutores',
            ], 500);
        }
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
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

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

            DB::table('designacion_tutor')->updateOrInsert(
                [
                    'tutor_id' => $data['tutor_id'],
                    'cod_ceta' => $data['cod_ceta'],
                ],
                [
                    'proyecto_id' => $data['proyecto_id'] ?? null,
                    'fecha_designacion' => $now->toDateString(),
                    'tutor_nombre' => $tutNombre,
                    'estudiante_nombre' => $estNombre,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
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
            return response()->json([
                'success' => false,
                'message' => 'Error al designar tutor',
            ], 500);
        }
    }
}
