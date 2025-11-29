<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Defensa;
use App\Models\DefensaTribunal;
use App\Models\Tutor;
use App\Models\Tribunal;
use App\Models\RolTribunal;
use App\Services\SocratesApiService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use PhpOffice\PhpWord\TemplateProcessor;

class DefensaController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'proyecto_id' => 'required|integer|exists:proyecto,id',
            'cod_ceta' => 'required',
            'convocatoria_id' => 'required|integer|exists:convocatorias,id',
            'fecha_defensa' => 'required|date',
            'hora_inicio' => 'required',
            'hora_fin' => 'required',
            'grupo' => 'nullable|string|max:50',
            'aula' => 'required|string|max:100',
            'observaciones' => 'nullable|string',
        ]);

        $this->validateDefensaHorario($data, null);

        $user = $request->user();

        $defensa = Defensa::create([
            'proyecto_id' => $data['proyecto_id'],
            'cod_ceta' => $data['cod_ceta'],
            'convocatoria_id' => $data['convocatoria_id'],
            'fecha_defensa' => $data['fecha_defensa'],
            'hora_inicio' => $data['hora_inicio'],
            'hora_fin' => $data['hora_fin'],
            'grupo' => $data['grupo'] ?? null,
            'aula' => $data['aula'] ?? null,
            'estado_defensa' => 'programada',
            'observaciones' => $data['observaciones'] ?? null,
            'created_by' => $user ? $user->id : null,
            'updated_by' => $user ? $user->id : null,
        ]);

        return response()->json($defensa, 201);
    }

    public function update(Request $request, $id)
    {
        $defensa = Defensa::findOrFail($id);

        $data = $request->validate([
            'fecha_defensa' => 'sometimes|required|date',
            'hora_inicio' => 'sometimes|required',
            'hora_fin' => 'sometimes|required',
            'grupo' => 'nullable|string|max:50',
            'aula' => 'nullable|string|max:100',
            'convocatoria_id' => 'sometimes|required|integer|exists:convocatorias,id',
            'estado_defensa' => 'nullable|string|max:50',
            'observaciones' => 'nullable|string',
        ]);

        $merged = array_merge($defensa->toArray(), $data);
        $this->validateDefensaHorario($merged, (int) $defensa->id);

        $defensa->fill($data);
        $user = $request->user();
        if ($user) {
            $defensa->updated_by = $user->id;
        }
        $defensa->save();

        return response()->json($defensa);
    }

    public function reprogramar(Request $request, $id)
    {
        $defensa = Defensa::findOrFail($id);

        $data = $request->validate([
            'fecha_defensa' => 'required|date',
            'hora_inicio' => 'required',
            'hora_fin' => 'required',
            'grupo' => 'nullable|string|max:50',
            'aula' => 'required|string|max:100',
            'convocatoria_id' => 'required|integer|exists:convocatorias,id',
            'observaciones' => 'nullable|string',
        ]);

        $user = $request->user();

        $merged = array_merge($defensa->toArray(), $data);
        $this->validateDefensaHorario($merged, (int) $defensa->id);

        return DB::transaction(function () use ($defensa, $data, $user) {
            // marca la anterior como reprogramada
            $defensa->estado_defensa = 'reprogramada';
            if ($user) {
                $defensa->updated_by = $user->id;
            }
            $defensa->save();

            // crea nueva defensa en nueva convocatoria
            $nueva = Defensa::create([
                'proyecto_id' => $defensa->proyecto_id,
                'cod_ceta' => $defensa->cod_ceta,
                'convocatoria_id' => $data['convocatoria_id'],
                'fecha_defensa' => $data['fecha_defensa'],
                'hora_inicio' => $data['hora_inicio'],
                'hora_fin' => $data['hora_fin'],
                'grupo' => $data['grupo'] ?? null,
                'aula' => $data['aula'] ?? null,
                'estado_defensa' => 'programada',
                'observaciones' => $data['observaciones'] ?? null,
                'created_by' => $user ? $user->id : null,
                'updated_by' => $user ? $user->id : null,
            ]);

            return response()->json($nueva, 201);
        });
    }

    private function validateDefensaHorario(array $data, ?int $ignoreId = null): void
    {
        $fecha = isset($data['fecha_defensa']) ? $data['fecha_defensa'] : null;
        $horaInicio = isset($data['hora_inicio']) ? $data['hora_inicio'] : null;
        $horaFin = isset($data['hora_fin']) ? $data['hora_fin'] : null;
        $grupo = array_key_exists('grupo', $data) ? $data['grupo'] : null;
        $aula = isset($data['aula']) ? $data['aula'] : null;

        if (!$fecha || !$horaInicio || !$horaFin || !$aula) {
            return;
        }

        try {
            $inicio = Carbon::parse($fecha . ' ' . $horaInicio);
            $fin = Carbon::parse($fecha . ' ' . $horaFin);
        } catch (\Throwable $e) {
            abort(response()->json([
                'success' => false,
                'message' => 'Formato de hora o fecha inválido para la defensa.',
            ], 422));
        }

        if ($inicio->greaterThanOrEqualTo($fin) || $inicio->diffInMinutes($fin) < 60) {
            abort(response()->json([
                'success' => false,
                'message' => 'La defensa debe tener una duración mínima de 1 hora entre hora de inicio y hora de fin.',
            ], 422));
        }

        $query = Defensa::query()
            ->where('fecha_defensa', $fecha)
            ->where('aula', $aula);

        if ($grupo !== null && $grupo !== '') {
            $query->where('grupo', $grupo);
        }

        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }

        $inicioStr = $inicio->format('H:i:s');
        $finStr = $fin->format('H:i:s');

        // Tratar intervalos como [inicio, fin): permiten 08:00-09:00 y 09:00-10:00 sin solape.
        // Hay conflicto si existe una defensa con: existing_start < new_end AND existing_end > new_start
        $query->where(function ($q) use ($inicioStr, $finStr) {
            $q->where('hora_inicio', '<', $finStr)
              ->where('hora_fin', '>', $inicioStr);
        });

        if ($query->exists()) {
            abort(response()->json([
                'success' => false,
                'message' => 'Ya existe una defensa programada en el mismo horario, grupo y aula.',
            ], 422));
        }
    }

    public function byProyecto($proyectoId)
    {
        $items = Defensa::where('proyecto_id', $proyectoId)
            ->orderByDesc('fecha_defensa')
            ->orderByDesc('id')
            ->get();

        return response()->json($items);
    }

    public function byPostulanteWithTribunal($codCeta)
    {
        $defensas = Defensa::where('cod_ceta', $codCeta)
            ->orderByDesc('fecha_defensa')
            ->orderByDesc('id')
            ->get();

        if ($defensas->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $defensas->load('miembrosTribunal');

        $result = [];
        foreach ($defensas as $defensa) {
            foreach ($defensa->miembrosTribunal as $row) {
                $nombre = null;
                if ($row->tipo === 'interno') {
                    $tutor = Tutor::find($row->miembro_id);
                    if ($tutor) {
                        $nombre = trim(implode(' ', array_filter([
                            $tutor->apellido_p,
                            $tutor->apellido_m,
                            $tutor->nombre,
                        ])));
                    }
                } else {
                    $tribunal = Tribunal::find($row->miembro_id);
                    if ($tribunal) {
                        $nombre = trim(implode(' ', array_filter([
                            $tribunal->apellido_p,
                            $tribunal->apellido_m,
                            $tribunal->nombre,
                        ])));
                    }
                }

                $rolCodigo = $row->rol;
                $rolNombre = $rolCodigo;
                if ($row->rol_tribunal_id) {
                    $rolModel = RolTribunal::find($row->rol_tribunal_id);
                    if ($rolModel) {
                        $rolNombre = $rolModel->nombre;
                    }
                }

                $result[] = [
                    'defensa_id' => $defensa->id,
                    'cod_ceta' => $defensa->cod_ceta,
                    'fecha_defensa' => $defensa->fecha_defensa,
                    'hora_inicio' => $defensa->hora_inicio,
                    'hora_fin' => $defensa->hora_fin,
                    'aula' => $defensa->aula,
                    'rol_codigo' => $rolCodigo,
                    'rol_nombre' => $rolNombre,
                    'tipo' => $row->tipo,
                    'miembro_id' => $row->miembro_id,
                    'nombre' => $nombre,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function tribunalesDesignados(Request $request)
    {
        $convocatoriaId = $request->query('convocatoria_id');
        $search = trim((string) $request->query('search', ''));

        $query = Defensa::query()
            ->join('defensa_tribunal as dt', 'dt.defensa_id', '=', 'defensas.id')
            ->leftJoin('tutores as tut', function ($join) {
                $join->on('tut.id', '=', 'dt.miembro_id')
                    ->where('dt.tipo', '=', 'interno');
            })
            ->leftJoin('tribunales as trb', function ($join) {
                $join->on('trb.id', '=', 'dt.miembro_id')
                    ->where('dt.tipo', '=', 'externo');
            })
            ->leftJoin('doc_designaciones_tribunal as ddoc', function ($join) {
                $join->on('ddoc.miembro_id', '=', 'dt.miembro_id')
                    ->on('ddoc.tipo_miembro', '=', 'dt.tipo')
                    ->on('ddoc.convocatoria_id', '=', 'defensas.convocatoria_id');
            })
            ->leftJoin('convocatorias as conv', 'conv.id', '=', 'defensas.convocatoria_id')
            ->select([
                'defensas.id as defensa_id',
                'defensas.cod_ceta',
                'defensas.fecha_defensa',
                'defensas.hora_inicio',
                'defensas.hora_fin',
                'defensas.aula',
                'defensas.grupo',
                'defensas.convocatoria_id',
                'dt.tipo',
                'dt.miembro_id',
                'dt.rol',
                'dt.rol_tribunal_id',
                DB::raw("COALESCE(CONCAT_WS(' ', tut.apellido_p, tut.apellido_m, tut.nombre), CONCAT_WS(' ', trb.apellido_p, trb.apellido_m, trb.nombre)) as nombre_miembro"),
                DB::raw("COALESCE(trb.tipo, 'interno') as tipo_miembro"),
                DB::raw("conv.nombre as convocatoria_nombre"),
                DB::raw("COALESCE(conv.numero_convocatoria, 0) as convocatoria_numero"),
                DB::raw('CASE WHEN ddoc.id IS NULL THEN 0 ELSE 1 END as tiene_doc_tribunal'),
            ])
            ->orderByDesc('defensas.fecha_defensa')
            ->orderByDesc('defensas.id');

        if ($convocatoriaId !== null && $convocatoriaId !== '') {
            $query->where('defensas.convocatoria_id', $convocatoriaId);
        }

        if ($search !== '') {
            $like = '%' . mb_strtolower($search, 'UTF-8') . '%';
            // Buscar por nombre completo tanto de tutores internos como de tribunales externos
            $query->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(CONCAT_WS(" ", tut.apellido_p, tut.apellido_m, tut.nombre)) LIKE ?', [$like])
                  ->orWhereRaw('LOWER(CONCAT_WS(" ", trb.apellido_p, trb.apellido_m, trb.nombre)) LIKE ?', [$like]);
            });
        }

        $rows = $query->get();

        if ($rows->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $rolIds = $rows->pluck('rol_tribunal_id')->filter()->unique()->all();
        $rolesMap = collect();
        if (!empty($rolIds)) {
            $rolesMap = RolTribunal::query()
                ->whereIn('id', $rolIds)
                ->get()
                ->keyBy('id');
        }

        $result = $rows->map(function ($row) use ($rolesMap) {
            $rolCodigo = $row->rol;
            $rolNombre = $rolCodigo;
            if ($row->rol_tribunal_id && $rolesMap->has($row->rol_tribunal_id)) {
                $rolNombre = $rolesMap[$row->rol_tribunal_id]->nombre;
            }

            // Normalizar nombre del miembro (interno o externo)
            $nombre = trim((string) ($row->nombre_miembro ?? ''));
            if ($nombre === '') {
                if ($row->tipo_miembro === 'externo') {
                    $tribunal = Tribunal::find($row->miembro_id);
                    if ($tribunal) {
                        $nombre = trim(implode(' ', array_filter([
                            $tribunal->apellido_p,
                            $tribunal->apellido_m,
                            $tribunal->nombre,
                        ])));
                    }
                } else {
                    $tutor = Tutor::find($row->miembro_id);
                    if ($tutor) {
                        $nombre = trim(implode(' ', array_filter([
                            $tutor->apellido_p,
                            $tutor->apellido_m,
                            $tutor->nombre,
                        ])));
                    }
                }
            }

            return [
                'defensa_id' => (int) $row->defensa_id,
                'cod_ceta' => $row->cod_ceta,
                'fecha_defensa' => $row->fecha_defensa,
                'hora_inicio' => $row->hora_inicio,
                'hora_fin' => $row->hora_fin,
                'aula' => $row->aula,
                'grupo' => $row->grupo,
                'convocatoria_id' => $row->convocatoria_id,
                'convocatoria_nombre' => $row->convocatoria_nombre,
                'convocatoria_numero' => (int) $row->convocatoria_numero,
                'rol_codigo' => $rolCodigo,
                'rol_nombre' => $rolNombre,
                'tipo' => $row->tipo_miembro === 'externo' ? 'externo' : 'interno',
                'miembro_id' => (int) $row->miembro_id,
                'nombre' => $nombre !== '' ? $nombre : null,
                'tiene_doc_tribunal' => (bool) $row->tiene_doc_tribunal,
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => $result,
        ]);
    }

    public function tribunalMiembros($id)
    {
        $defensa = Defensa::findOrFail($id);

        $rows = DefensaTribunal::where('defensa_id', $defensa->id)->get();

        $result = $rows->map(function (DefensaTribunal $row) {
            $nombre = null;
            if ($row->tipo === 'interno') {
                $tutor = Tutor::find($row->miembro_id);
                if ($tutor) {
                    $nombre = trim(implode(' ', array_filter([
                        $tutor->apellido_p,
                        $tutor->apellido_m,
                        $tutor->nombre,
                    ])));
                }
            } else {
                $tribunal = Tribunal::find($row->miembro_id);
                if ($tribunal) {
                    $nombre = trim(implode(' ', array_filter([
                        $tribunal->apellido_p,
                        $tribunal->apellido_m,
                        $tribunal->nombre,
                    ])));
                }
            }

            // Código del rol (ENUM en defensa_tribunal)
            $rolCodigo = $row->rol;

            // Nombre descriptivo desde rol_tribunal
            $rolNombre = $rolCodigo;
            if ($row->rol_tribunal_id) {
                $rolModel = RolTribunal::find($row->rol_tribunal_id);
                if ($rolModel) {
                    $rolNombre = $rolModel->nombre;
                }
            }

            return [
                'rol_codigo' => $rolCodigo,
                'rol_nombre' => $rolNombre,
                'tipo'       => $row->tipo,
                'miembro_id' => $row->miembro_id,
                'nombre'     => $nombre,
            ];
        });

        return response()->json([
            'success' => true,
            'data'    => $result,
        ]);
    }

    public function setTribunal(Request $request, $id)
    {
        $defensa = Defensa::findOrFail($id);

        $data = $request->validate([
            'miembros' => 'required|array|min:1',
            'miembros.*.tipo' => 'required|in:interno,externo',
            'miembros.*.miembro_id' => 'required|integer|min:1',
            'miembros.*.rol' => 'required|in:PRESIDENTE,DELEGADO_INTERNO,DELEGADO_EXTERNO,VOCAL',
        ]);

        return DB::transaction(function () use ($defensa, $data) {
            DefensaTribunal::where('defensa_id', $defensa->id)->delete();

            $codigos = array_values(array_unique(array_map(fn ($m) => $m['rol'], $data['miembros'])));
            $rolesMap = RolTribunal::query()
                ->whereIn('codigo', $codigos)
                ->get()
                ->keyBy('codigo');

            foreach ($data['miembros'] as $m) {
                $rolModel = $rolesMap[$m['rol']] ?? null;
                DefensaTribunal::create([
                    'defensa_id' => $defensa->id,
                    'miembro_id' => $m['miembro_id'],
                    'tipo' => $m['tipo'],
                    'rol' => $m['rol'],
                    'rol_tribunal_id' => $rolModel ? $rolModel->id : null,
                ]);
            }

            $defensa->load('miembrosTribunal');

            return response()->json([
                'success' => true,
                'defensa_id' => $defensa->id,
                'miembros' => $defensa->miembrosTribunal,
            ]);
        });
    }

    public function docDesignacionTribunal(Request $request)
    {
        $data = $request->validate([
            'miembro_id' => 'required|integer|min:1',
            'tipo' => 'required|in:interno,externo',
            'rol' => 'required|string',
            'convocatoria_id' => 'nullable|integer|exists:convocatorias,id',
        ]);

        $miembroId = (int) $data['miembro_id'];
        $tipoMiembro = $data['tipo'] === 'externo' ? 'externo' : 'interno';
        $rolCodigo = (string) $data['rol'];
        $convocatoriaId = isset($data['convocatoria_id']) ? (int) $data['convocatoria_id'] : null;

        // Verificar si ya existe un documento registrado para este tribunal/convocatoria
        $docExistente = DB::table('doc_designaciones_tribunal')
            ->where('miembro_id', $miembroId)
            ->where('tipo_miembro', $tipoMiembro)
            ->where('rol', $rolCodigo)
            ->when($convocatoriaId, function ($q) use ($convocatoriaId) {
                $q->where('convocatoria_id', $convocatoriaId);
            })
            ->orderByDesc('year')
            ->orderByDesc('correlativo')
            ->first();

        $query = Defensa::query()
            ->join('defensa_tribunal as dt', 'dt.defensa_id', '=', 'defensas.id')
            ->leftJoin('rol_tribunal as rt', 'rt.id', '=', 'dt.rol_tribunal_id')
            ->where('dt.miembro_id', $miembroId)
            ->where('dt.tipo', $tipoMiembro)
            ->where('dt.rol', $rolCodigo);

        if ($convocatoriaId) {
            $query->where('defensas.convocatoria_id', $convocatoriaId);
        }

        $rows = $query
            ->select([
                'defensas.id as defensa_id',
                'defensas.cod_ceta',
                'defensas.fecha_defensa',
                'defensas.hora_inicio',
                'defensas.hora_fin',
                'defensas.grupo',
                'defensas.aula',
                'defensas.convocatoria_id',
                'dt.tipo as tipo_miembro',
                'dt.miembro_id',
                'dt.rol',
                'dt.rol_tribunal_id',
                'rt.nombre as rol_nombre',
            ])
            ->orderBy('defensas.fecha_defensa')
            ->orderBy('defensas.hora_inicio')
            ->get();

        if ($rows->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'No se encontraron defensas para el tribunal indicado',
            ], 404);
        }

        $primerRow = $rows->first();

        if ($tipoMiembro === 'externo') {
            // Tribunal externo: siempre se maneja como consultor -> COMINT
            $trib = Tribunal::find($miembroId);
            if (!$trib) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tribunal externo no encontrado',
                ], 404);
            }
            $tituloAcad = (string) ($trib->titulo_academico ?? '');
            $nombrePlano = trim(implode(' ', array_filter([
                $trib->nombre ?? null,
                $trib->apellido_p ?? null,
                $trib->apellido_m ?? null,
            ])));
            $paraNombre = trim(trim($tituloAcad . ' ' . $nombrePlano));
            $tipoDocCod = 'COMINT';
        } else {
            // Tribunal interno: decidir MEM/COMINT según tipo_tutor_id (tabla tipo_tutor)
            $tutor = Tutor::find($miembroId);
            if (!$tutor) {
                return response()->json([
                    'success' => false,
                    'message' => 'Tutor no encontrado',
                ], 404);
            }
            $tituloAcad = (string) ($tutor->titulo_academico ?? '');
            $nombrePlano = trim(implode(' ', array_filter([
                $tutor->nombre ?? null,
                $tutor->apellido_p ?? null,
                $tutor->apellido_m ?? null,
            ])));
            $paraNombre = trim(trim($tituloAcad . ' ' . $nombrePlano));

            // En tipo_tutor: 1 = Consultor, 2 = De Planta
            $tipoTutorId = (int) ($tutor->tipo_tutor_id ?? 1);
            $tipoDocCod = $tipoTutorId === 2 ? 'MEM' : 'COMINT';
        }
        $tipoDocNombre = $tipoDocCod === 'MEM' ? 'MEMORÁNDUM' : 'COMUNICACIÓN INTERNA';

        $now = Carbon::now();
        $fechaDoc = $now->format('d/m/Y');
        $anio = (int) $now->year;

        // Datos fijos de encabezado del documento
        $paraCargo = 'DOCENTE TÉCNICO';
        $deNombre = 'Ing. Bradley Jaillita Burgoa';
        $deCargo = 'DIRECTOR ACADÉMICO';
        $asunto = 'DESIGNACIÓN TRIBUNAL CALIFICADOR';

        // Si ya existe documento, reutilizar sus datos; si no, generar nuevo correlativo/CITE
        if ($docExistente) {
            $tipoDocCod = $docExistente->doc_tipo;
            $anio = (int) $docExistente->year;
            $correlativoInt = (int) $docExistente->correlativo;
            $correlativoStr = str_pad((string) $correlativoInt, 3, '0', STR_PAD_LEFT);
            $cite = (string) $docExistente->cite;
        } else {
            $sga = app(SocratesApiService::class);
            $abreviaturaBase = rtrim((string) $sga->getAbreviaturaBase(), '/');

            // Usar la misma convención que TutorController::fetchSequenceFromSga
            // MEM -> id_tipo_documento = 2, COMINT -> id_tipo_documento = 4
            $docTipoId = $tipoDocCod === 'MEM' ? 2 : 4;

            // Intentar obtener correlativo desde SGA
            $remoteCorrelativo = null;
            $corResult = $sga->getCorrelativoAbreviatura($abreviaturaBase . '/', $docTipoId, $anio, null, []);
            if (!empty($corResult['success']) && !empty($corResult['data']) && is_array($corResult['data'])) {
                $dataCor = $corResult['data'];
                if (isset($dataCor['numero']) && is_numeric($dataCor['numero'])) {
                    $remoteCorrelativo = (int) $dataCor['numero'];
                } elseif (isset($dataCor['correlativo']) && is_numeric($dataCor['correlativo'])) {
                    $remoteCorrelativo = (int) $dataCor['correlativo'];
                }
            }

            // Sincronizar con tabla local doc_designacion_secuencias (compartida con tutores)
            $correlativoInt = null;
            DB::transaction(function () use ($tipoDocCod, $anio, $remoteCorrelativo, &$correlativoInt) {
                $seq = DB::table('doc_designacion_secuencias')
                    ->where('doc_tipo', $tipoDocCod)
                    ->where('year', $anio)
                    ->lockForUpdate()
                    ->first();

                $lastLocal = $seq ? (int) $seq->last_correlativo : 0;

                if ($remoteCorrelativo !== null && $remoteCorrelativo > $lastLocal) {
                    // Usar el valor del SGA si es mayor que la secuencia local
                    $correlativoInt = $remoteCorrelativo;
                } else {
                    // Caso contrario, avanzar secuencia local
                    $correlativoInt = $lastLocal + 1;
                }

                $newLast = max($lastLocal, $correlativoInt);

                DB::table('doc_designacion_secuencias')->updateOrInsert(
                    ['doc_tipo' => $tipoDocCod, 'year' => $anio],
                    [
                        'last_correlativo' => $newLast,
                        'updated_at' => Carbon::now(),
                        'created_at' => $seq ? $seq->created_at : Carbon::now(),
                    ]
                );
            });

            $correlativoStr = str_pad((string) $correlativoInt, 3, '0', STR_PAD_LEFT);

            // Construir CITE base
            $cite = $abreviaturaBase . '/' . $tipoDocCod . '/' . $anio . '/' . $correlativoStr;

            // Intentar registrar también el documento en el SGA (misma lógica que para tutores)
            $sgaDoc = $this->createSgaDocumentForTribunal(
                $tipoDocCod,
                $anio,
                $correlativoStr,
                $paraNombre,
                $paraCargo,
                $asunto,
                null // carreraSlug: por ahora usar configuración por defecto del SGA
            );
            if (is_array($sgaDoc)) {
                if (!empty($sgaDoc['correlativo'])) {
                    $correlativoInt = (int) $sgaDoc['correlativo'];
                    $correlativoStr = str_pad((string) $correlativoInt, 3, '0', STR_PAD_LEFT);
                }
                if (!empty($sgaDoc['cite'])) {
                    $cite = (string) $sgaDoc['cite'];
                } else {
                    $cite = $abreviaturaBase . '/' . $tipoDocCod . '/' . $anio . '/' . $correlativoStr;
                }

                // Asegurar que la tabla de secuencias local refleje el correlativo final
                DB::table('doc_designacion_secuencias')->updateOrInsert(
                    ['doc_tipo' => $tipoDocCod, 'year' => $anio],
                    [
                        'last_correlativo' => $correlativoInt,
                        'updated_at' => Carbon::now(),
                    ]
                );
            }
        }

        $fechasMap = [];
        $minHoraGlobal = null;
        $maxHoraGlobal = null;

        foreach ($rows as $r) {
            if (!$r->fecha_defensa) {
                continue;
            }
            $fechaIso = Carbon::parse($r->fecha_defensa)->format('Y-m-d');
            $keyParts = [
                $fechaIso,
                (string) ($r->rol_tribunal_id ?: $r->rol),
                (string) ($r->grupo ?? ''),
                (string) ($r->aula ?? ''),
            ];
            $key = implode('|', $keyParts);

            if (!isset($fechasMap[$key])) {
                $fechasMap[$key] = [
                    'fecha_iso' => $fechaIso,
                    'rol_nombre' => $r->rol_nombre ?: $r->rol,
                    'grupo' => $r->grupo,
                    'aula' => $r->aula,
                    'hora_min' => null,
                    'hora_max' => null,
                    'count' => 0,
                ];
            }

            $horaIni = $r->hora_inicio ? substr((string) $r->hora_inicio, 0, 5) : null;
            $horaFin = $r->hora_fin ? substr((string) $r->hora_fin, 0, 5) : null;

            if ($horaIni && ($fechasMap[$key]['hora_min'] === null || $horaIni < $fechasMap[$key]['hora_min'])) {
                $fechasMap[$key]['hora_min'] = $horaIni;
            }
            if ($horaFin && ($fechasMap[$key]['hora_max'] === null || $horaFin > $fechasMap[$key]['hora_max'])) {
                $fechasMap[$key]['hora_max'] = $horaFin;
            }

            if ($horaIni && ($minHoraGlobal === null || $horaIni < $minHoraGlobal)) {
                $minHoraGlobal = $horaIni;
            }
            if ($horaFin && ($maxHoraGlobal === null || $horaFin > $maxHoraGlobal)) {
                $maxHoraGlobal = $horaFin;
            }

            $fechasMap[$key]['count']++;
        }

        if (empty($fechasMap)) {
            return response()->json([
                'success' => false,
                'message' => 'No se pudo construir cronograma para el tribunal',
            ], 400);
        }

        $rowsArr = array_values($fechasMap);
        usort($rowsArr, function ($a, $b) {
            if ($a['fecha_iso'] === $b['fecha_iso']) {
                $ha = $a['hora_min'] ?? '';
                $hb = $b['hora_min'] ?? '';
                return strcmp($ha, $hb);
            }
            return strcmp($a['fecha_iso'], $b['fecha_iso']);
        });

        $fechasUnicas = [];
        foreach ($rowsArr as $g) {
            $fechasUnicas[$g['fecha_iso']] = true;
        }
        $fechasKeys = array_keys($fechasUnicas);
        sort($fechasKeys);

        $diasLabels = [];
        foreach ($fechasKeys as $iso) {
            $d = Carbon::parse($iso)->day;
            $diasLabels[] = (string) $d;
        }

        if (count($diasLabels) === 1) {
            $diasDefensa = $diasLabels[0];
        } elseif (count($diasLabels) === 2) {
            $diasDefensa = $diasLabels[0] . ' y ' . $diasLabels[1];
        } else {
            $last = array_pop($diasLabels);
            $diasDefensa = implode(', ', $diasLabels) . ' y ' . $last;
        }

        $firstDate = Carbon::parse($fechasKeys[0]);
        $mesDefensa = mb_strtoupper($firstDate->locale('es')->isoFormat('MMMM'), 'UTF-8');
        $anioDefensa = $firstDate->year;
        $carreraNombre = null;

        $templatePath = resource_path('templates/plantilla-designacion-tribunal.docx');
        if (!is_string($templatePath) || !file_exists($templatePath)) {
            return response()->json([
                'success' => false,
                'message' => 'Plantilla de designación de tribunal no encontrada',
            ], 500);
        }

        $tpl = new TemplateProcessor($templatePath);
        $tpl->setValue('FECHA_DOC', $fechaDoc);
        $tpl->setValue('TIPO_DOC_NOMBRE', $tipoDocNombre);
        $tpl->setValue('TIPO_DOC_COD', $tipoDocCod);
        $tpl->setValue('ANIO', (string) $anio);
        $tpl->setValue('CORRELATIVO', (string) $correlativoStr);
        $tpl->setValue('CITE', $cite);
        $tpl->setValue('FOJAS', '1 de 1');
        $tpl->setValue('PARA_NOMBRE', $paraNombre);
        $tpl->setValue('PARA_CARGO', $paraCargo);
        $tpl->setValue('DE_NOMBRE', $deNombre);
        $tpl->setValue('DE_CARGO', $deCargo);
        $tpl->setValue('ASUNTO', $asunto);
        $tpl->setValue('MES_DEFENSA', $mesDefensa);
        $tpl->setValue('ANIO_DEFENSA', (string) $anioDefensa);
        $tpl->setValue('DIAS_DEFENSA', $diasDefensa);
        $tpl->setValue('CARRERA_NOMBRE', (string) $carreraNombre);
        $tpl->setValue('HORA_INICIO', (string) ($minHoraGlobal ?? ''));
        $tpl->setValue('HORA_FIN', (string) ($maxHoraGlobal ?? ''));
        $tpl->setValue('PIE_INICIALES_1', 'BJB');
        $tpl->setValue('PIE_INICIALES_2', '');
        $tpl->setValue('PIE_CC', 'CC: REC/DA');

        $totalFilas = count($rowsArr);
        $tpl->cloneRow('FILA_FECHA', $totalFilas);

        $index = 1;
        foreach ($rowsArr as $g) {
            $fechaFmt = Carbon::parse($g['fecha_iso'])->format('d/m/Y');
            $horaIni = (string) ($g['hora_min'] ?? '');
            $horaFin = (string) ($g['hora_max'] ?? '');
            $funcion = (string) ($g['rol_nombre'] ?? '');
            $grupo = (string) ($g['grupo'] ?? '');
            $aula = (string) ($g['aula'] ?? '');
            $nPost = (string) ($g['count'] ?? 0);

            $tpl->setValue('FILA_FECHA#' . $index, $fechaFmt);
            $tpl->setValue('FILA_HORA_INICIO#' . $index, $horaIni);
            $tpl->setValue('FILA_HORA_CONCLUSION#' . $index, $horaFin);
            $tpl->setValue('FILA_FUNCION#' . $index, $funcion);
            $tpl->setValue('FILA_NRO_POST#' . $index, $nPost);
            $tpl->setValue('FILA_GRUPO#' . $index, $grupo);
            $tpl->setValue('FILA_AULA#' . $index, $aula);

            $index++;
        }

        // Construir resumen de defensas para registro local (similar a estudiantes_resumen)
        $defensasResumen = [];
        foreach ($rowsArr as $g) {
            $defensasResumen[] = [
                'fecha' => $g['fecha_iso'],
                'hora_inicio' => $g['hora_min'],
                'hora_fin' => $g['hora_max'],
                'rol' => $g['rol_nombre'],
                'grupo' => $g['grupo'],
                'aula' => $g['aula'],
                'nro_postulantes' => $g['count'],
            ];
        }

        // Registrar documento de tribunal en tabla local doc_designaciones_tribunal
        // Solo insertar si no existe un registro previo para este tribunal/convocatoria
        if (!$docExistente) {
            DB::table('doc_designaciones_tribunal')->insert([
                'doc_tipo' => $tipoDocCod,
                'year' => $anio,
                'correlativo' => $correlativoInt,
                'cite' => $cite,
                'miembro_id' => $miembroId,
                'tipo_miembro' => $tipoMiembro,
                'rol' => $rolCodigo,
                'convocatoria_id' => $convocatoriaId,
                'para_nombre' => $paraNombre,
                'para_cargo' => $paraCargo,
                'de_nombre' => $deNombre,
                'de_cargo' => $deCargo,
                'asunto' => $asunto,
                'defensas_resumen' => !empty($defensasResumen) ? json_encode($defensasResumen) : null,
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now(),
            ]);
        }

        $path = storage_path('app/tmp');
        if (!is_dir($path)) {
            @mkdir($path, 0777, true);
        }
        $fileName = 'designacion-tribunal-' . $tipoMiembro . '-' . (string) $miembroId . '-' . $anio . '-' . $correlativoStr . '.docx';
        $temp = $path . DIRECTORY_SEPARATOR . $fileName;
        $tpl->saveAs($temp);

        return response()->download($temp, $fileName, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ])->deleteFileAfterSend(true);
    }

    private function createSgaDocumentForTribunal($docType, $year, $numeroStr, $paraNombre, $paraCargo, $asunto, $carreraSlug = null)
    {
        try {
            $sgaService = app(SocratesApiService::class);
        } catch (\Throwable $e) {
            Log::warning('SGA service no disponible para crear documento de tribunal', ['error' => $e->getMessage()]);
            return null;
        }

        if (!method_exists($sgaService, 'ensureWebSession') || !method_exists($sgaService, 'buildDocumentoPayload') || !method_exists($sgaService, 'crearDocumento')) {
            Log::warning('SocratesApiService no soporta creación de documentos para tribunal');
            return null;
        }

        if ($carreraSlug) {
            try {
                $sgaService->setCarrera($carreraSlug);
            } catch (\Throwable $e) {
                Log::warning('No se pudo aplicar carrera para documento SGA (tribunal)', [
                    'carrera' => $carreraSlug,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $config = method_exists($sgaService, 'getSgaConfig') ? $sgaService->getSgaConfig() : null;
        if (!$config) {
            Log::warning('No existe configuración SGA en base de datos para documento de tribunal');
            return null;
        }

        $sessionResult = $sgaService->ensureWebSession(
            isset($config->web_user) ? $config->web_user : null,
            isset($config->web_password) ? $config->web_password : null
        );
        if (empty($sessionResult['success'])) {
            Log::warning('No se pudo iniciar sesión web en el SGA para documento de tribunal', [
                'message' => isset($sessionResult['message']) ? $sessionResult['message'] : null,
            ]);
            return null;
        }

        $emisorId = isset($config->emisor_id) ? $config->emisor_id : null;
        if (!$emisorId) {
            Log::warning('Configuración SGA sin emisor_id para documento de tribunal');
            return null;
        }

        $abreviaturaBase = $config->abreviatura ?: 'CETA/DA/';
        $cargoId = isset($config->cargo_id) ? $config->cargo_id : 3;
        $cargoNombre = isset($config->cargo_nombre) && $config->cargo_nombre !== '' ? $config->cargo_nombre : 'DIRECTOR ACADÉMICO';
        $genero = isset($config->emisor_genero) && $config->emisor_genero !== '' ? $config->emisor_genero : 'M';
        $institucion = isset($config->institucion) ? $config->institucion : '';

        $abreviatura = rtrim($abreviaturaBase, '/') . '/';
        $codigoDocumento = strtoupper($docType);
        $numeroStr = $numeroStr ?: '000';

        $idCargoEmite = $cargoId . '|' . $cargoNombre . '|' . $abreviatura;

        $payloadParams = [
            'codigo_tipo_documento' => $codigoDocumento,
            'emite' => $emisorId,
            'nombre_emite' => 'Ing. Bradley Jaillita Burgoa',
            'cargo_emite' => 'DIRECTOR ACADÉMICO',
            'id_cargo_emite' => $idCargoEmite,
            'genero' => $genero,
            'tiene_via' => 'false',
            'via_nombre' => '',
            'via_cargo' => '',
            'nombre_recibe' => $paraNombre ?: '',
            'id_cargo_recibe' => '',
            'cargo_recibe' => $paraCargo ?: '',
            'institucion' => $institucion,
            'asunto' => $asunto ?: 'DESIGNACIÓN TRIBUNAL CALIFICADOR',
        ];

        $payloadResult = $sgaService->buildDocumentoPayload($payloadParams);
        if (empty($payloadResult['success'])) {
            Log::warning('No se pudo construir payload para documento SGA (tribunal)', [
                'message' => isset($payloadResult['message']) ? $payloadResult['message'] : null,
            ]);
            return null;
        }

        $createResult = $sgaService->crearDocumento($payloadResult['data']);
        if (empty($createResult['success'])) {
            Log::warning('Fallo al crear documento en SGA (tribunal)', [
                'status' => isset($createResult['status']) ? $createResult['status'] : null,
                'message' => isset($createResult['message']) ? $createResult['message'] : null,
            ]);
            return null;
        }

        // Reusar el parser del TutorController sería ideal, pero aquí no lo tenemos.
        // Como fallback, si el SGA no devuelve un CITE estructurado, construimos uno local.
        $rawBody = isset($createResult['body']) ? $createResult['body'] : null;
        if (is_array($rawBody) && (isset($rawBody['cite']) || isset($rawBody['correlativo']))) {
            $parsedCor = isset($rawBody['correlativo']) ? $rawBody['correlativo'] : null;
            $parsedCorStr = $parsedCor !== null ? str_pad((string) $parsedCor, 3, '0', STR_PAD_LEFT) : $numeroStr;
            $cite = $abreviatura . $codigoDocumento . '/' . $year . '/' . $parsedCorStr;
            return [
                'cite' => $cite,
                'correlativo' => $parsedCor !== null ? (int) $parsedCor : (int) ltrim($numeroStr, '0'),
            ];
        }

        $cite = $abreviatura . $codigoDocumento . '/' . $year . '/' . $numeroStr;
        return [
            'cite' => $cite,
            'correlativo' => $numeroStr ? (int) ltrim($numeroStr, '0') : null,
        ];
    }

    public function planillaEvaluacionDocx($id)
    {
        $defensa = Defensa::find($id);
        if (!$defensa) {
            return response()->json([
                'success' => false,
                'message' => 'Defensa no encontrada',
            ], 404);
        }

        $tieneTribunal = DefensaTribunal::where('defensa_id', $defensa->id)->exists();
        if (!$tieneTribunal) {
            return response()->json([
                'success' => false,
                'message' => 'No se puede generar la planilla de evaluación porque la defensa aún no tiene tribunales designados.',
            ], 422);
        }

        $row = DB::table('defensas as d')
            ->leftJoin('proyecto as pr', 'd.proyecto_id', '=', 'pr.id')
            ->leftJoin('postulantes as p', 'd.cod_ceta', '=', 'p.cod_ceta')
            ->leftJoin('inscrip_modalidad as im', 'im.cod_ceta_est', '=', 'd.cod_ceta')
            ->leftJoin('modalidad as m', 'im.modalidad_id', '=', 'm.id')
            ->leftJoin('carrera', 'p.carrera', '=', 'carrera.nombre_carrera')
            ->select([
                'd.id as defensa_id',
                'd.cod_ceta',
                'd.fecha_defensa',
                'd.aula',
                'pr.nombre as proyecto_nombre',
                'pr.objetivo as proyecto_objetivo',
                'p.nombres_est',
                'p.ap_pat',
                'p.ap_mat',
                'p.ci',
                'p.carrera as carrera_nombre_raw',
                'carrera.nombre_carrera as carrera_nombre_cat',
                'm.nombre as modalidad_nombre',
            ])
            ->where('d.id', $defensa->id)
            ->first();

        if (!$row) {
            return response()->json([
                'success' => false,
                'message' => 'No se encontraron datos suficientes para la planilla de evaluación',
            ], 404);
        }

        $postulanteNombre = null;
        if (isset($row->ap_pat) || isset($row->ap_mat)) {
            $postulanteNombre = trim(implode(' ', array_filter([
                $row->ap_pat ?? '',
                $row->ap_mat ?? '',
                $row->nombres_est ?? '',
            ])));
        } else {
            $postulanteNombre = (string) ($row->nombres_est ?? '');
        }

        $carreraNombre = $row->carrera_nombre_cat ?: $row->carrera_nombre_raw;
        $modalidadNombre = (string) ($row->modalidad_nombre ?? 'PROYECTO DE GRADO');
        $modalidadNombre = mb_strtoupper($modalidadNombre, 'UTF-8');
        $temaProyecto = (string) ($row->proyecto_nombre ?? '');

        $fechaDefensa = $defensa->fecha_defensa ? Carbon::parse($defensa->fecha_defensa) : null;
        if (!$fechaDefensa) {
            return response()->json([
                'success' => false,
                'message' => 'La defensa no tiene fecha registrada',
            ], 422);
        }

        try {
            $mesConv = $fechaDefensa->locale('es')->isoFormat('MMMM');
        } catch (\Throwable $e) {
            $mesConv = $fechaDefensa->format('F');
        }
        $mesConv = mb_strtoupper($mesConv, 'UTF-8');
        $anioConv = $fechaDefensa->year;

        try {
            $pieFecha = $fechaDefensa->locale('es')->isoFormat('D [de] MMMM [del] YYYY');
        } catch (\Throwable $e) {
            $pieFecha = $fechaDefensa->format('d/m/Y');
        }

        $templatePath = resource_path('templates/plantilla-planilla-evaluacion.docx');
        if (!is_string($templatePath) || !file_exists($templatePath)) {
            return response()->json([
                'success' => false,
                'message' => 'Plantilla de planilla de evaluación no encontrada',
            ], 500);
        }

        try {
            $tpl = new TemplateProcessor($templatePath);

            $tpl->setValue('INSTITUTO_NOMBRE', 'INSTITUTO TECNOLÓGICO DE ENSEÑANZA AUTOMOTRIZ');
            $tpl->setValue('INSTITUTO_SIGLA', 'CETA');
            $tpl->setValue('INSTITUTO_CIUDAD_PAIS', 'Cochabamba - Bolivia');
            $tpl->setValue('INSTITUTO_RESOLUCION', 'Resolución Ministerial N° 0595/2019');

            $tpl->setValue('MODALIDAD_NOMBRE', (string) $modalidadNombre);
            $tpl->setValue('CONVOCATORIA_MES_MAYUS', (string) $mesConv);
            $tpl->setValue('CONVOCATORIA_ANIO', (string) $anioConv);

            $tpl->setValue('POSTULANTE_NOMBRE_COMPLETO', (string) $postulanteNombre);
            $tpl->setValue('POSTULANTE_CI', (string) ($row->ci ?? ''));
            $tpl->setValue('CARRERA_NOMBRE', (string) ($carreraNombre ?? ''));
            $tpl->setValue('TEMA_PROYECTO', (string) $temaProyecto);

            $tpl->setValue('PIE_LUGAR', 'Cochabamba');
            $tpl->setValue('PIE_FECHA_TEXTO', (string) $pieFecha);

            $path = storage_path('app/tmp');
            if (!is_dir($path)) {
                @mkdir($path, 0777, true);
            }

            $fileName = 'planilla-evaluacion-' . (string) ($row->cod_ceta ?? $defensa->id) . '.docx';
            $temp = $path . DIRECTORY_SEPARATOR . $fileName;
            $tpl->saveAs($temp);

            return response()->download($temp, $fileName, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            ])->deleteFileAfterSend(true);
        } catch (\Throwable $e) {
            Log::error('Error generando planilla de evaluación DOCX', [
                'defensa_id' => $defensa->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al generar la planilla de evaluación',
            ], 500);
        }
    }
}
