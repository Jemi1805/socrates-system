<?php

namespace App\Http\Controllers\Api;

use App\Models\DiplomaBachiller;

class DiplomaBachillerController extends CrudController
{
    protected $modelClass = DiplomaBachiller::class;
    
    protected function rules()
    {
        return [
            'nro_serie' => 'required|string|max:255',
            'id_doc_req' => 'nullable|exists:documentos_requeridos,id',
            'emision' => 'nullable|string|max:255',
            'fecha_emision' => 'nullable|date',
            'observación' => 'nullable|string',
            'gestion_bachiller' => 'nullable|integer',
        ];
    }
}
