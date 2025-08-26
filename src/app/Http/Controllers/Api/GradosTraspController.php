<?php

namespace App\Http\Controllers\Api;

use App\Models\GradosTrasp;

class GradosTraspController extends CrudController
{
    protected $modelClass = GradosTrasp::class;
    
    protected function rules()
    {
        return [
            'traspaso_id' => 'nullable|exists:traspasos_instituto,id',
            'grado' => 'nullable|string|max:255',
            'gestion' => 'nullable|integer',
        ];
    }
}
