<?php

namespace App\Http\Controllers\Api;

use App\Models\GradosHomolCp;

class GradosHomolCpController extends CrudController
{
    protected $modelClass = GradosHomolCp::class;

    protected function rules()
    {
        return [
            'homol_cp_id' => 'nullable|exists:res_homol_cp,id',
            'grado' => 'nullable|string|max:255',
            'gestion' => 'nullable|integer',
        ];
    }
}
