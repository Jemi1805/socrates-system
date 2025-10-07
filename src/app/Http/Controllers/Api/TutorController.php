<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use App\Models\Docente;
use App\Models\Tutor;
use App\Models\PertinenciaAcad;

class TutorController extends Controller
{
    /**
     * Listar tutores registrados.
     * Filtros opcionales: ?carrera=MEA|EEA|Nombre, ?gestion=1/YYYY|2/YYYY
     */
    public function index(Request $request)
    {
        $carrera = $request->query('carrera');
        $gestion = $request->query('gestion');

        $query = Tutor::query()
            ->leftJoin('carrera', 'tutores.cod_carrera', '=', 'carrera.cod_carrera')
            ->select('tutores.*', 'carrera.nombre_carrera as carrera_nom');

        if ($carrera) {
            $c = trim(strtolower($carrera));
            $cod = null;
            if (strlen($carrera) <= 3) {
                $cod = strtoupper($carrera);
            } elseif ($c === 'mecanica' || $c === 'mecánica' || strpos($c, 'automotriz') !== false) {
                $cod = 'MEA';
            } elseif ($c === 'electricidad' || strpos($c, 'electr') !== false) {
                $cod = 'EEA';
            }

            if ($cod) {
                $query->where('tutores.cod_carrera', $cod);
            } else {
                $query->where('carrera.nombre_carrera', 'like', "%$carrera%");
            }
        }

        if ($gestion) {
            $query->where('tutores.gestion_registro', $gestion);
        }

        $rows = $query->orderBy('tutores.nombre')->get();

        $data = $rows->map(function ($t) {
            return [
                'id' => $t->id,
                'nombre' => $t->nombre,
                'apellido_p' => $t->apellido_p,
                'apellido_m' => $t->apellido_m,
                'celular' => $t->celular,
                'ci' => $t->ci,
                'cod_carrera' => $t->cod_carrera,
                'carrera' => $t->carrera_nom,
                'pertinencia_acad_id' => $t->pertinencia_acad_id,
                'pertinencia' => $t->pertinencia_nom,
                'gestion_registro' => $t->gestion_registro,
                'activo' => (bool)$t->activo,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'total' => $data->count(),
        ]);
    }
    /**
     * Registrar tutores en lote a partir de docentes seleccionados.
     * Espera payload: { items: [{ ci, nombre, apellido_p, apellido_m, celular, profesion?, cod_carrera?, pertinencia_acad_id?, pertinencia? }] }
     */
    public function registerBulk(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.ci' => 'required|string|max:50',
            'items.*.nombre' => 'required|string|max:150',
            'items.*.apellido_p' => 'nullable|string|max:150',
            'items.*.apellido_m' => 'nullable|string|max:150',
            'items.*.celular' => 'required|string|max:50',
            'items.*.profesion' => 'nullable|string|max:255',
            'items.*.cod_carrera' => 'nullable|string|max:10',
            'items.*.pertinencia_acad_id' => 'nullable|integer|exists:pertinencia_acad,id',
            'items.*.pertinencia' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $items = $validator->validated()['items'];

        $now = Carbon::now();
        $gestion = ($now->month >= 7) ? ('2/' . $now->year) : ('1/' . $now->year);

        $created = 0; $updated = 0;
        $result = [];

        DB::beginTransaction();
        try {
            foreach ($items as $i) {
                $ci = trim((string)$i['ci']);
                $docData = [
                    'nombre' => $i['nombre'] ?? null,
                    'apellido_p' => $i['apellido_p'] ?? null,
                    'apellido_m' => $i['apellido_m'] ?? null,
                    'celular' => $i['celular'] ?? null,
                    'profesion' => $i['profesion'] ?? null,
                    'pertinencia_acad_id' => $i['pertinencia_acad_id'] ?? null,
                    'cod_carrera' => $i['cod_carrera'] ?? null,
                    'activo' => true,
                ];
                $doc = Docente::updateOrCreate(['ci' => $ci], $docData);

                // Resolver nombre de pertinencia
                $pertNom = $i['pertinencia'] ?? null;
                if (($i['pertinencia_acad_id'] ?? null) && !$pertNom) {
                    $p = PertinenciaAcad::find($i['pertinencia_acad_id']);
                    if ($p) $pertNom = $p->nombre_pert;
                }

                $snap = [
                    'activo' => true,
                    'nombre' => $i['nombre'] ?? null,
                    'apellido_p' => $i['apellido_p'] ?? null,
                    'apellido_m' => $i['apellido_m'] ?? null,
                    'celular' => $i['celular'] ?? null,
                    'cod_carrera' => $i['cod_carrera'] ?? null,
                    'ci' => $ci,
                    'pertinencia_acad_id' => $i['pertinencia_acad_id'] ?? null,
                    'pertinencia_nom' => $pertNom,
                    'gestion_registro' => $gestion,
                ];

                $existing = Tutor::where('docente_id', $doc->id)->first();
                if ($existing) {
                    $existing->fill($snap);
                    $existing->save();
                    $updated++;
                    $tutor = $existing;
                } else {
                    $tutor = Tutor::create(array_merge(['docente_id' => $doc->id], $snap));
                    $created++;
                }

                $result[] = $tutor->toArray();
            }

            DB::commit();
            return response()->json([
                'success' => true,
                'message' => 'Tutores registrados correctamente',
                'data' => $result,
                'counts' => [ 'created' => $created, 'updated' => $updated ],
                'gestion' => $gestion,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar tutores',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
