<?php

namespace App\Http\Controllers\Api;

use App\Models\RaHomolEx;

class RaHomolExController extends CrudController
{
    protected $modelClass = RaHomolEx::class;

    protected function rules()
    {
        return [
            'id_doc_req' => 'nullable|integer',
            'nro_res' => 'nullable|string|max:255',
            'fecha_emision' => 'nullable|date',
        ];
    }
}
