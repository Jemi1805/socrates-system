<?php

namespace App\Http\Controllers\Api;

use App\Models\TraspasosInstituto;

class TraspasosInstitutoController extends CrudController
{
    protected $modelClass = TraspasosInstituto::class;

    protected function rules()
    {
        return [
            'id_doc_req' => 'nullable|integer',
            'instituto_origen' => 'nullable|string|max:255',
            'grados_cursados' => 'nullable|string|max:255',
            'gestiones_cursadas' => 'nullable|string|max:255',
        ];
    }
}
