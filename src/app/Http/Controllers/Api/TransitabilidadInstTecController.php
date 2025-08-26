<?php

namespace App\Http\Controllers\Api;

use App\Models\TransitabilidadInstTec;

class TransitabilidadInstTecController extends CrudController
{
    protected $modelClass = TransitabilidadInstTec::class;

    protected function rules()
    {
        return [
            'id_doc_req' => 'nullable|integer',
            'serie_titulo_tm' => 'nullable|string|max:255',
            'numero_titulo_tm' => 'nullable|string|max:255',
            'fecha_emision' => 'nullable|date',
        ];
    }
}
