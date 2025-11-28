<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Defensa;
use App\Models\DefensaTribunal;
use App\Models\Tutor;
use App\Models\Tribunal;
use App\Models\RolTribunal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

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
            ->leftJoin('convocatorias as conv', 'conv.id', '=', 'defensas.convocatoria_id')
            ->select([
                'defensas.id as defensa_id',
                'defensas.cod_ceta',
                'defensas.fecha_defensa',
                'defensas.hora_inicio',
                'defensas.hora_fin',
                'defensas.aula',
                'defensas.convocatoria_id',
                'dt.tipo',
                'dt.miembro_id',
                'dt.rol',
                'dt.rol_tribunal_id',
                DB::raw("COALESCE(CONCAT_WS(' ', tut.apellido_p, tut.apellido_m, tut.nombre), CONCAT_WS(' ', trb.apellido_p, trb.apellido_m, trb.nombre)) as nombre_miembro"),
                DB::raw("COALESCE(trb.tipo, 'interno') as tipo_miembro"),
                DB::raw("conv.nombre as convocatoria_nombre"),
                DB::raw("COALESCE(conv.numero_convocatoria, 0) as convocatoria_numero"),
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
                'convocatoria_id' => $row->convocatoria_id,
                'convocatoria_nombre' => $row->convocatoria_nombre,
                'convocatoria_numero' => (int) $row->convocatoria_numero,
                'rol_codigo' => $rolCodigo,
                'rol_nombre' => $rolNombre,
                'tipo' => $row->tipo_miembro === 'externo' ? 'externo' : 'interno',
                'miembro_id' => (int) $row->miembro_id,
                'nombre' => $nombre !== '' ? $nombre : null,
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
}
