<?php

namespace App\Http\Controllers;

use App\Models\Postulante;
use App\Models\InscripModalidad;
use App\Models\Modalidad;
use Illuminate\Http\Request;

class PostulanteController extends Controller
{
    public function index()
    {
        return Postulante::all();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            // Clave primaria / identificador de estudiante
            'cod_ceta' => 'required|integer',

            // Datos biográficos
            'nombres_est' => 'required|string|max:255',
            'ap_pat' => 'required|string|max:255',
            'ap_mat' => 'required|string|max:255',
            'ci' => 'required|string|max:20',
            'complemento' => 'nullable|string|max:2',
            'fecha_nacimiento' => 'nullable|date',
            'lugar_nacimiento' => 'nullable|string|max:255',
            'procedencia' => 'nullable|string|max:255',
            'carrera' => 'required|string|max:255',
            'pensum' => 'nullable|string|max:50',

            // Otros campos (opcionales por ahora)
            'expedido' => 'nullable|string|max:10',
            'reg_ini_c' => 'nullable|string|max:20',
            'gestion_ini' => 'nullable|string|max:20',
            'reg_con_c' => 'nullable|string|max:20',
            'gestion_fin' => 'nullable|string|max:20',
            'incrip_uni' => 'nullable|boolean',
        ]);

        // Mapear 'procedencia' (UI) al campo 'expedido' (DB) si no se envía 'expedido'
        if ((empty($data['expedido']) || !isset($data['expedido'])) && isset($data['procedencia'])) {
            $data['expedido'] = $data['procedencia'];
        }

        // Compatibilidad: componer apellidos_est si no viene
        if (empty($data['apellidos_est'])) {
            $apPat = isset($data['ap_pat']) ? $data['ap_pat'] : '';
            $apMat = isset($data['ap_mat']) ? $data['ap_mat'] : '';
            $data['apellidos_est'] = trim($apPat . ' ' . $apMat);
        }

        // Defaults para columnas NO NULL del esquema original
        if (!isset($data['expedido'])) { $data['expedido'] = ''; }
        if (!isset($data['reg_ini_c'])) { $data['reg_ini_c'] = ''; }
        if (!isset($data['gestion_ini'])) { $data['gestion_ini'] = ''; }
        if (!isset($data['reg_con_c'])) { $data['reg_con_c'] = ''; }
        if (!isset($data['gestion_fin'])) { $data['gestion_fin'] = ''; }
        if (!isset($data['incrip_uni'])) { $data['incrip_uni'] = false; }

        try {
            $postulante = Postulante::updateOrCreate(
                ['cod_ceta' => (int) $data['cod_ceta']],
                $data
            );
            // Asegurar que devolvemos los datos frescos desde DB (incluida 'procedencia')
            $postulante->refresh();
            return response()->json($postulante, 201);
        } catch (\Throwable $e) {
            \Log::error('[PostulanteController@store] Error al guardar biográficos', [
                'cod_ceta' => $data['cod_ceta'] ?? null,
                'error' => $e->getMessage(),
            ]);
            return response()->json([
                'message' => 'Error al guardar datos biográficos',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function show($id)
    {
        return Postulante::findOrFail($id);
    }

    public function update(Request $request, $id)
    {
        $postulante = Postulante::findOrFail($id);
        $data = $request->validate([
            'nombres_est' => 'sometimes|required|string|max:255',
            'ap_pat' => 'sometimes|required|string|max:255',
            'ap_mat' => 'sometimes|required|string|max:255',
            'ci' => 'sometimes|required|string|max:20',
            'complemento' => 'nullable|string|max:2',
            'fecha_nacimiento' => 'nullable|date',
            'lugar_nacimiento' => 'nullable|string|max:255',
            'procedencia' => 'nullable|string|max:255',
            'carrera' => 'sometimes|required|string|max:255',
            'pensum' => 'nullable|string|max:50',
            'nro_serie_titulo' => 'nullable|string|max:255',
            'expedido' => 'nullable|string|max:10',
            'reg_ini_c' => 'nullable|string|max:20',
            'gestion_ini' => 'nullable|string|max:20',
            'reg_con_c' => 'nullable|string|max:20',
            'gestion_fin' => 'nullable|string|max:20',
            'incrip_uni' => 'nullable|boolean',
        ]);
        // Mapear 'procedencia' (UI) al campo 'expedido' (DB) si no se envía 'expedido'
        if ((!isset($data['expedido']) || $data['expedido'] === null || $data['expedido'] === '') && isset($data['procedencia'])) {
            $data['expedido'] = $data['procedencia'];
        }
        if (!isset($data['apellidos_est']) && (isset($data['ap_pat']) || isset($data['ap_mat']))) {
            $apPat = isset($data['ap_pat']) ? $data['ap_pat'] : (isset($postulante->ap_pat) ? $postulante->ap_pat : '');
            $apMat = isset($data['ap_mat']) ? $data['ap_mat'] : (isset($postulante->ap_mat) ? $postulante->ap_mat : '');
            $data['apellidos_est'] = trim($apPat . ' ' . $apMat);
        }
        $postulante->update($data);
        return response()->json($postulante, 200);
    }

    public function destroy($id)
    {
        Postulante::destroy($id);
        return response()->json(null, 204);
    }

    /**
     * Obtener la modalidad asignada al postulante (última por fecha_inscripcion)
     */
    public function getModalidad($cod_ceta)
    {
        $inscripcion = InscripModalidad::with('modalidad')
            ->where('cod_ceta_est', $cod_ceta)
            ->orderByDesc('fecha_inscripcion')
            ->first();

        if (!$inscripcion) {
            return response()->json(['message' => 'Sin modalidad asignada'], 404);
        }

        return response()->json($inscripcion);
    }

    /**
     * Asignar o actualizar modalidad del postulante (upsert por cod_ceta_est)
     */
    public function setModalidad(Request $request, $cod_ceta)
    {
        $data = $request->validate([
            'modalidad_id' => 'required|exists:modalidad,id',
            'estado' => 'nullable|string|max:255',
            'fecha_inscripcion' => 'nullable|date',
        ]);

        // Si no se envía fecha, usar hoy
        if (empty($data['fecha_inscripcion'])) {
            $data['fecha_inscripcion'] = now()->toDateString();
        }

        $payload = [
            'cod_ceta_est' => (int) $cod_ceta,
            'modalidad_id' => $data['modalidad_id'],
            'estado' => (isset($data['estado']) && $data['estado'] !== null) ? $data['estado'] : 'Inscrito',
            'fecha_inscripcion' => $data['fecha_inscripcion'],
        ];

        // Actualizar si existe, crear si no
        $inscripcion = InscripModalidad::updateOrCreate(
            ['cod_ceta_est' => (int) $cod_ceta],
            $payload
        );

        return response()->json($inscripcion, 200);
    }
}
