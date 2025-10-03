<?php

namespace App\Http\Controllers\Api;

use App\Models\Proyecto;
use App\Models\InscripModalidad;
use App\Models\Modalidad;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProyectoController extends CrudController
{
    protected $modelClass = Proyecto::class;

    protected function rules()
    {
        return [
            'cod_ceta' => 'nullable|string|max:50',
            'nombres' => 'nullable|string|max:150',
            'apellidos' => 'nullable|string|max:150',
            'ci' => 'nullable|string|max:50',
            'expedicion' => 'nullable|string|max:10',
            'celular' => 'nullable|string|max:30',
            'instituto' => 'nullable|string|max:255',
            'carrera' => 'nullable|string|max:120',
            'nombre' => 'nullable|string|max:255',
            'tipo' => 'nullable|string|max:255',
            'objetivo' => 'nullable|string',
            'estado' => 'nullable|string|max:255',
            'porcentaje_avance' => 'nullable|integer|min:0|max:100',
            'inscrip_modalidad_id' => 'nullable|exists:inscrip_modalidad,id',
            // Permitimos modalidad_id en el payload para poder actualizar la inscripción ligada
            'modalidad_id' => 'nullable|exists:modalidad,id',
        ];
    }

    // GET /api/proyecto/by_cod?cod_ceta=XXXX
    public function getByCodCeta(Request $request)
    {
        $cod = $request->query('cod_ceta');
        if (!$cod) {
            return response()->json(null);
        }
        $proy = Proyecto::with('inscripModalidad')
            ->where('cod_ceta', (string)$cod)
            ->orderByDesc('id')
            ->first();
        return response()->json($proy);
    }

    public function store(Request $request)
    {
        $data = $this->validateData($request);
        // Resolver inscrip_modalidad_id si no viene
        $inscId = isset($data['inscrip_modalidad_id']) ? $data['inscrip_modalidad_id'] : null;
        if (empty($inscId) && isset($data['cod_ceta']) && $data['cod_ceta'] !== '') {
            $inscId = $this->resolveInscripModalidadId($data['cod_ceta']);
        }
        if (!empty($inscId)) {
            $data['inscrip_modalidad_id'] = $inscId;
        }

        // Crear proyecto
        $model = Proyecto::create($data);

        // Si llega modalidad_id o tipo, actualizar la inscripción de modalidad relacionada
        if (!empty($inscId)) {
            $modalidadId = isset($data['modalidad_id']) ? $data['modalidad_id'] : null;
            if (empty($modalidadId) && isset($data['tipo']) && $data['tipo'] !== '') {
                $modalidadId = $this->resolveModalidadIdFromTipo($data['tipo']);
            }
            if (!empty($modalidadId)) {
                $ins = InscripModalidad::find($inscId);
                if ($ins) {
                    $ins->modalidad_id = $modalidadId; // booted() sincroniza modalidad_nom
                    $ins->save();
                }
            }
        }

        return response()->json($model, 201);
    }

    public function update(Request $request, $id)
    {
        $data = $this->validateData($request, false);
        $model = Proyecto::findOrFail($id);

        // Resolver inscrip_modalidad_id si no viene pero sí hay cod_ceta
        $inscId = isset($data['inscrip_modalidad_id']) ? $data['inscrip_modalidad_id'] : null;
        if (empty($inscId)) {
            $cod = isset($data['cod_ceta']) ? $data['cod_ceta'] : $model->cod_ceta;
            if (!empty($cod)) {
                $inscId = $this->resolveInscripModalidadId($cod);
            }
        }
        if (!empty($inscId)) {
            $data['inscrip_modalidad_id'] = $inscId;
        }

        $model->update($data);

        // Actualizar modalidad en la inscripción si aplica
        if (!empty($inscId)) {
            $modalidadId = isset($data['modalidad_id']) ? $data['modalidad_id'] : null;
            if (empty($modalidadId) && isset($data['tipo']) && $data['tipo'] !== '') {
                $modalidadId = $this->resolveModalidadIdFromTipo($data['tipo']);
            }
            if (!empty($modalidadId)) {
                $ins = InscripModalidad::find($inscId);
                if ($ins) {
                    $ins->modalidad_id = $modalidadId; // booted() sincroniza modalidad_nom
                    $ins->save();
                }
            }
        }

        return response()->json($model);
    }

    private function resolveInscripModalidadId($codCeta)
    {
        // Busca la última inscripción por cod_ceta_est
        $id = DB::table('inscrip_modalidad')
            ->where('cod_ceta_est', (int)$codCeta)
            ->orderByDesc('id')
            ->value('id');
        return $id ? $id : null;
    }

    private function resolveModalidadIdFromTipo($tipo)
    {
        // Intenta resolver modalidad por nombre exacto o aproximado (case-insensitive)
        $val = trim((string)$tipo);
        if ($val === '') return null;
        $exact = Modalidad::whereRaw('LOWER(nombre) = ?', array(mb_strtolower($val, 'UTF-8')))->value('id');
        if ($exact) return $exact;
        $likeRow = DB::table('modalidad')->select('id')->where('nombre', 'LIKE', '%'.$val.'%')->limit(2)->get();
        if ($likeRow && count($likeRow) === 1) {
            $row = (array)$likeRow[0];
            return isset($row['id']) ? $row['id'] : null;
        }
        return null;
    }
}
