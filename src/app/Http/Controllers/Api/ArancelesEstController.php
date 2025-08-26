<?php

namespace App\Http\Controllers\Api;

use App\Models\ArancelesEst;

class ArancelesEstController extends CrudController
{
    protected $modelClass = ArancelesEst::class;
    protected function rules()
    {
        return [
            'cod_ceta_est' => 'nullable|integer',
            'concepto' => 'nullable|string|max:255',
            'monto' => 'nullable|numeric',
            'pagado' => 'nullable|boolean',
            'fecha_pago' => 'nullable|date',
        ];
    }
}