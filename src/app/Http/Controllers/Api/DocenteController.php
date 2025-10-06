<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Models\Docente;

class DocenteController extends Controller
{
    /**
     * Listar docentes locales con filtro opcional de carrera.
     */
    public function index(Request $request)
    {
        $carrera = $request->query('carrera');
        $codCarr = null;
        if ($carrera) {
            $c = strtolower(trim($carrera));
            if ($c === 'mecanica' || $c === 'mecánica' || $c === 'mea') {
                $codCarr = 'MEA';
            } elseif ($c === 'electricidad' || $c === 'eea' || strpos($c, 'electr') !== false) {
                $codCarr = 'EEA';
            } elseif (strlen($carrera) <= 3) {
                $codCarr = strtoupper($carrera);
            }
        }

        $query = Docente::query()->with(['pertinenciaAcad', 'carrera']);
        if ($codCarr) {
            $query->where('cod_carrera', $codCarr);
        }
        $rows = $query->orderBy('nombre')->get();

        $data = $rows->map(function ($d) {
            return [
                'nombre' => $d->nombre,
                'apellido_p' => $d->apellido_p,
                'apellido_m' => $d->apellido_m,
                'ci' => $d->ci,
                'profesion' => $d->profesion,
                'celular' => $d->celular,
                'pertinencia' => $d->pertinenciaAcad ? $d->pertinenciaAcad->nombre_pert : null,
                'pertinencia_acad_id' => $d->pertinencia_acad_id,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
    /**
     * Upsert de docente por CI.
     * Crea o actualiza el registro en base al campo 'ci'.
     */
    public function upsertByCi(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ci' => 'required|string|max:50',
            'nombre' => 'required|string|max:150',
            'apellido_p' => 'nullable|string|max:150',
            'apellido_m' => 'nullable|string|max:150',
            'profesion' => 'nullable|string|max:255',
            'celular' => 'nullable|string|max:50',
            'pertinencia_acad_id' => 'nullable|integer|exists:pertinencia_acad,id',
            'cod_carrera' => 'nullable|string|exists:carrera,cod_carrera',
            'activo' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $payload = $validator->validated();

        $data = [
            'nombre' => null,
            'apellido_p' => null,
            'apellido_m' => null,
            'profesion' => null,
            'celular' => null,
            'pertinencia_acad_id' => null,
            'cod_carrera' => null,
            'activo' => true,
        ];
        if (array_key_exists('nombre', $payload)) $data['nombre'] = $payload['nombre'];
        if (array_key_exists('apellido_p', $payload)) $data['apellido_p'] = $payload['apellido_p'];
        if (array_key_exists('apellido_m', $payload)) $data['apellido_m'] = $payload['apellido_m'];
        if (array_key_exists('profesion', $payload)) $data['profesion'] = $payload['profesion'];
        if (array_key_exists('celular', $payload)) $data['celular'] = $payload['celular'];
        if (array_key_exists('pertinencia_acad_id', $payload)) $data['pertinencia_acad_id'] = $payload['pertinencia_acad_id'];
        if (array_key_exists('cod_carrera', $payload)) $data['cod_carrera'] = $payload['cod_carrera'];
        if (array_key_exists('activo', $payload)) $data['activo'] = (bool)$payload['activo'];

        $docente = Docente::updateOrCreate(
            ['ci' => $payload['ci']],
            $data
        );

        return response()->json([
            'success' => true,
            'data' => $docente->fresh(['pertinenciaAcad', 'carrera']),
            'message' => 'Docente guardado correctamente',
        ]);
    }
}
