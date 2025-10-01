<?php

namespace App\Http\Controllers\Api;

use App\Models\Proyecto;
use Illuminate\Http\Request;

class ProyectoController extends CrudController
{
    protected $modelClass = Proyecto::class;

    protected function rules()
    {
        return [
            'cod_ceta' => 'nullable|string|max:50',
            'nombres' => 'nullable|string|max:150',
            'apellidos' => 'nullable|string|max:150',
            'ci' => 'nullable|string|max:50',
            'expedicion' => 'nullable|string|max:10',
            'celular' => 'nullable|string|max:30',
            'instituto' => 'nullable|string|max:255',
            'carrera' => 'nullable|string|max:120',
            'nombre' => 'nullable|string|max:255',
            'tipo' => 'nullable|string|max:255',
            'objetivo' => 'nullable|string',
            'estado' => 'nullable|string|max:255',
            'porcentaje_avance' => 'nullable|integer|min:0|max:100',
            'inscrip_modalidad_id' => 'nullable|exists:inscrip_modalidad,id',
        ];
    }

    // GET /api/proyecto/by_cod?cod_ceta=XXXX
    public function getByCodCeta(Request $request)
    {
        $cod = $request->query('cod_ceta');
        if (!$cod) {
            return response()->json(null);
        }
        $proy = Proyecto::with('inscripModalidad')
            ->where('cod_ceta', (string)$cod)
            ->orderByDesc('id')
            ->first();
        return response()->json($proy);
    }
}
