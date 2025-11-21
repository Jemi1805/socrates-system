<?php

namespace App\Http\Controllers;

use App\Models\Postulante;
use App\Models\InscripModalidad;
use App\Models\Modalidad;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PostulanteController extends Controller
{
    public function index()
    {
        return Postulante::all();
    }

    public function inscritos(Request $request)
    {
        $perPage = (int) $request->query('per_page', 25);
        if ($perPage <= 0) {
            $perPage = 25;
        }

        $estado = $request->query('estado');
        $carrera = $request->query('carrera');
        $search = trim((string) $request->query('search', ''));
        $year = $request->query('year');
        $convocatoriaId = $request->query('convocatoria_id');

        $latestInscripciones = DB::table('inscrip_modalidad')
            ->select('cod_ceta_est', DB::raw('MAX(id) as last_id'))
            ->groupBy('cod_ceta_est');

        // Último proyecto por estudiante para exponer celular local actualizado
        $latestProyecto = DB::table('proyecto')
            ->select('cod_ceta', DB::raw('MAX(id) as last_id'))
            ->groupBy('cod_ceta');

        $query = Postulante::query()
            ->select([
                'postulantes.cod_ceta',
                'postulantes.nombres_est',
                'postulantes.ap_pat',
                'postulantes.ap_mat',
                'postulantes.ci',
                'postulantes.procedencia',
                'postulantes.carrera',
                'inscrip_modalidad.modalidad_id',
                'inscrip_modalidad.modalidad_nom',
                'inscrip_modalidad.estado',
                'inscrip_modalidad.fecha_inscripcion',
                'inscrip_modalidad.estado_arancel',
                'inscrip_modalidad.nro_postulante',
                'inscrip_modalidad.convocatoria_id',
                'inscrip_modalidad.nom_convocatoria',
                DB::raw('proj.celular as celular'),
            ])
            ->joinSub($latestInscripciones, 'latest_insc', function ($join) {
                $join->on('latest_insc.cod_ceta_est', '=', 'postulantes.cod_ceta');
            })
            ->join('inscrip_modalidad', function ($join) {
                $join->on('inscrip_modalidad.id', '=', 'latest_insc.last_id');
            })
            // Unir el último proyecto para obtener celular local
            ->leftJoinSub($latestProyecto, 'latest_proy', function ($join) {
                $join->on('latest_proy.cod_ceta', '=', 'postulantes.cod_ceta');
            })
            ->leftJoin('proyecto as proj', function ($join) {
                $join->on('proj.id', '=', 'latest_proy.last_id');
            });

        if ($estado !== null && $estado !== '') {
            $query->where('inscrip_modalidad.estado', $estado);
        }

        if ($carrera) {
            $normalized = $this->normalizeCarrera($carrera);
            if ($normalized) {
                $query->where(function ($q) use ($normalized) {
                    $q->whereRaw('LOWER(postulantes.carrera) = ?', [$normalized])
                        ->orWhereRaw('LOWER(postulantes.carrera_nombre) = ?', [$normalized]);
                });
            }
        }

        if ($year !== null && $year !== '') {
            $query->whereYear('inscrip_modalidad.fecha_inscripcion', (int) $year);
        }

        if ($convocatoriaId !== null && $convocatoriaId !== '') {
            $query->where('inscrip_modalidad.convocatoria_id', $convocatoriaId);
        }

        if ($search !== '') {
            $like = '%' . mb_strtolower($search, 'UTF-8') . '%';
            $query->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(postulantes.nombres_est) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(postulantes.ap_pat) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(postulantes.ap_mat) LIKE ?', [$like])
                    ->orWhereRaw('CAST(postulantes.cod_ceta AS CHAR) LIKE ?', [$like]);
            });
        }

        $query->orderByDesc('inscrip_modalidad.fecha_inscripcion');

        return $query->paginate($perPage);
    }

    private function normalizeCarrera($carrera)
    {
        if (empty($carrera)) {
            return null;
        }

        $normalized = trim(mb_strtolower($carrera));
        $map = [
            'mecanica' => 'mecanica',
            'mecánica' => 'mecanica',
            'mecanica automotriz' => 'mecanica',
            'mecánica automotriz' => 'mecanica',
            'mea' => 'mecanica',
            'electricidad' => 'electricidad',
            'electricidad y electrónica automotriz' => 'electricidad',
            'electricidad y electronica automotriz' => 'electricidad',
            'electronica' => 'electricidad',
            'electrónica' => 'electricidad',
            'eléctrica' => 'electricidad',
            'eea' => 'electricidad',
        ];

        return $map[$normalized] ?? $normalized;
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            // Clave primaria / identificador de estudiante (si no llega, se generará)
            'cod_ceta' => 'nullable|integer',

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

        // Generar Código CETA si no se envió
        if (empty($data['cod_ceta'])) {
            $year = (int) date('Y');
            $flag = 0; // 0 = mecánica, 1 = electrónica
            $carrera = strtolower((string)(isset($data['carrera']) ? $data['carrera'] : ''));
            if (strpos($carrera, 'elect') !== false) { $flag = 1; }
            $yearPrefix = '9' . sprintf('%04d', $year);
            // Rango por año (independiente del flag) en tabla postulantes
            $minRange = (int)($yearPrefix . '0000'); // 9 + AAAA + 0 + 000
            $maxRange = (int)($yearPrefix . '1999'); // 9 + AAAA + 1 + 999
            $max = Postulante::query()
                ->whereBetween('cod_ceta', [$minRange, $maxRange])
                ->max('cod_ceta');
            $seq = 0;
            if ($max) {
                $seq = (int) substr((string)$max, -3);
            }
            $seq = $seq + 1;
            $data['cod_ceta'] = (int)($yearPrefix . $flag . str_pad((string)$seq, 3, '0', STR_PAD_LEFT));
        }

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

        // Resolver nombre de la modalidad para persistirlo en modalidad_nom
        $modalidad = Modalidad::find($data['modalidad_id']);
        $modalidadNom = $modalidad ? (string) $modalidad->nombre : null;

        $payload = [
            'cod_ceta_est' => (int) $cod_ceta,
            'modalidad_id' => $data['modalidad_id'],
            'modalidad_nom' => $modalidadNom,
            'estado' => (isset($data['estado']) && $data['estado'] !== null) ? $data['estado'] : 'Inscrito',
            'fecha_inscripcion' => $data['fecha_inscripcion'],
        ];

        // Actualizar si existe, crear si no
        $inscripcion = InscripModalidad::updateOrCreate(
            ['cod_ceta_est' => (int) $cod_ceta],
            $payload
        );

        // Devolver con relación cargada para el front
        return response()->json($inscripcion->fresh()->load('modalidad'), 200);
    }
}
