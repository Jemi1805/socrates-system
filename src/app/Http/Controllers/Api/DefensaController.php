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
            'aula' => 'nullable|string|max:100',
            'observaciones' => 'nullable|string',
        ]);

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
            'aula' => 'nullable|string|max:100',
            'convocatoria_id' => 'required|integer|exists:convocatorias,id',
            'observaciones' => 'nullable|string',
        ]);

        $user = $request->user();

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

    public function byProyecto($proyectoId)
    {
        $items = Defensa::where('proyecto_id', $proyectoId)
            ->orderByDesc('fecha_defensa')
            ->orderByDesc('id')
            ->get();

        return response()->json($items);
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
