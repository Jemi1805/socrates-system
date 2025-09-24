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
            'grados_gestiones' => 'nullable|array',
            'grados_gestiones.*.grado' => 'nullable|string|max:255',
            'grados_gestiones.*.gestion' => 'nullable|string|max:50',
        ]);
        // Determinar tabla principal disponible
        $tbl = null;
        if (DB::getSchemaBuilder()->hasTable('res_homol_cp')) {
            $tbl = 'res_homol_cp';
        } elseif (DB::getSchemaBuilder()->hasTable('homologacion_cambio_plan')) {
            $tbl = 'homologacion_cambio_plan';
        } else {
            return response()->json(['success' => true, 'data' => null, 'notice' => 'homologacion table not found (noop)']);
        }

        // Armar payload según columnas disponibles en la tabla seleccionada
        $payload = ['cod_ceta_est' => $data['cod_ceta_est']];
        if (DB::getSchemaBuilder()->hasColumn($tbl, 'nro_res')) {
            $payload['nro_res'] = isset($data['nro_resolucion']) ? $data['nro_resolucion'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn($tbl, 'nro_resolucion')) {
            $payload['nro_resolucion'] = isset($data['nro_resolucion']) ? $data['nro_resolucion'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn($tbl, 'nro_resolucion_rectoral')) {
            $payload['nro_resolucion_rectoral'] = isset($data['nro_resolucion']) ? $data['nro_resolucion'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn($tbl, 'fecha_emision')) {
            $payload['fecha_emision'] = isset($data['fecha_emision']) ? $data['fecha_emision'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn($tbl, 'grados_cursados')) {
            $payload['grados_cursados'] = isset($data['grados_cursados']) ? $data['grados_cursados'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn($tbl, 'gestiones_cursadas')) {
            $payload['gestiones_cursadas'] = isset($data['gestiones_cursadas']) ? $data['gestiones_cursadas'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn($tbl, 'observacion')) {
            $payload['observacion'] = isset($data['observacion']) ? $data['observacion'] : null;
        }
        if (DB::getSchemaBuilder()->hasColumn($tbl, 'is_active')) {
            $payload['is_active'] = true;
        }

        // Upsert por cod_ceta_est
        $builder = DB::table($tbl);
        $exists = $builder->where('cod_ceta_est', $data['cod_ceta_est'])->first();
        if ($exists) {
            $builder->where('cod_ceta_est', $data['cod_ceta_est'])->update(array_merge($payload, ['updated_at' => now()]));
            $saved = $builder->where('cod_ceta_est', $data['cod_ceta_est'])->first();
            $id = isset($saved->id) ? $saved->id : null;
        } else {
            $id = $builder->insertGetId(array_merge($payload, ['created_at' => now(), 'updated_at' => now()]));
            $saved = $builder->where('id', $id)->first();
        }

        // Guardar detalle de grados si hay tabla disponible
        $gradosTbl = null;
        if (DB::getSchemaBuilder()->hasTable('grados_homol_cp')) {
            $gradosTbl = 'grados_homol_cp';
        } elseif (DB::getSchemaBuilder()->hasTable('grados_homologacion_cp')) {
            $gradosTbl = 'grados_homologacion_cp';
        }
        if ($gradosTbl && $id) {
            // Detectar columna FK disponible
            $fkCol = null;
            foreach (['homol_cp_id', 'homologacion_cp_id', 'homologacion_cambio_plan_id'] as $cand) {
                if (DB::getSchemaBuilder()->hasColumn($gradosTbl, $cand)) { $fkCol = $cand; break; }
            }
            if ($fkCol) {
                // Limpiar existentes y reinsertar
                DB::table($gradosTbl)->where($fkCol, $id)->delete();
                $grados = (isset($data['grados_gestiones']) && is_array($data['grados_gestiones'])) ? $data['grados_gestiones'] : [];
                foreach ($grados as $gt) {
                    $row = [
                        $fkCol => $id,
                    ];
                    if (DB::getSchemaBuilder()->hasColumn($gradosTbl, 'grado')) {
                        $row['grado'] = isset($gt['grado']) ? $gt['grado'] : null;
                    }
                    if (DB::getSchemaBuilder()->hasColumn($gradosTbl, 'gestion')) {
                        $row['gestion'] = isset($gt['gestion']) ? $gt['gestion'] : null;
                    }
                    $row['created_at'] = now();
                    $row['updated_at'] = now();
                    DB::table($gradosTbl)->insert($row);
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
        // Seleccionar tabla principal disponible
        $tbl = null;
        if (DB::getSchemaBuilder()->hasTable('res_homol_cp')) {
            $tbl = 'res_homol_cp';
        } elseif (DB::getSchemaBuilder()->hasTable('homologacion_cambio_plan')) {
            $tbl = 'homologacion_cambio_plan';
        } else {
            return response()->json(['success' => true]);
        }
        // Borrar grados ligados si existe tabla y FK
        $ids = DB::table($tbl)->where('cod_ceta_est', $cod)->pluck('id')->all();
        $gradosTbl = null;
        if (DB::getSchemaBuilder()->hasTable('grados_homol_cp')) {
            $gradosTbl = 'grados_homol_cp';
        } elseif (DB::getSchemaBuilder()->hasTable('grados_homologacion_cp')) {
            $gradosTbl = 'grados_homologacion_cp';
        }
        if (!empty($ids) && $gradosTbl) {
            $fkCol = null;
            foreach (['homol_cp_id', 'homologacion_cp_id', 'homologacion_cambio_plan_id'] as $cand) {
                if (DB::getSchemaBuilder()->hasColumn($gradosTbl, $cand)) { $fkCol = $cand; break; }
            }
            if ($fkCol) {
                DB::table($gradosTbl)->whereIn($fkCol, $ids)->delete();
            }
        }
        DB::table($tbl)->where('cod_ceta_est', $cod)->delete();
        return response()->json(['success' => true]);
    }
}
