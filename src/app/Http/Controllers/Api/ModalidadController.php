<?php

namespace App\Http\Controllers\Api;

use App\Models\Modalidad;

class ModalidadController extends CrudController
{
    protected $modelClass = Modalidad::class;
    
    protected function rules()
    {
        return [
            'nombre' => 'nullable|string|max:255',
            'descripcion' => 'nullable|string',
            'monto_arancel' => 'nullable|string|max:100',
        ];
    }
}
