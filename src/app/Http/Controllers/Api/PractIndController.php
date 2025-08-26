<?php

namespace App\Http\Controllers\Api;

use App\Models\PractInd;

class PractIndController extends CrudController
{
    protected $modelClass = PractInd::class;

    protected function rules()
    {
        return [
            'empresa' => 'nullable|string|max:255',
            'fecha_inicio' => 'nullable|date',
            'fecha_fin' => 'nullable|date',
            'descripcion' => 'nullable|string',
            'estado' => 'nullable|string|max:255',
        ];
    }
}
