<?php

namespace App\Http\Controllers\Api;

use App\Models\ArancelesEst;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

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
            // Campos adicionales usados por el front para registro manual
            'seleccionado' => 'nullable|boolean',
            'origen' => 'nullable|string|max:50',
            'gestion' => 'nullable|string|max:20',
            'fecha' => 'nullable|date',
            'num_factura' => 'nullable|string|max:50',
            'num_comprobante' => 'nullable|string|max:50',
            'razon' => 'nullable|string|max:255',
            'nit' => 'nullable|string|max:50',
            'inscrip_modalidad_id' => 'nullable|integer',
        ];
    }

    // Listado filtrado por estudiante y (opcional) por seleccionado
    public function listar(Request $request)
    {
        try {
            $cod = $request->query('cod_ceta_est', $request->query('cod_ceta'));
            $seleccionado = $request->query('seleccionado');

            $query = ArancelesEst::query();

            // Si no hay código, devolver lista vacía (no lanzar 500)
            if ($cod === null || $cod === '') {
                return response()->json(['success' => true, 'data' => [], 'total' => 0]);
            }

            // Ajusta el nombre de columna si tu tabla tiene otro nombre
            $query->where('cod_ceta_est', $cod);

            if ($seleccionado !== null) {
                $val = (string) $seleccionado;
                $flag = in_array($val, ['1', 'true', 'TRUE'], true) ? 1 : 0;
                $query->where('seleccionado', $flag);
            }

            $rows = $query->get([
                'id',
                'cod_ceta_est',
                'inscrip_modalidad_id',
                'concepto',
                'monto',
                'pagado',
                'fecha_pago',
                'seleccionado',
                'origen',
                'gestion',
                'fecha',
                'num_factura',
                'num_comprobante',
                'razon',
                'nit',
            ]);

            return response()->json([
                'success' => true,
                'data' => $rows,
                'total' => $rows->count(),
            ]);
        } catch (\Throwable $e) {
            Log::error('[ArancelesEstController@list] Error', [
                'error' => $e->getMessage(),
            ]);
            return response()->json(['success' => false, 'message' => 'Error al listar aranceles', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * Upsert por código CETA y clave fuerte del arancel.
     * Coincide por:
     *  1) num_factura (si no vacío/"0")
     *  2) num_comprobante (si no vacío/"0")
     *  3) composite (fecha, concepto, monto)
     * Además, si viene inscrip_modalidad_id, se usa para acotar la búsqueda.
     */
    public function upsertByCod(Request $request)
    {
        try {
            $data = $request->all();
            $cod = isset($data['cod_ceta_est']) ? $data['cod_ceta_est'] : null;
            if ($cod === null || $cod === '') {
                return response()->json(['success' => false, 'message' => 'cod_ceta_est requerido'], 422);
            }

            // Construir payload permitido
            $payload = [];
            $cols = [
                'cod_ceta_est','concepto','monto','pagado','fecha_pago','seleccionado','origen','gestion','fecha',
                'num_factura','num_comprobante','razon','nit','inscrip_modalidad_id'
            ];
            foreach ($cols as $c) {
                if ($request->has($c)) {
                    $payload[$c] = $data[$c];
                }
            }

            // Resolver inscrip_modalidad_id si no viene
            if (empty($payload['inscrip_modalidad_id'])) {
                $inscId = DB::table('inscrip_modalidad')
                    ->where('cod_ceta_est', $cod)
                    ->orderByDesc('id')
                    ->value('id');
                if ($inscId) {
                    $payload['inscrip_modalidad_id'] = $inscId;
                }
            }

            $base = DB::table('aranceles_est')->where('cod_ceta_est', $cod);

            // Resolver clave fuerte usando prev_* si están presentes
            $prev_nf = isset($data['prev_num_factura']) ? trim((string)$data['prev_num_factura']) : '';
            $prev_nc = isset($data['prev_num_comprobante']) ? trim((string)$data['prev_num_comprobante']) : '';
            $prev_fecha = array_key_exists('prev_fecha', $data) ? $data['prev_fecha'] : null;
            $prev_concepto = array_key_exists('prev_concepto', $data) ? $data['prev_concepto'] : null;
            $prev_monto = array_key_exists('prev_monto', $data) ? $data['prev_monto'] : null;

            $nf = isset($payload['num_factura']) ? trim((string)$payload['num_factura']) : '';
            $nc = isset($payload['num_comprobante']) ? trim((string)$payload['num_comprobante']) : '';
            $fecha = array_key_exists('fecha', $payload) ? $payload['fecha'] : null;
            $concepto = array_key_exists('concepto', $payload) ? $payload['concepto'] : null;
            $monto = array_key_exists('monto', $payload) ? $payload['monto'] : null;

            $q = clone $base;
            if ($prev_nf !== '' && $prev_nf !== '0') {
                $q->where('num_factura', $prev_nf);
            } elseif ($prev_nc !== '' && $prev_nc !== '0') {
                $q->where('num_comprobante', $prev_nc);
            } elseif ($prev_fecha !== null || $prev_concepto !== null || $prev_monto !== null) {
                if ($prev_fecha !== null) $q->where('fecha', $prev_fecha);
                if ($prev_concepto !== null) $q->where('concepto', $prev_concepto);
                if ($prev_monto !== null) $q->where('monto', $prev_monto);
            } else {
                // Sin prev_*, usar los valores actuales como antes
                if ($nf !== '' && $nf !== '0') {
                    $q->where('num_factura', $nf);
                } elseif ($nc !== '' && $nc !== '0') {
                    $q->where('num_comprobante', $nc);
                } else {
                    if ($fecha !== null) $q->where('fecha', $fecha);
                    if ($concepto !== null) $q->where('concepto', $concepto);
                    if ($monto !== null) $q->where('monto', $monto);
                }
            }

            $exists = $q->first();
            if ($exists) {
                DB::table('aranceles_est')->where('id', $exists->id)->update(array_merge($payload, ['updated_at' => now()]));
                $saved = DB::table('aranceles_est')->where('id', $exists->id)->first();
                return response()->json($saved);
            } else {
                $id = DB::table('aranceles_est')->insertGetId(array_merge($payload, ['created_at' => now(), 'updated_at' => now()]));
                $saved = DB::table('aranceles_est')->where('id', $id)->first();
                return response()->json($saved, 201);
            }
        } catch (\Throwable $e) {
            Log::error('[ArancelesEstController@upsertByCod] Error', [ 'error' => $e->getMessage() ]);
            return response()->json(['success' => false, 'message' => 'Error al guardar arancel', 'error' => $e->getMessage()], 500);
        }
    }
}