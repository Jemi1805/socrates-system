<?php

namespace App\Http\Controllers\Api;

use App\Models\DiplomaBachiller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class DiplomaBachillerController extends CrudController
{
    protected $modelClass = DiplomaBachiller::class;
    
    protected function rules()
    {
        return [
            'cod_ceta_est' => 'required|integer',
            'tipo_bachiller' => 'required|in:nacional,extranjero',
            // Nacional
            'nro_serie_titulo' => 'nullable|string|max:255',
            'emision' => 'nullable|string|max:255',
            'fecha_emision' => 'nullable|date',
            'observacion' => 'nullable|string',
            'gestion_bachillerato' => 'nullable',
            // Extranjero
            'nro_resolucion' => 'nullable|string|max:255',
            'fecha_resolucion' => 'nullable|date',
            // General
            'is_active' => 'nullable|boolean',
        ];
    }

    /**
     * Normaliza series/resoluciones a MAYÚSCULAS y caracteres permitidos
     */
    private function sanitizeSerie($v)
    {
        if ($v === null) return null;
        $v = strtoupper($v);
        return preg_replace('/[^A-Z0-9\-\"°\s]+/u', '', $v);
    }

    /**
     * Upsert por cod_ceta_est (y aplica tipo específico para mapear campos)
     */
    public function upsert(Request $request)
    {
        $data = $request->validate($this->rules());
        $cod = $data['cod_ceta_est'];
        $tipo = strtolower($data['tipo_bachiller']);

        $payload = [
            'tipo_bachiller' => ucfirst($tipo),
            'is_active' => isset($data['is_active']) ? $data['is_active'] : true,
        ];

        if ($tipo === 'nacional') {
            if (isset($data['nro_serie_titulo']) && Schema::hasColumn('diploma_bachiller', 'nro_serie_titulo')) {
                $payload['nro_serie_titulo'] = $this->sanitizeSerie($data['nro_serie_titulo']);
            }
            if (isset($data['emision']) && Schema::hasColumn('diploma_bachiller', 'emision')) {
                $payload['emision'] = $data['emision'];
            }
            if (isset($data['fecha_emision']) && Schema::hasColumn('diploma_bachiller', 'fecha_emision')) {
                $payload['fecha_emision'] = $data['fecha_emision'];
            }
            if (isset($data['observacion']) && Schema::hasColumn('diploma_bachiller', 'observacion')) {
                $payload['observacion'] = $data['observacion'];
            }
            if (isset($data['gestion_bachillerato']) && Schema::hasColumn('diploma_bachiller', 'gestion_bachillerato')) {
                $payload['gestion_bachillerato'] = $data['gestion_bachillerato'];
            }
            // Limpiar campos de extranjero si existen en la tabla
            if (Schema::hasColumn('diploma_bachiller', 'nro_resolucion')) $payload['nro_resolucion'] = null;
            if (Schema::hasColumn('diploma_bachiller', 'fecha_resolucion')) $payload['fecha_resolucion'] = null;
        } elseif ($tipo === 'extranjero') {
            if (isset($data['nro_resolucion']) && Schema::hasColumn('diploma_bachiller', 'nro_resolucion')) {
                $payload['nro_resolucion'] = $this->sanitizeSerie($data['nro_resolucion']);
            }
            if (isset($data['fecha_resolucion']) && Schema::hasColumn('diploma_bachiller', 'fecha_resolucion')) {
                $payload['fecha_resolucion'] = $data['fecha_resolucion'];
            }
            // Limpiar campos de nacional si existen en la tabla
            if (Schema::hasColumn('diploma_bachiller', 'nro_serie_titulo')) $payload['nro_serie_titulo'] = null;
            if (Schema::hasColumn('diploma_bachiller', 'emision')) $payload['emision'] = null;
            if (Schema::hasColumn('diploma_bachiller', 'fecha_emision')) $payload['fecha_emision'] = null;
            if (Schema::hasColumn('diploma_bachiller', 'observacion')) $payload['observacion'] = null;
            if (Schema::hasColumn('diploma_bachiller', 'gestion_bachillerato')) $payload['gestion_bachillerato'] = null;
        }

        $saved = DiplomaBachiller::updateOrCreate(
            ['cod_ceta_est' => $cod],
            $payload
        );

        return response()->json([
            'success' => true,
            'data' => $saved,
        ]);
    }
}
