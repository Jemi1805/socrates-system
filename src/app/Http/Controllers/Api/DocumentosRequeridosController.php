<?php

namespace App\Http\Controllers\Api;

use App\Models\DocumentosRequeridos;

class DocumentosRequeridosController extends CrudController
{
    protected $modelClass = DocumentosRequeridos::class;
    
    protected function rules()
    {
        return [
            'nombre_doc' => 'required|string|max:255',
            'obligatorio' => 'nullable|boolean',
        ];
    }
}
