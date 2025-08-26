<?php

namespace App\Http\Controllers\Api;

use App\Models\ResHomolCp;

class ResHomolCpController extends CrudController
{
    protected $modelClass = ResHomolCp::class;
    
    protected function rules()
    {
        return [
            'id_doc_req' => 'nullable|integer',
            'nro_res' => 'nullable|string|max:255',
            'fecha_emision' => 'nullable|date',
            'grados_cursados' => 'nullable|string|max:255',
            'gestiones_cursadas' => 'nullable|string|max:255',
        ];
    }
}
