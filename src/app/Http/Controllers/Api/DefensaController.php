<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Defensa;
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
}
