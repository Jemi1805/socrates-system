<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\CrudController;
use App\Models\DatosCarrera;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DatosCarreraController extends CrudController
{
    protected $modelClass = DatosCarrera::class;

    protected function rules()
    {
        return [
            'cod_ceta_est' => 'required|integer',
            'cod_carrera' => 'nullable|string|max:10',
            'regimen_ini' => 'nullable|string|max:50',
            'regimen_fin' => 'nullable|string|max:50',
            'gestion_ini' => 'nullable|string|max:20',
            'gestion_fin' => 'nullable|string|max:20',
            'is_active' => 'nullable|boolean',
        ];
    }

    // Upsert por cod_ceta_est para facilitar edición desde el FE
    public function upsert(Request $request)
    {
        $data = $this->validateData($request);
        $key = ['cod_ceta_est' => (int) $data['cod_ceta_est']];

        // Resolver cod_carrera si no viene, usando la info del postulante y la tabla carrera
        $resolvedCodCarrera = null;
        if (isset($data['cod_carrera']) && $data['cod_carrera'] !== null && $data['cod_carrera'] !== '') {
            $resolvedCodCarrera = $data['cod_carrera'];
        } else {
            $resolvedCodCarrera = $this->resolveCodCarrera((int)$data['cod_ceta_est']);
        }
        $payload = [
            'cod_carrera' => $resolvedCodCarrera,
            'regimen_ini' => isset($data['regimen_ini']) ? $data['regimen_ini'] : null,
            'regimen_fin' => isset($data['regimen_fin']) ? $data['regimen_fin'] : null,
            'gestion_ini' => isset($data['gestion_ini']) ? $data['gestion_ini'] : null,
            'gestion_fin' => isset($data['gestion_fin']) ? $data['gestion_fin'] : null,
            'is_active' => isset($data['is_active']) ? (bool)$data['is_active'] : true,
        ];
        // Evitar duplicados: si hay fila existente por cod_ceta_est, actualizarla
        $existing = DatosCarrera::where('cod_ceta_est', (int)$data['cod_ceta_est'])->orderByDesc('updated_at')->first();
        if ($existing) {
            $existing->fill($payload);
            $existing->save();
            $model = $existing;
        } else {
            $createData = array_merge($key, $payload);
            $model = DatosCarrera::create($createData);
        }
        return response()->json($model, 200);
    }

    // Intenta resolver el código de carrera (MEA/EEA, etc.) a partir del postulante y la tabla carrera
    private function resolveCodCarrera($codCeta)
    {
        try {
            // 1) Leer valor 'carrera' crudo del postulante
            $raw = DB::table('postulantes')->where('cod_ceta', (int)$codCeta)->value('carrera');
            if ($raw === null) return null;

            $val = trim((string)$raw);
            if ($val === '') return null;

            $upper = strtoupper($val);
            // 2) Si ya es un código conocido y existe en tabla carrera, devolverlo
            if (in_array($upper, ['MEA','EEA'], true)) {
                $exists = DB::table('carrera')->where('cod_carrera', $upper)->exists();
                if ($exists) return $upper;
            }

            // 3) Mapear por palabras clave
            $norm = mb_strtolower($val, 'UTF-8');
            $map = array(
                'mecanica' => 'MEA',
                'mecánica' => 'MEA',
                'mecanica automotriz' => 'MEA',
                'mecánica automotriz' => 'MEA',
                'electricidad' => 'EEA',
                'eléctrica' => 'EEA',
                'electronica' => 'EEA',
                'eléctrónica' => 'EEA',
                'electricidad y electrónica automotriz' => 'EEA',
            );
            if (isset($map[$norm])) {
                $code = $map[$norm];
                $exists = DB::table('carrera')->where('cod_carrera', $code)->exists();
                if ($exists) return $code;
            }

            // 4) Intentar por coincidencia exacta en nombre_carrera (case-insensitive)
            $candidate = DB::table('carrera')
                ->whereRaw('LOWER(nombre_carrera) = ?', array(mb_strtolower($val, 'UTF-8')))
                ->value('cod_carrera');
            if ($candidate) return $candidate;

            // 5) Intentar por LIKE parcial si hay una coincidencia única
            $like = DB::table('carrera')
                ->select('cod_carrera')
                ->where('nombre_carrera', 'LIKE', '%'.$val.'%')
                ->limit(2)
                ->get();
            if ($like && count($like) === 1) {
                $row = (array)$like[0];
                return isset($row['cod_carrera']) ? $row['cod_carrera'] : null;
            }
        } catch (\Throwable $e) {
            // Silenciar y retornar null si falla
        }
        return null;
    }
}
