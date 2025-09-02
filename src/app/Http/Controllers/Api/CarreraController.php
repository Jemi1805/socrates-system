<?php

namespace App\Http\Controllers\Api;

use App\Models\Carrera;

class CarreraController extends CrudController
{
    protected $modelClass = Carrera::class;

    protected function rules()
    {
        return [
            'cod_carrera' => 'required|string|max:10',
            'nombre_carrera' => 'required|string|max:255',
            'descripcion' => 'nullable|string|max:255',
        ];
    }
}
