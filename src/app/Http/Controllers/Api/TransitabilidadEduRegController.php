<?php

namespace App\Http\Controllers\Api;

use App\Models\TransitabilidadEduReg;

class TransitabilidadEduRegController extends CrudController
{
    protected $modelClass = TransitabilidadEduReg::class;

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
