<?php

namespace App\Http\Controllers\Api;

use App\Models\TraspasosInstituto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TraspasosInstitutoController extends CrudController
{
    protected $modelClass = TraspasosInstituto::class;

    protected function rules()
    {
        return [
            'cod_ceta_est' => 'required|integer',
            'id_doc_req' => 'nullable|integer',
            'instituto_origen' => 'nullable|string|max:255',
            'grados_cursados' => 'nullable|string|max:255',
            'gestiones_cursadas' => 'nullable|string|max:255',
        ];
    }

    public function upsertByCod(Request $request)
    {
        $data = $request->validate([
            'cod_ceta_est' => 'required|integer',
            'instituto_origen' => 'nullable|string|max:255',
            'grados_cursados' => 'nullable|string|max:255',
            'gestiones_cursadas' => 'nullable|string|max:255',
            'observacion' => 'nullable|string',
            'grados_gestiones' => 'nullable|array',
            'grados_gestiones.*.grado' => 'nullable|string|max:255',
            'grados_gestiones.*.gestion' => 'nullable|string|max:50',
        ]);
        // Construir payload únicamente con columnas existentes en la tabla
        $payload = array('cod_ceta_est' => $data['cod_ceta_est']);
        if (DB::getSchemaBuilder()->hasColumn('traspasos_instituto', 'instituto_origen')) {
            $payload['instituto_origen'] = isset($data['instituto_origen']) ? $data['instituto_origen'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn('traspasos_instituto', 'grados_cursados')) {
            $payload['grados_cursados'] = isset($data['grados_cursados']) ? $data['grados_cursados'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn('traspasos_instituto', 'gestiones_cursadas')) {
            $payload['gestiones_cursadas'] = isset($data['gestiones_cursadas']) ? $data['gestiones_cursadas'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn('traspasos_instituto', 'observacion')) {
            $payload['observacion'] = isset($data['observacion']) ? $data['observacion'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn('traspasos_instituto', 'is_active')) {
            $payload['is_active'] = true;
        }
        $saved = TraspasosInstituto::updateOrCreate(['cod_ceta_est' => $data['cod_ceta_est']], $payload);

        // Persistir detalle de grados si existe la tabla y el traspaso
        if ($saved && DB::getSchemaBuilder()->hasTable('grados_trasp')) {
            $traspasoId = isset($saved->id) ? $saved->id : null;
            if ($traspasoId) {
                // Limpiar existentes
                DB::table('grados_trasp')->where('traspaso_id', $traspasoId)->delete();
                $grados = isset($data['grados_gestiones']) && is_array($data['grados_gestiones']) ? $data['grados_gestiones'] : array();
                foreach ($grados as $gt) {
                    $g = isset($gt['grado']) ? $gt['grado'] : null;
                    $gest = isset($gt['gestion']) ? $gt['gestion'] : null;
                    if ($g || $gest) {
                        DB::table('grados_trasp')->insert(array(
                            'traspaso_id' => $traspasoId,
                            'grado' => $g,
                            'gestion' => $gest,
                            'created_at' => now(),
                            'updated_at' => now(),
                        ));
                    }
                }
            }
        }

        return response()->json(['success' => true, 'data' => $saved]);
    }

    public function deleteByCodCeta(Request $request)
    {
        $data = $request->validate([
            'cod_ceta_est' => 'required|integer',
        ]);
        $cod = $data['cod_ceta_est'];
        // Borrar detalle de grados si existe relación por traspaso_id
        if (DB::getSchemaBuilder()->hasTable('grados_trasp')) {
            $ids = DB::table('traspasos_instituto')->where('cod_ceta_est', $cod)->pluck('id')->all();
            if (!empty($ids)) {
                DB::table('grados_trasp')->whereIn('traspaso_id', $ids)->delete();
            }
        }
        DB::table('traspasos_instituto')->where('cod_ceta_est', $cod)->delete();
        return response()->json(['success' => true]);
    }

    public function getByCodCeta(Request $request)
    {
        $cod = $request->query('cod_ceta_est');
        if (!$cod) {
            return response()->json(['error' => 'cod_ceta_est requerido'], 422);
        }
        $trasp = DB::table('traspasos_instituto')->where('cod_ceta_est', $cod)->first();
        if (!$trasp) {
            return response()->json(null);
        }
        $result = (array) $trasp;
        if (DB::getSchemaBuilder()->hasTable('grados_trasp')) {
            $grados = DB::table('grados_trasp')->where('traspaso_id', $trasp->id)->get();
            $result['grados_trasp'] = $grados;
        }
        return response()->json($result);
    }
}
