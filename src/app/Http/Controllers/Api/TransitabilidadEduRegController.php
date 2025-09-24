<?php

namespace App\Http\Controllers\Api;

use App\Models\TransitabilidadEduReg;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransitabilidadEduRegController extends CrudController
{
    protected $modelClass = TransitabilidadEduReg::class;

    protected function rules()
    {
        return [
            'cod_ceta_est' => 'required|integer',
            'id_doc_req' => 'nullable|integer',
            'serie_titulo_tm' => 'nullable|string|max:255',
            'numero_titulo_tm' => 'nullable|string|max:255',
            'fecha_emision' => 'nullable|date',
            'is_active' => 'nullable|boolean',
        ];
    }

    public function deleteByCodCeta(Request $request)
    {
        $data = $request->validate([
            'cod_ceta_est' => 'required|integer',
        ]);
        $cod = $data['cod_ceta_est'];
        DB::table('transitabilidad_edu_reg')->where('cod_ceta_est', $cod)->delete();
        return response()->json(['success' => true]);
    }
}
