<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use App\Models\Docente;
use App\Models\Tutor;
use App\Models\PertinenciaAcad;

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
                'id' => $d->id,
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
            'id' => 'nullable|integer|exists:docentes,id',
            'ci' => 'required|string|max:50',
            'ci_original' => 'nullable|string|max:50',
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

        // Construir data parcial (solo campos presentes) y normalizar CI
        $data = [];
        if (array_key_exists('nombre', $payload)) $data['nombre'] = $payload['nombre'];
        if (array_key_exists('apellido_p', $payload)) $data['apellido_p'] = $payload['apellido_p'];
        if (array_key_exists('apellido_m', $payload)) $data['apellido_m'] = $payload['apellido_m'];
        if (array_key_exists('profesion', $payload)) $data['profesion'] = $payload['profesion'];
        if (array_key_exists('celular', $payload)) $data['celular'] = $payload['celular'];
        if (array_key_exists('pertinencia_acad_id', $payload)) $data['pertinencia_acad_id'] = $payload['pertinencia_acad_id'];
        if (array_key_exists('cod_carrera', $payload)) $data['cod_carrera'] = $payload['cod_carrera'];
        if (array_key_exists('activo', $payload)) $data['activo'] = (bool)$payload['activo'];

        $ciOriginal = $request->input('ci_original');
        $ciOriginalNorm = $ciOriginal ? strtoupper(trim((string)$ciOriginal)) : null;
        $newCi = strtoupper(trim((string)$payload['ci']));
        // Actualizar por ID si se envía (no crear uno nuevo)
        if (array_key_exists('id', $payload) && $payload['id']) {
            return DB::transaction(function () use ($payload, $data, $newCi) {
                $docente = Docente::find($payload['id']);
                // Sincronizar datos y CI nuevo
                foreach ($data as $k => $v) { $docente->{$k} = $v; }
                $docente->ci = $newCi;
                $docente->save();

                // Sincronizar snapshot en tutores (si existe)
                $tutor = Tutor::where('docente_id', $docente->id)->first();
                if ($tutor) {
                    $snap = [ 'ci' => $docente->ci ];
                    if (array_key_exists('nombre', $payload)) $snap['nombre'] = $docente->nombre;
                    if (array_key_exists('apellido_p', $payload)) $snap['apellido_p'] = $docente->apellido_p;
                    if (array_key_exists('apellido_m', $payload)) $snap['apellido_m'] = $docente->apellido_m;
                    if (array_key_exists('celular', $payload)) $snap['celular'] = $docente->celular;
                    if (array_key_exists('cod_carrera', $payload)) $snap['cod_carrera'] = $docente->cod_carrera;
                    if (array_key_exists('pertinencia_acad_id', $payload)) {
                        $snap['pertinencia_acad_id'] = $docente->pertinencia_acad_id;
                        $p = $docente->pertinenciaAcad()->first();
                        $snap['pertinencia_nom'] = $p ? $p->nombre_pert : null;
                    }
                    if (array_key_exists('activo', $payload)) $snap['activo'] = (bool)$docente->activo;
                    $tutor->fill($snap);
                    $tutor->save();
                }

                return response()->json([
                    'success' => true,
                    'data' => $docente->fresh(['pertinenciaAcad', 'carrera']),
                    'message' => 'Docente actualizado correctamente',
                ]);
            });
        }

        // Si se provee ci_original normalizado y difiere, actualizar ese registro incluyendo el cambio de CI
        if ($ciOriginalNorm && $ciOriginalNorm !== $newCi) {
            $docente = Docente::whereRaw('TRIM(UPPER(ci)) = ?', [$ciOriginalNorm])->first();
            if ($docente) {
                return DB::transaction(function () use ($docente, $data, $newCi, $payload) {
                    $docente->ci = $newCi;
                    foreach ($data as $k => $v) { $docente->{$k} = $v; }
                    $docente->save();

                    // Sincronizar snapshot en tutores (si existe)
                    $tutor = Tutor::where('docente_id', $docente->id)->first();
                    if ($tutor) {
                        $snap = [ 'ci' => $docente->ci ];
                        if (array_key_exists('nombre', $payload)) $snap['nombre'] = $docente->nombre;
                        if (array_key_exists('apellido_p', $payload)) $snap['apellido_p'] = $docente->apellido_p;
                        if (array_key_exists('apellido_m', $payload)) $snap['apellido_m'] = $docente->apellido_m;
                        if (array_key_exists('celular', $payload)) $snap['celular'] = $docente->celular;
                        if (array_key_exists('cod_carrera', $payload)) $snap['cod_carrera'] = $docente->cod_carrera;
                        if (array_key_exists('pertinencia_acad_id', $payload)) {
                            $snap['pertinencia_acad_id'] = $docente->pertinencia_acad_id;
                            $p = $docente->pertinenciaAcad()->first();
                            $snap['pertinencia_nom'] = $p ? $p->nombre_pert : null;
                        }
                        if (array_key_exists('activo', $payload)) $snap['activo'] = (bool)$docente->activo;
                        $tutor->fill($snap);
                        $tutor->save();
                    }

                    return response()->json([
                        'success' => true,
                        'data' => $docente->fresh(['pertinenciaAcad', 'carrera']),
                        'message' => 'Docente actualizado correctamente',
                    ]);
                });
            }
            // si no se encuentra por ci_original, continuar con upsert por ci normalizado
        }

        // Buscar por CI nuevo normalizado; actualizar si existe, crear si no
        $docente = Docente::whereRaw('TRIM(UPPER(ci)) = ?', [$newCi])->first();
        if ($docente) {
            return DB::transaction(function () use ($docente, $data, $newCi, $payload) {
                foreach ($data as $k => $v) { $docente->{$k} = $v; }
                // asegurar normalización de CI
                $docente->ci = $newCi;
                $docente->save();

                // Sincronizar snapshot en tutores (si existe)
                $tutor = Tutor::where('docente_id', $docente->id)->first();
                if ($tutor) {
                    $snap = [ 'ci' => $docente->ci ];
                    if (array_key_exists('nombre', $payload)) $snap['nombre'] = $docente->nombre;
                    if (array_key_exists('apellido_p', $payload)) $snap['apellido_p'] = $docente->apellido_p;
                    if (array_key_exists('apellido_m', $payload)) $snap['apellido_m'] = $docente->apellido_m;
                    if (array_key_exists('celular', $payload)) $snap['celular'] = $docente->celular;
                    if (array_key_exists('cod_carrera', $payload)) $snap['cod_carrera'] = $docente->cod_carrera;
                    if (array_key_exists('pertinencia_acad_id', $payload)) {
                        $snap['pertinencia_acad_id'] = $docente->pertinencia_acad_id;
                        $p = $docente->pertinenciaAcad()->first();
                        $snap['pertinencia_nom'] = $p ? $p->nombre_pert : null;
                    }
                    if (array_key_exists('activo', $payload)) $snap['activo'] = (bool)$docente->activo;
                    $tutor->fill($snap);
                    $tutor->save();
                }

                return response()->json([
                    'success' => true,
                    'data' => $docente->fresh(['pertinenciaAcad', 'carrera']),
                    'message' => 'Docente actualizado correctamente',
                ]);
            });
        } else {
            // Crear nuevo docente (caso explícito)
            $docente = Docente::create(array_merge(['ci' => $newCi], $data));
        }

        return response()->json([
            'success' => true,
            'data' => $docente->fresh(['pertinenciaAcad', 'carrera']),
            'message' => 'Docente guardado correctamente',
        ]);
    }

    /**
     * Actualizar un docente por ID y sincronizar snapshot en tutores.
     */
    public function update(Request $request, $id)
    {
        $docente = Docente::find($id);
        if (!$docente) {
            return response()->json([
                'success' => false,
                'message' => 'Docente no encontrado',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'ci' => ['nullable', 'string', 'max:50', Rule::unique('docentes', 'ci')->ignore($docente->id)],
            'nombre' => 'nullable|string|max:150',
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

        return DB::transaction(function () use ($payload, $docente) {
            // Actualizar Docente (solo campos presentes)
            $data = [];
            if (array_key_exists('ci', $payload)) $data['ci'] = $payload['ci'];
            if (array_key_exists('nombre', $payload)) $data['nombre'] = $payload['nombre'];
            if (array_key_exists('apellido_p', $payload)) $data['apellido_p'] = $payload['apellido_p'];
            if (array_key_exists('apellido_m', $payload)) $data['apellido_m'] = $payload['apellido_m'];
            if (array_key_exists('profesion', $payload)) $data['profesion'] = $payload['profesion'];
            if (array_key_exists('celular', $payload)) $data['celular'] = $payload['celular'];
            if (array_key_exists('pertinencia_acad_id', $payload)) $data['pertinencia_acad_id'] = $payload['pertinencia_acad_id'];
            if (array_key_exists('cod_carrera', $payload)) $data['cod_carrera'] = $payload['cod_carrera'];
            if (array_key_exists('activo', $payload)) $data['activo'] = (bool)$payload['activo'];

            $docente->fill($data);
            $docente->save();

            // Sincronizar snapshot en tutores (si existe)
            $tutor = Tutor::where('docente_id', $docente->id)->first();
            if ($tutor) {
                $snap = [];
                // CI siempre sincronizado con el docente
                $snap['ci'] = $docente->ci;
                if (array_key_exists('nombre', $payload)) $snap['nombre'] = $docente->nombre;
                if (array_key_exists('apellido_p', $payload)) $snap['apellido_p'] = $docente->apellido_p;
                if (array_key_exists('apellido_m', $payload)) $snap['apellido_m'] = $docente->apellido_m;
                if (array_key_exists('celular', $payload)) $snap['celular'] = $docente->celular;
                if (array_key_exists('cod_carrera', $payload)) $snap['cod_carrera'] = $docente->cod_carrera;
                if (array_key_exists('pertinencia_acad_id', $payload)) {
                    $snap['pertinencia_acad_id'] = $docente->pertinencia_acad_id;
                    $p = $docente->pertinenciaAcad()->first();
                    $snap['pertinencia_nom'] = $p ? $p->nombre_pert : null;
                }
                if (array_key_exists('activo', $payload)) $snap['activo'] = (bool)$docente->activo;

                $tutor->fill($snap);
                $tutor->save();
            }

            return response()->json([
                'success' => true,
                'data' => $docente->fresh(['pertinenciaAcad', 'carrera']),
                'message' => 'Docente actualizado correctamente',
            ]);
        });
    }
}
