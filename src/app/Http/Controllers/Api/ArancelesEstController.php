<?php

namespace App\Http\Controllers\Api;

use App\Models\ArancelesEst;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

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

    // Listado filtrado por estudiante y (opcional) por seleccionado
    public function list(Request $request)
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
                'cod_ceta_est',
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
}