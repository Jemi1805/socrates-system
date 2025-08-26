<?php

namespace App\Http\Controllers\Api;

use App\Models\InscripModalidad;

class InscripModalidadController extends CrudController
{
    protected $modelClass = InscripModalidad::class;
    
    protected function rules()
    {
        return [
            'cod_ceta_est' => 'nullable|integer',
            'modalidad_id' => 'nullable|exists:modalidad,id',
            'pract_ind_id' => 'nullable|exists:pract_ind,id',
            'aranceles_id' => 'nullable|exists:aranceles_est,id',
            'fecha_inscripcion' => 'nullable|date',
            'estado' => 'nullable|string|max:255',
        ];
    }
}