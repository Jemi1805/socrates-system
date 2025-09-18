<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\CrudController;
use App\Models\DatosCarrera;
use Illuminate\Http\Request;

class DatosCarreraController extends CrudController
{
    protected $modelClass = DatosCarrera::class;

    protected function rules()
    {
        return [
            'cod_ceta_est' => 'required|integer',
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
        $payload = [
            'regimen_ini' => $data['regimen_ini'] ?? null,
            'regimen_fin' => $data['regimen_fin'] ?? null,
            'gestion_ini' => $data['gestion_ini'] ?? null,
            'gestion_fin' => $data['gestion_fin'] ?? null,
            'is_active' => isset($data['is_active']) ? (bool)$data['is_active'] : true,
        ];
        $model = DatosCarrera::updateOrCreate($key, $payload);
        return response()->json($model, 200);
    }
}
