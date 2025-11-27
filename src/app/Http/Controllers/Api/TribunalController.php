<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Tribunal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class TribunalController extends Controller
{
    public function index()
    {
        $rows = Tribunal::query()->orderBy('apellido_p')->orderBy('nombre')->get();

        return response()->json([
            'success' => true,
            'data' => $rows,
        ]);
    }

    public function toggle($id, Request $request)
    {
        $tribunal = Tribunal::findOrFail($id);
        $nuevoEstado = $request->has('activo') ? (bool)$request->boolean('activo') : !$tribunal->activo;
        $tribunal->activo = $nuevoEstado;
        $tribunal->save();

        return response()->json([
            'success' => true,
            'id' => $tribunal->id,
            'activo' => $tribunal->activo,
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->all();

        $validator = Validator::make($data, [
            'nombre' => 'required|string|max:150',
            'apellido_p' => 'required|string|max:150',
            'apellido_m' => 'nullable|string|max:150',
            'ci' => 'required|string|regex:/^\\d{7,8}$/',
            'celular' => 'required|string|regex:/^\\d{8}$/',
            'profesion' => 'required|string|max:255',
            'titulo_academico' => 'required|string|max:10',
            'tipo' => 'nullable|in:interno,externo',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos para tribunal',
                'errors' => $validator->errors(),
            ], 422);
        }

        try {
            $tribunal = Tribunal::create([
                'nombre' => $data['nombre'],
                'apellido_p' => $data['apellido_p'],
                'apellido_m' => $data['apellido_m'] ?? null,
                'ci' => $data['ci'],
                'celular' => $data['celular'],
                'profesion' => $data['profesion'],
                'titulo_academico' => $data['titulo_academico'],
                'tipo' => $data['tipo'] ?? 'externo',
                'activo' => true,
            ]);

            return response()->json([
                'success' => true,
                'data' => $tribunal,
            ]);
        } catch (\Throwable $e) {
            Log::error('Error al registrar tribunal', [
                'exception' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al registrar tribunal',
            ]); 
        }
    }
}
