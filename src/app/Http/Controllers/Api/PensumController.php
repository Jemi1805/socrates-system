<?php

namespace App\Http\Controllers\Api;

use App\Models\Pensum;

class PensumController extends CrudController
{
    protected $modelClass = Pensum::class;

    protected function rules()
    {
        return [
            'cod_pensum' => 'required|string|max:30',
            'cod_carrera' => 'required|string|max:10|exists:carrera,cod_carrera',
            'cantidadsemestre' => 'nullable|integer|min:1|max:12',
            'descripcion' => 'nullable|string|max:255',
            'orden' => 'nullable|integer|min:0',
            'activo' => 'nullable|boolean',
            'cod_secuencial' => 'nullable|integer',
            'nivel' => 'nullable|string|max:100',
            'identificador' => 'nullable|string|max:50',
            'resolucion' => 'nullable|string|max:100',
        ];
    }
}
