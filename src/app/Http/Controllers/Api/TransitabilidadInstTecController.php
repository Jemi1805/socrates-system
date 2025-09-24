<?php

namespace App\Http\Controllers\Api;

use App\Models\TransitabilidadInstTec;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TransitabilidadInstTecController extends CrudController
{
    protected $modelClass = TransitabilidadInstTec::class;

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
        DB::table('transitabilidad_inst_tec')->where('cod_ceta_est', $cod)->delete();
        return response()->json(['success' => true]);
    }
}
