<?php

namespace App\Http\Controllers\Api;

use App\Models\ResHomolCp;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ResHomolCpController extends CrudController
{
    protected $modelClass = ResHomolCp::class;
    
    protected function rules()
    {
        return [
            'cod_ceta_est' => 'nullable|integer',
            'id_doc_req' => 'nullable|integer',
            'nro_res' => 'nullable|string|max:255',
            'grados_cursados' => 'nullable|string|max:255',
            'gestiones_cursadas' => 'nullable|string|max:255',
        ];
    }

    public function upsertByCod(Request $request)
    {
        $data = $request->validate([
            'cod_ceta_est' => 'required|integer',
            'nro_resolucion' => 'nullable|string|max:255',
            'fecha_emision' => 'nullable|date',
            'grados_cursados' => 'nullable|string|max:255',
            'gestiones_cursadas' => 'nullable|string|max:255',
            'observacion' => 'nullable|string',
        ]);
        $payload = [
            'cod_ceta_est' => $data['cod_ceta_est'],
        ];
        if (DB::getSchemaBuilder()->hasColumn('res_homol_cp', 'nro_res')) {
            $payload['nro_res'] = isset($data['nro_resolucion']) ? $data['nro_resolucion'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn('res_homol_cp', 'fecha_emision')) {
            $payload['fecha_emision'] = isset($data['fecha_emision']) ? $data['fecha_emision'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn('res_homol_cp', 'grados_cursados')) {
            $payload['grados_cursados'] = isset($data['grados_cursados']) ? $data['grados_cursados'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn('res_homol_cp', 'gestiones_cursadas')) {
            $payload['gestiones_cursadas'] = isset($data['gestiones_cursadas']) ? $data['gestiones_cursadas'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn('res_homol_cp', 'observacion')) {
            $payload['observacion'] = isset($data['observacion']) ? $data['observacion'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn('res_homol_cp', 'is_active')) {
            $payload['is_active'] = true;
        }
        // Upsert por cod_ceta_est (la tabla puede no tener PK numérica estándar)
        $exists = DB::table('res_homol_cp')->where('cod_ceta_est', $data['cod_ceta_est'])->first();
        if ($exists) {
            DB::table('res_homol_cp')->where('cod_ceta_est', $data['cod_ceta_est'])->update(array_merge($payload, ['updated_at' => now()]));
            $saved = DB::table('res_homol_cp')->where('cod_ceta_est', $data['cod_ceta_est'])->first();
        } else {
            $id = DB::table('res_homol_cp')->insertGetId(array_merge($payload, ['created_at' => now(), 'updated_at' => now()]));
            $saved = DB::table('res_homol_cp')->where('id', $id)->first();
        }
        return response()->json(['success' => true, 'data' => $saved]);
    }

    public function deleteByCodCeta(Request $request)
    {
        $data = $request->validate([
            'cod_ceta_est' => 'required|integer',
        ]);
        $cod = $data['cod_ceta_est'];
        // Borrar grados_homol_cp ligados si existe la tabla
        if (DB::getSchemaBuilder()->hasTable('grados_homol_cp')) {
            $ids = DB::table('res_homol_cp')->where('cod_ceta_est', $cod)->pluck('id')->all();
            if (!empty($ids)) {
                DB::table('grados_homol_cp')->whereIn('homol_cp_id', $ids)->delete();
            }
        }
        DB::table('res_homol_cp')->where('cod_ceta_est', $cod)->delete();
        return response()->json(['success' => true]);
    }
}
