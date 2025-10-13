<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PertinenciaAcad;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PertinenciaController extends Controller
{
    // GET /api/pertinencias
    public function index(Request $request)
    {
        $query = PertinenciaAcad::query()->select(['id','nombre_pert','cod_carrera','activo']);
        if ($request->filled('cod_carrera')) {
            $query->where('cod_carrera', $request->get('cod_carrera'));
        }
        if ($request->boolean('solo_activas', false)) {
            $query->where(function($q){ $q->whereNull('activo')->orWhere('activo', true); });
        }
        $items = $query->orderBy('id')->get();

        return response()->json([
            'success' => true,
            'data' => $items,
        ]);
    }

    // GET /api/pertinencias/{id}
    public function show($id)
    {
        $item = PertinenciaAcad::select(['id','nombre_pert','cod_carrera','activo'])->find($id);
        if (!$item) {
            return response()->json(['success' => false, 'message' => 'No encontrado'], 404);
        }
        return response()->json(['success' => true, 'data' => $item]);
    }

    // POST /api/pertinencias
    public function store(Request $request)
    {
        $data = $request->only(['nombre_pert','cod_carrera','activo']);
        $validator = Validator::make($data, [
            'nombre_pert' => 'required|string|max:255',
            'cod_carrera' => 'nullable|string|max:10',
            'activo'      => 'nullable|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Datos inválidos', 'errors' => $validator->errors()], 422);
        }
        if (!array_key_exists('activo', $data)) { $data['activo'] = true; }
        $item = PertinenciaAcad::create($data);
        return response()->json(['success' => true, 'data' => $item], 201);
    }

    // PUT/PATCH /api/pertinencias/{id}
    public function update(Request $request, $id)
    {
        $item = PertinenciaAcad::find($id);
        if (!$item) {
            return response()->json(['success' => false, 'message' => 'No encontrado'], 404);
        }
        $data = $request->only(['nombre_pert','cod_carrera','activo']);
        $validator = Validator::make($data, [
            'nombre_pert' => 'sometimes|required|string|max:255',
            'cod_carrera' => 'sometimes|nullable|string|max:10',
            'activo'      => 'sometimes|boolean',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'message' => 'Datos inválidos', 'errors' => $validator->errors()], 422);
        }
        $item->fill($data);
        $item->save();
        return response()->json(['success' => true, 'data' => $item]);
    }

    // DELETE /api/pertinencias/{id}
    public function destroy($id)
    {
        $item = PertinenciaAcad::find($id);
        if (!$item) {
            return response()->json(['success' => false, 'message' => 'No encontrado'], 404);
        }
        $item->delete();
        return response()->json(['success' => true]);
    }
}
