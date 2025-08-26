<?php

namespace App\Http\Controllers\Api;

use App\Models\Proyecto;

class ProyectoController extends CrudController
{
    protected $modelClass = Proyecto::class;

    protected function rules()
    {
        return [
            'modalidad_id' => 'nullable|exists:modalidad,id',
            'nombre' => 'nullable|string|max:255',
            'tipo' => 'nullable|string|max:255',
            'objetivo' => 'nullable|string',
            'estado' => 'nullable|string|max:255',
            'porcentaje_avance' => 'nullable|integer|min:0|max:100',
        ];
    }
}
