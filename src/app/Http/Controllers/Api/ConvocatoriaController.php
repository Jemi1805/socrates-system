<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Convocatoria;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ConvocatoriaController extends Controller
{
    private function validationRules($isCreate = true)
    {
        $maxYear = date('Y') + 5;

        if ($isCreate) {
            return [
                'anio' => 'nullable|integer|min:2000|max:' . $maxYear,
                'numero_convocatoria' => 'nullable|integer|min:1|max:999',
                'nombre' => 'required|string|max:30',
                'fecha_inicio' => 'required|date',
                'fecha_fin' => 'required|date',
                'mes_defensa' => 'nullable|date_format:Y-m',
                'descripcion' => 'nullable|string|max:100',
                'es_activo' => 'nullable|boolean',
            ];
        }

        return [
            'anio' => 'sometimes|integer|min:2000|max:' . $maxYear,
            'numero_convocatoria' => 'sometimes|integer|min:1|max:999',
            'nombre' => 'sometimes|string|max:30',
            'fecha_inicio' => 'sometimes|date',
            'fecha_fin' => 'sometimes|date',
            'mes_defensa' => 'nullable|date_format:Y-m',
            'descripcion' => 'nullable|string|max:100',
            'es_activo' => 'sometimes|boolean',
        ];
    }

    private function validatePayload(Request $request, $isCreate, Convocatoria $convocatoria = null)
    {
        $data = $request->all();

        $validator = Validator::make($data, $this->validationRules($isCreate));

        $validator->after(function ($validator) use ($data, $convocatoria) {
            $inicioExistente = $convocatoria ? $convocatoria->fecha_inicio : null;
            $finExistente = $convocatoria ? $convocatoria->fecha_fin : null;

            $inicio = $data['fecha_inicio'] ?? ($inicioExistente ? $inicioExistente->format('Y-m-d') : null);
            $fin = $data['fecha_fin'] ?? ($finExistente ? $finExistente->format('Y-m-d') : null);

            if ($inicio && $fin && $fin < $inicio) {
                $validator->errors()->add('fecha_fin', 'La fecha de fin debe ser posterior o igual a la fecha de inicio.');
            }
        });

        $validated = $validator->validate();

        return $this->normalizePayload($validated, $isCreate, $convocatoria);
    }

    private function normalizePayload(array $data, bool $isCreate, ?Convocatoria $convocatoria = null): array
    {
        if (!array_key_exists('anio', $data)) {
            if (!empty($data['fecha_inicio'])) {
                $data['anio'] = (int) date('Y', strtotime($data['fecha_inicio']));
            } elseif (!$isCreate && $convocatoria) {
                $data['anio'] = $convocatoria->anio;
            }
        }

        if ($isCreate) {
            $anio = $data['anio'] ?? null;
            if ($anio) {
                $data['numero_convocatoria'] = $this->resolveNumeroConvocatoria($anio, $data['numero_convocatoria'] ?? null);
            }
        } else {
            if (!array_key_exists('numero_convocatoria', $data) && $convocatoria) {
                $data['numero_convocatoria'] = $convocatoria->numero_convocatoria;
            }
            if (!array_key_exists('anio', $data) && $convocatoria) {
                $data['anio'] = $convocatoria->anio;
            }
        }

        return $data;
    }

    private function resolveNumeroConvocatoria(int $anio, ?int $numero = null): int
    {
        if ($numero !== null && $numero > 0) {
            return (int) $numero;
        }

        $maxNumero = Convocatoria::where('anio', $anio)->max('numero_convocatoria');

        return $maxNumero ? ((int) $maxNumero + 1) : 1;
    }

    public function index(Request $request)
    {
        $query = Convocatoria::query();

        if ($request->has('anio')) {
            $query->where('anio', (int) $request->input('anio'));
        }

        if ($request->has('numero_convocatoria')) {
            $query->where('numero_convocatoria', (int) $request->input('numero_convocatoria'));
        }

        if ($request->has('es_activo')) {
            $estado = filter_var($request->input('es_activo'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($estado !== null) {
                $query->where('es_activo', $estado);
            }
        }

        if ($search = trim((string) $request->input('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('nombre', 'like', "%{$search}%")
                    ->orWhere('descripcion', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('with_counts')) {
            $query->withCount(['inscripciones', 'designacionesTutor']);
        }

        $orderBy = $request->input('order_by', 'fecha_inicio');
        $allowedOrders = ['fecha_inicio', 'fecha_fin', 'anio', 'numero_convocatoria', 'created_at'];
        if (!in_array($orderBy, $allowedOrders, true)) {
            $orderBy = 'fecha_inicio';
        }
        $orderDir = strtolower($request->input('order_dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $query->orderBy($orderBy, $orderDir);

        $perPage = (int) $request->input('per_page', 15);
        if ($perPage <= 0) {
            return response()->json($query->get());
        }

        return response()->json($query->paginate(min($perPage, 100)));
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request, true);
        $data['es_activo'] = array_key_exists('es_activo', $data) ? (bool) $data['es_activo'] : true;
        $data['creado_por'] = optional($request->user())->id;

        $convocatoria = Convocatoria::create($data);

        return response()->json($convocatoria, 201);
    }

    public function show($id)
    {
        $convocatoria = Convocatoria::withCount(['inscripciones', 'designacionesTutor'])
            ->with('creador:id,nombre_usuario')
            ->findOrFail($id);

        return response()->json($convocatoria);
    }

    public function update(Request $request, $id)
    {
        $convocatoria = Convocatoria::findOrFail($id);
        $data = $this->validatePayload($request, false, $convocatoria);

        $convocatoria->fill($data);
        $convocatoria->save();

        return response()->json($convocatoria);
    }

    public function destroy($id)
    {
        $convocatoria = Convocatoria::findOrFail($id);
        $convocatoria->delete();

        return response()->json(['message' => 'Convocatoria eliminada correctamente']);
    }

    public function toggleActivo($id)
    {
        $convocatoria = Convocatoria::findOrFail($id);
        $convocatoria->es_activo = !$convocatoria->es_activo;
        $convocatoria->save();

        return response()->json([
            'message' => 'Estado actualizado correctamente',
            'es_activo' => $convocatoria->es_activo,
        ]);
    }

    public function activas(Request $request)
    {
        $query = Convocatoria::query()
            ->where('es_activo', true)
            ->orderBy('fecha_inicio', 'desc');

        if ($request->boolean('with_counts')) {
            $query->withCount(['inscripciones', 'designacionesTutor']);
        }

        return response()->json($query->get());
    }
}
