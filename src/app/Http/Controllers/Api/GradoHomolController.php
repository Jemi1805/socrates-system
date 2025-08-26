<?php

namespace App\Http\Controllers\Api;

use App\Models\GradoHomol;

class GradoHomolController extends CrudController
{
    protected $modelClass = GradoHomol::class;
    
    protected function rules()
    {
        return [
            'homologacion_id' => 'nullable|exists:ra_homol_ex,id',
            'grado_sec' => 'nullable|string|max:255',
            'gestion_sec' => 'nullable|integer',
        ];
    }
}
