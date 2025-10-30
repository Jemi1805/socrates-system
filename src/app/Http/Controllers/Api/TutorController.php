<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use App\Models\Tutor;
use App\Models\PertinenciaAcad;
use App\Models\TipoTutor;
use App\Models\DesignacionTutor;

class TutorController extends Controller
{
    private const DOC_INTRO_TEXT = 'En cumplimiento al Reglamento de Modalidades de Graduación de Institutos Técnicos y Tecnológicos de Carácter Fiscal, de Convenio y Privado aprobado por la Resolución Ministerial Nº 0487/2023 del 14 de junio de 2023 y del Reglamento Interno de Modalidades de Graduación del Instituto “CETA”, la Dirección Académica del Instituto, lo designa como Tutor para Defensas de Grado de los siguientes estudiantes:';
    private const DOC_PARA_CARGO = 'DOCENTE TÉCNICO';
    private const DOC_DE_NOMBRE = 'Ing. Bradley Jaillita Burgoa';
    private const DOC_DE_CARGO = 'DIRECTOR ACADÉMICO';
    private const DOC_ASUNTO = 'DESIGNACIÓN COMO TUTOR PARA PROYECTOS DE DEFENSA DE GRADO';
    private const DOC_PIE_NOTAS = ['BJB', 'ML', 'CC: REG/DA'];
    /**
     * Listar tutores registrados.
     * Filtros opcionales: ?carrera=MEA|EEA|Nombre
     */
    public function index(Request $request)
    {
        $carrera = $request->query('carrera');

        $query = Tutor::query()
            ->leftJoin('carrera', 'tutores.cod_carrera', '=', 'carrera.cod_carrera')
            ->leftJoin('tipo_tutor', 'tutores.tipo_tutor_id', '=', 'tipo_tutor.id')
            ->select('tutores.*', 'carrera.nombre_carrera as carrera_nom')
            ->with(['pertinencias:id,nombre_pert']);

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

        $rows = $query->orderBy('tutores.nombre')->get();

        $data = $rows->map(function ($t) {
            $pertIds = method_exists($t, 'pertinencias') ? $t->pertinencias->pluck('id')->values()->all() : [];
            $pertNoms = method_exists($t, 'pertinencias') ? $t->pertinencias->pluck('nombre_pert')->values()->all() : [];
            return [
                'id' => $t->id,
                'nombre' => $t->nombre,
                'apellido_p' => $t->apellido_p,
                'apellido_m' => $t->apellido_m,
                'celular' => $t->celular,
                'titulo' => $t->titulo,
                'ci' => $t->ci,
                'cod_carrera' => $t->cod_carrera,
                'carrera' => $t->carrera_nom,
                'pertinencia_acad_id' => $t->pertinencia_acad_id,
                'pertinencia' => $t->pertinencia_nom,
                'pertinencia_ids' => $pertIds,
                'pertinencias' => $pertNoms,
                'activo' => (bool)$t->activo,
                'tipo_tutor_id' => $t->tipo_tutor_id,
                'tipo_tutor' => optional(TipoTutor::find($t->tipo_tutor_id))->nombre,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
            'total' => $data->count(),
        ]);
    }

    /**
     * Listado de tutores designados agrupados por tutor y filtrables por convocatoria.
     */
    public function designaciones(Request $request)
    {
        $convocatoriaId = $request->query('convocatoria_id');
        $search = trim((string)$request->query('search', ''));

        $query = DesignacionTutor::query()
            ->leftJoin('tutores', 'designacion_tutor.tutor_id', '=', 'tutores.id')
            ->leftJoin('tipo_tutor', 'tutores.tipo_tutor_id', '=', 'tipo_tutor.id')
            ->leftJoin('postulantes', 'designacion_tutor.cod_ceta', '=', 'postulantes.cod_ceta')
            ->leftJoin('convocatorias', 'designacion_tutor.convocatoria_id', '=', 'convocatorias.id')
            ->leftJoin('carrera', 'tutores.cod_carrera', '=', 'carrera.cod_carrera')
            ->leftJoin('proyecto', 'designacion_tutor.proyecto_id', '=', 'proyecto.id')
            ->leftJoin('doc_designaciones', 'doc_designaciones.designacion_tutor_id', '=', 'designacion_tutor.id')
            ->select([
                'designacion_tutor.id as designacion_id',
                'designacion_tutor.tutor_id',
                'designacion_tutor.cod_ceta',
                'designacion_tutor.proyecto_id',
                'designacion_tutor.fecha_designacion',
                'designacion_tutor.convocatoria_id',
                'designacion_tutor.convocatoria_nom as designacion_convocatoria_nom',
                'designacion_tutor.estudiante_nombre as designacion_estudiante_nom',
                'designacion_tutor.tutor_nombre as designacion_tutor_nom',
                'doc_designaciones.doc_tipo as doc_doc_tipo',
                'doc_designaciones.year as doc_year',
                'doc_designaciones.correlativo as doc_correlativo',
                'doc_designaciones.cite as doc_cite',
                'doc_designaciones.para_nombre as doc_para_nombre',
                'doc_designaciones.para_cargo as doc_para_cargo',
                'doc_designaciones.de_nombre as doc_de_nombre',
                'doc_designaciones.de_cargo as doc_de_cargo',
                'doc_designaciones.asunto as doc_asunto',
                'doc_designaciones.introduccion as doc_introduccion',
                'doc_designaciones.pie_notas as doc_pie_notas',
                'doc_designaciones.tutor_nombre as doc_tutor_nombre',
                'doc_designaciones.tutor_titulo as doc_tutor_titulo',
                'doc_designaciones.estudiantes_resumen as doc_estudiantes_resumen',
                'tutores.nombre as tutor_nombre',
                'tutores.apellido_p as tutor_apellido_p',
                'tutores.apellido_m as tutor_apellido_m',
                'tutores.celular as tutor_celular',
                'tutores.cod_carrera',
                'tutores.ci as tutor_ci',
                'tutores.titulo as tutor_titulo',
                'tipo_tutor.id as tipo_tutor_id',
                'tipo_tutor.nombre as tipo_tutor_nombre',
                'postulantes.nombres_est as postulante_nombres',
                'postulantes.ap_pat as postulante_ap_pat',
                'postulantes.ap_mat as postulante_ap_mat',
                DB::raw("TRIM(CONCAT(IFNULL(postulantes.ap_pat,''),' ',IFNULL(postulantes.ap_mat,''),' ',IFNULL(postulantes.nombres_est,''))) AS postulante_nombre_completo"),
                'convocatorias.nombre as convocatoria_nombre',
                'convocatorias.numero_convocatoria as convocatoria_numero',
                'convocatorias.anio as convocatoria_anio',
                'convocatorias.es_activo as convocatoria_activo',
                'carrera.nombre_carrera as carrera_nombre',
                'proyecto.nombre as proyecto_nombre',
            ])
            ->orderBy('tutores.nombre')
            ->orderBy('tutores.apellido_p')
            ->orderBy('tutores.apellido_m')
            ->orderBy('designacion_tutor.fecha_designacion', 'desc');

        if ($convocatoriaId !== null && $convocatoriaId !== '') {
            $query->where('designacion_tutor.convocatoria_id', (int)$convocatoriaId);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $like = "%{$search}%";
                $q->where('tutores.nombre', 'like', $like)
                    ->orWhere('tutores.apellido_p', 'like', $like)
                    ->orWhere('tutores.apellido_m', 'like', $like)
                    ->orWhere('designacion_tutor.tutor_nombre', 'like', $like);
            });
        }

        $rows = $query->get();

        if ($rows->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [],
                'total' => 0,
            ]);
        }

        $grouped = [];

        foreach ($rows as $row) {
            $tutorId = (isset($row->tutor_id) && $row->tutor_id !== null) ? (int)$row->tutor_id : 0;
            if (!$tutorId) {
                continue;
            }

            if (!isset($grouped[$tutorId])) {
                $fullTutorName = $row->designacion_tutor_nom
                    ?: trim(implode(' ', array_filter([$row->tutor_nombre, $row->tutor_apellido_p, $row->tutor_apellido_m])));

                $convLabel = $this->formatConvocatoriaLabel(
                    $row->designacion_convocatoria_nom,
                    $row->convocatoria_numero,
                    $row->convocatoria_nombre,
                    $row->convocatoria_anio
                );

                $numeroDocumento = $this->normalizeNumero($row->doc_correlativo ?? null);
                $pieNotas = $this->decodeJsonColumn($row->doc_pie_notas ?? null) ?: self::DOC_PIE_NOTAS;
                $estResumen = $this->decodeJsonColumn($row->doc_estudiantes_resumen ?? null);
                $grouped[$tutorId] = [
                    'tutor_id' => $tutorId,
                    'tutor_ci' => $row->tutor_ci,
                    'tutor_nombre' => $fullTutorName,
                    'tutor_celular' => $row->tutor_celular,
                    'tutor_titulo' => $row->tutor_titulo,
                    'cod_carrera' => $row->cod_carrera,
                    'carrera_nombre' => $row->carrera_nombre,
                    'tipo_tutor_id' => $row->tipo_tutor_id ? (int)$row->tipo_tutor_id : null,
                    'tipo_tutor_nombre' => $row->tipo_tutor_nombre,
                    'convocatoria_id' => $row->convocatoria_id ? (int)$row->convocatoria_id : null,
                    'convocatoria_label' => $convLabel,
                    'designacion_id' => $row->designacion_id ? (int)$row->designacion_id : null,
                    'doc_tipo' => $row->doc_doc_tipo,
                    'doc_year' => $row->doc_year,
                    'numero_documento' => $numeroDocumento,
                    'cite' => $row->doc_cite,
                    'area' => $row->area ?? null,
                    'doc_para_nombre' => $row->doc_para_nombre,
                    'doc_para_cargo' => $row->doc_para_cargo ?: self::DOC_PARA_CARGO,
                    'doc_de_nombre' => $row->doc_de_nombre ?: self::DOC_DE_NOMBRE,
                    'doc_de_cargo' => $row->doc_de_cargo ?: self::DOC_DE_CARGO,
                    'doc_asunto' => $row->doc_asunto ?: self::DOC_ASUNTO,
                    'doc_introduccion' => $row->doc_introduccion ?: self::DOC_INTRO_TEXT,
                    'doc_pie_notas' => $pieNotas,
                    'doc_tutor_nombre' => $row->doc_tutor_nombre,
                    'doc_tutor_titulo' => $row->doc_tutor_titulo,
                    'doc_estudiantes_resumen' => $estResumen,
                    'estudiantes' => [],
                ];
            }

            $estudianteNombre = $row->designacion_estudiante_nom ?: $row->postulante_nombre_completo;

            $grouped[$tutorId]['estudiantes'][] = [
                'cod_ceta' => $row->cod_ceta,
                'estudiante_nombre' => $estudianteNombre,
                'proyecto_id' => $row->proyecto_id,
                'proyecto_nombre' => $row->proyecto_nombre,
                'fecha_designacion' => $row->fecha_designacion,
                'area' => $row->area ?? null,
            ];
        }

        $data = array_values(array_map(function ($item) {
            $item['total_estudiantes'] = count($item['estudiantes']);
            return $item;
        }, $grouped));

        return response()->json([
            'success' => true,
            'data' => $data,
            'total' => count($data),
        ]);
    }

    private function formatConvocatoriaLabel($fromDesignation, $numero, $nombre, $anio)
    {
        $fromDesignation = is_null($fromDesignation) ? '' : (string)$fromDesignation;
        if ($fromDesignation !== '' && trim($fromDesignation) !== '') {
            return trim($fromDesignation);
        }

        $numeroStr = $numero !== null ? trim((string)$numero) : '';
        $nombreStr = $nombre !== null ? trim((string)$nombre) : '';
        $anioStr = $anio !== null ? trim((string)$anio) : '';

        if ($numeroStr !== '' && $nombreStr !== '') {
            return $numeroStr . ' - ' . $nombreStr;
        }
        if ($numeroStr !== '') {
            return 'Convocatoria ' . $numeroStr;
        }
        if ($nombreStr !== '') {
            return $nombreStr;
        }
        if ($anioStr !== '') {
            return 'Convocatoria ' . $anioStr;
        }

        return null;
    }

    private function resolveDocumentoTipo($tipoTutorNombre)
    {
        $nombre = strtolower((string) $tipoTutorNombre);
        if (strpos($nombre, 'planta') !== false || strpos($nombre, 'interno') !== false) {
            return 'MEM';
        }
        return 'COMINT';
    }

    private function extractYear($fechaDesignacion)
    {
        if ($fechaDesignacion) {
            try {
                return Carbon::parse($fechaDesignacion)->year;
            } catch (\Exception $e) {
                // fall-through
            }
        }
        return Carbon::now()->year;
    }

    private function buildCite($docType, $year, $numero)
    {
        $yearStr = str_pad((string) $year, 4, '0', STR_PAD_LEFT);
        return $docType === 'MEM'
            ? sprintf('CETA/DA/MEM/%s/%s', $yearStr, $numero)
            : sprintf('CETA/DA/COMINT/%s/%s', $yearStr, $numero);
    }

    private function normalizeNumero($correlativo)
    {
        if ($correlativo === null) {
            return null;
        }
        $n = (int) $correlativo;
        if ($n <= 0) {
            return null;
        }
        return str_pad((string) $n, 3, '0', STR_PAD_LEFT);
    }

    private function decodeJsonColumn($value)
    {
        if ($value === null) {
            return null;
        }

        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode($value, true);
        return json_last_error() === JSON_ERROR_NONE ? $decoded : null;
    }

    private function ensureDocDesignacion($row, $tutorNombreResolved, $estudianteNombreResolved)
    {
        $docType = $this->resolveDocumentoTipo($row->tipo_tutor_nombre ?? null);
        $year = $this->extractYear($row->fecha_designacion ?? null);

        $paraNombre = $tutorNombreResolved ?: ($row->tutor_nombre ?? null);
        $paraNombre = $paraNombre ? trim(preg_replace('/\s+/', ' ', $paraNombre)) : null;
        $tutorTitulo = null;
        if (!empty($row->tutor_titulo_base)) {
            $tutorTitulo = trim((string) $row->tutor_titulo_base);
        }

        $doc = DB::table('doc_designaciones')
            ->where('designacion_tutor_id', $row->id)
            ->lockForUpdate()
            ->first();

        $now = Carbon::now();

        $estudiantesResumen = $doc && $doc->estudiantes_resumen
            ? $this->decodeJsonColumn($doc->estudiantes_resumen)
            : $this->buildEstudiantesResumen($row->id);

        if (!$doc) {
            [$numeroInt, $numeroStr, $cite] = $this->nextSequence($docType, $year);

            DB::table('doc_designaciones')->insert([
                'designacion_tutor_id' => $row->id,
                'doc_tipo' => $docType,
                'year' => $year,
                'correlativo' => $numeroInt,
                'cite' => $cite,
                'para_nombre' => $paraNombre,
                'para_cargo' => self::DOC_PARA_CARGO,
                'de_nombre' => self::DOC_DE_NOMBRE,
                'de_cargo' => self::DOC_DE_CARGO,
                'asunto' => self::DOC_ASUNTO,
                'introduccion' => self::DOC_INTRO_TEXT,
                'cronograma_inicio' => $row->cronograma_inicio ?? null,
                'cronograma_fin' => $row->cronograma_fin ?? null,
                'cierre' => null,
                'pie_notas' => json_encode(self::DOC_PIE_NOTAS),
                'tutor_nombre' => $tutorNombreResolved ?: $paraNombre,
                'tutor_titulo' => $tutorTitulo,
                'estudiantes_resumen' => $estudiantesResumen ? json_encode($estudiantesResumen) : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            DB::table('doc_designacion_secuencias')->updateOrInsert(
                ['doc_tipo' => $docType, 'year' => $year],
                [
                    'last_correlativo' => $numeroInt,
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );

            $doc = (object) [
                'doc_tipo' => $docType,
                'year' => $year,
                'correlativo' => $numeroInt,
                'cite' => $cite,
                'para_nombre' => $paraNombre,
                'para_cargo' => self::DOC_PARA_CARGO,
                'de_nombre' => self::DOC_DE_NOMBRE,
                'de_cargo' => self::DOC_DE_CARGO,
                'asunto' => self::DOC_ASUNTO,
                'introduccion' => self::DOC_INTRO_TEXT,
                'pie_notas' => self::DOC_PIE_NOTAS,
                'tutor_nombre' => $tutorNombreResolved ?: $paraNombre,
                'tutor_titulo' => $tutorTitulo,
                'estudiantes_resumen' => $estudiantesResumen,
            ];

            return [$doc, $numeroStr, $cite];
        }

        $numeroStr = $this->normalizeNumero($doc->correlativo ?? null);
        $citeExisting = is_string($doc->cite ?? null) ? trim($doc->cite) : '';
        $citeHasPlaceholder = $citeExisting === '' || strpos($citeExisting, '___') !== false;

        if (!$numeroStr) {
            [$numeroInt, $numeroStr, $citeGenerated] = $this->nextSequence($docType, $year);
            DB::table('doc_designaciones')
                ->where('designacion_tutor_id', $row->id)
                ->update([
                    'correlativo' => $numeroInt,
                    'cite' => $citeGenerated,
                    'updated_at' => $now,
                ]);

            $doc = DB::table('doc_designaciones')
                ->where('designacion_tutor_id', $row->id)
                ->first();

            $numeroStr = $this->normalizeNumero($doc->correlativo ?? null);
            $citeExisting = is_string($doc->cite ?? null) ? trim($doc->cite) : '';
            $citeHasPlaceholder = $citeExisting === '' || strpos($citeExisting, '___') !== false;
        }

        $cite = $citeHasPlaceholder
            ? $this->buildCite($docType, $year, $numeroStr ?? '')
            : $citeExisting;

        $updateData = [];
        if (($citeHasPlaceholder || !$doc->cite) && $cite) {
            $updateData['cite'] = $cite;
        }
        if (!$doc->para_nombre && $paraNombre) {
            $updateData['para_nombre'] = $paraNombre;
        }
        if (!$doc->tutor_nombre && $tutorNombreResolved) {
            $updateData['tutor_nombre'] = $tutorNombreResolved;
        }
        if (!$doc->tutor_titulo && $tutorTitulo) {
            $updateData['tutor_titulo'] = $tutorTitulo;
        }
        if (!$doc->estudiantes_resumen && $estudiantesResumen) {
            $updateData['estudiantes_resumen'] = json_encode($estudiantesResumen);
        }
        if (!$doc->pie_notas) {
            $updateData['pie_notas'] = json_encode(self::DOC_PIE_NOTAS);
        }

        if (!empty($updateData)) {
            $updateData['updated_at'] = $now;
            DB::table('doc_designaciones')
                ->where('designacion_tutor_id', $row->id)
                ->update($updateData);

            $doc = DB::table('doc_designaciones')->where('designacion_tutor_id', $row->id)->first();
        }

        DB::table('doc_designacion_secuencias')->updateOrInsert(
            ['doc_tipo' => $docType, 'year' => $year],
            [
                'last_correlativo' => $doc->correlativo ?? ($numeroStr ? (int) ltrim($numeroStr, '0') : null),
                'updated_at' => $now,
                'created_at' => $now,
            ]
        );

        $doc->pie_notas = $this->decodeJsonColumn($doc->pie_notas ?? null) ?: self::DOC_PIE_NOTAS;
        $doc->estudiantes_resumen = $this->decodeJsonColumn($doc->estudiantes_resumen ?? null);

        return [$doc, $numeroStr, $cite];
    }

    private function buildEstudiantesResumen($designacionId)
    {
        $rows = DB::table('designacion_tutor as dt')
            ->where('dt.id', $designacionId)
            ->join('postulantes as p', 'dt.cod_ceta', '=', 'p.cod_ceta')
            ->select(
                'p.cod_ceta',
                DB::raw("TRIM(CONCAT(IFNULL(p.ap_pat,''),' ',IFNULL(p.ap_mat,''),' ',IFNULL(p.nombres_est,''))) AS nombre"),
                'dt.proyecto_id'
            )
            ->get();

        if ($rows->isEmpty()) {
            return null;
        }

        $list = $rows->map(function ($item) {
            return [
                'cod_ceta' => $item->cod_ceta,
                'nombre' => $item->nombre,
                'proyecto_id' => $item->proyecto_id,
            ];
        })->toArray();

        return $list;
    }

    private function nextSequence($docType, $year)
    {
        $now = Carbon::now();
        $baseNumero = 0;

        $sequenceRow = DB::table('doc_designacion_secuencias')
            ->where('doc_tipo', $docType)
            ->where('year', $year)
            ->lockForUpdate()
            ->first();

        if ($sequenceRow && isset($sequenceRow->last_correlativo)) {
            $baseNumero = max(0, (int) $sequenceRow->last_correlativo);
        } else {
            $maxNumero = DB::table('doc_designaciones')
                ->where('doc_tipo', $docType)
                ->where('year', $year)
                ->max('correlativo');
            $baseNumero = max(0, (int) $maxNumero);
        }

        $numero = $baseNumero + 1;
        if ($numero <= 0) {
            $numero = 1;
        }

        $normalized = $this->normalizeNumero($numero);
        $cite = $this->buildCite($docType, $year, $normalized);

        DB::table('doc_designacion_secuencias')->updateOrInsert(
            ['doc_tipo' => $docType, 'year' => $year],
            [
                'last_correlativo' => $numero,
                'updated_at' => $now,
                'created_at' => $now,
            ]
        );

        return [$numero, $normalized, $cite];
    }
    /**
     * Registrar/actualizar tutores en lote (directamente en tabla tutores).
     * Espera payload: { items: [{ ci, nombre, apellido_p, apellido_m, celular, cod_carrera?, pertinencia_acad_id?, pertinencia?, pertinencia_acad_ids?: number[], tipo_tutor_id?: number }] }
     */
    public function registerBulk(Request $request)
    {
        $updateOnly = (bool)$request->boolean('update_only', false);
        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.ci' => 'required|string|max:50',
            'items.*.nombre' => 'required|string|max:150',
            'items.*.apellido_p' => 'nullable|string|max:150',
            'items.*.apellido_m' => 'nullable|string|max:150',
            'items.*.celular' => 'required|string|max:50',
            'items.*.cod_carrera' => 'nullable|string|max:10',
            'items.*.pertinencia_acad_id' => 'nullable|integer|exists:pertinencia_acad,id',
            'items.*.pertinencia_acad_ids' => 'nullable|array',
            'items.*.pertinencia_acad_ids.*' => 'integer|exists:pertinencia_acad,id',
            'items.*.pertinencia' => 'nullable|string|max:255',
            'items.*.titulo' => 'nullable|string|max:255',
            'items.*.tipo_tutor_id' => 'nullable|integer|exists:tipo_tutor,id',
            'items.*.activo' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $items = $validator->validated()['items'];

        $created = 0; $updated = 0; $skipped = 0;
        $result = [];

        DB::beginTransaction();
        try {
            foreach ($items as $i) {
                $ci = strtoupper(trim((string)(isset($i['ci']) ? $i['ci'] : '')));
                $idsMulti = [];
                if (isset($i['pertinencia_acad_ids']) && is_array($i['pertinencia_acad_ids'])) {
                    $idsMulti = array_values(array_unique(array_map('intval', $i['pertinencia_acad_ids'])));
                    $idsMulti = array_filter($idsMulti, function ($v) { return $v > 0; });
                }

                $primaryId = isset($i['pertinencia_acad_id'])
                    ? (int)$i['pertinencia_acad_id']
                    : (isset($idsMulti[0]) ? $idsMulti[0] : null);

                // Validar IDs existentes en pertinencia_acad antes de usar
                $validRows = [];
                if (count($idsMulti)) {
                    $validRows = PertinenciaAcad::whereIn('id', $idsMulti)
                        ->get(['id', 'nombre_pert'])
                        ->map(function ($row) {
                            return ['id' => $row->id, 'nombre' => $row->nombre_pert];
                        })
                        ->toArray();
                    $idsMulti = array_column($validRows, 'id');
                }
                if (!is_null($primaryId) && !in_array($primaryId, $idsMulti, true)) {
                    $fallback = PertinenciaAcad::find($primaryId);
                    if ($fallback) {
                        $idsMulti[] = $fallback->id;
                        $validRows[] = ['id' => $fallback->id, 'nombre' => $fallback->nombre_pert];
                    } else {
                        $primaryId = count($idsMulti) ? $idsMulti[0] : null;
                    }
                }

                // Resolver nombre(s) de pertinencia
                $pertNom = isset($i['pertinencia']) ? $i['pertinencia'] : null;
                if (!$pertNom) {
                    if (count($validRows)) {
                        $pertNom = implode(', ', array_filter(array_column($validRows, 'nombre')));
                    } elseif (!is_null($primaryId)) {
                        $single = PertinenciaAcad::find($primaryId);
                        if ($single && $single->nombre_pert) {
                            $pertNom = $single->nombre_pert;
                        }
                    }
                }

                // Construir data para Tutor
                $snapBase = [ 'ci' => $ci ];
                if (isset($i['nombre'])) $snapBase['nombre'] = $i['nombre'];
                if (isset($i['apellido_p'])) $snapBase['apellido_p'] = $i['apellido_p'];
                if (isset($i['apellido_m'])) $snapBase['apellido_m'] = $i['apellido_m'];
                if (isset($i['celular'])) $snapBase['celular'] = $i['celular'];
                if (isset($i['titulo'])) {
                    $snapBase['titulo'] = $i['titulo'];
                } elseif (isset($i['profesion'])) {
                    $snapBase['titulo'] = $i['profesion'];
                }
                if (isset($i['cod_carrera'])) $snapBase['cod_carrera'] = $i['cod_carrera'];
                if (!is_null($primaryId)) $snapBase['pertinencia_acad_id'] = $primaryId;
                if (!is_null($pertNom)) $snapBase['pertinencia_nom'] = $pertNom;
                if (isset($i['tipo_tutor_id'])) $snapBase['tipo_tutor_id'] = (int)$i['tipo_tutor_id'];

                $existing = Tutor::whereRaw('TRIM(UPPER(ci)) = ?', [$ci])->first();
                if ($existing) {
                    if (array_key_exists('activo', $i)) {
                        $snapBase['activo'] = (bool)$i['activo'];
                    }
                    $existing->fill($snapBase);
                    $existing->save();
                    // Sincronizar multi-pertinencias si se envía el arreglo
                    if (array_key_exists('pertinencia_acad_ids', $i)) {
                        $existing->pertinencias()->sync($idsMulti);
                    }
                    $updated++;
                    $tutor = $existing;
                } else {
                    if ($updateOnly) {
                        // No crear nuevos cuando update_only está activo
                        $skipped++;
                        continue;
                    }
                    $snapBase['activo'] = array_key_exists('activo', $i) ? (bool)$i['activo'] : true;
                    // Crear
                    $tutor = Tutor::create($snapBase);
                    // Registrar multi-pertinencias
                    if (count($idsMulti)) {
                        $tutor->pertinencias()->sync($idsMulti);
                    } elseif (!is_null($primaryId)) {
                        $tutor->pertinencias()->sync([$primaryId]);
                    }
                    $created++;
                }

                $result[] = $tutor->toArray();
            }

            DB::commit();
            return response()->json([
                'success' => true,
                'message' => 'Tutores registrados/actualizados correctamente',
                'data' => $result,
                'counts' => [ 'created' => $created, 'updated' => $updated, 'skipped' => $skipped ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Error al registrar tutores',
            ], 500);
        }
    }

    /** Actualizar datos del tutor (incluye tipo_tutor_id obligatorio para activación) */
    public function update(Request $request, int $id)
    {
        $tutor = Tutor::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'nombre' => 'sometimes|string|max:150',
            'apellido_p' => 'sometimes|nullable|string|max:150',
            'apellido_m' => 'sometimes|nullable|string|max:150',
            'celular' => 'sometimes|nullable|string|max:50',
            'cod_carrera' => 'sometimes|nullable|string|max:10',
            'pertinencia_acad_id' => 'sometimes|nullable|integer|exists:pertinencia_acad,id',
            'titulo' => 'sometimes|nullable|string|max:255',
            'tipo_tutor_id' => 'required|integer|exists:tipo_tutor,id',
        ]);
        if ($validator->fails()) {
            return response()->json(['success' => false, 'errors' => $validator->errors()], 422);
        }
        $data = $validator->validated();
        $tutor->fill($data);
        $tutor->save();
        return response()->json(['success' => true, 'data' => $tutor]);
    }

    /** Alternar estado activo del tutor, validando datos completos */
    public function toggle(Request $request, int $id)
    {
        $tutor = Tutor::with('pertinencias')->findOrFail($id);
        $activo = (bool)$request->boolean('activo', !$tutor->activo);
        if ($activo) {
            // Validaciones para habilitar: tipo y pertinencia presentes
            $hasTipo = !is_null($tutor->tipo_tutor_id);
            $hasPert = $tutor->pertinencia_acad_id != null || ($tutor->pertinencias && $tutor->pertinencias->count() > 0);
            if (!$hasTipo || !$hasPert) {
                return response()->json([
                    'success' => false,
                    'message' => 'No se puede habilitar: requiere Tipo de Tutor y Pertinencia académica',
                ], 422);
            }
        }
        $tutor->activo = $activo;
        $tutor->save();
        return response()->json(['success' => true, 'data' => ['id' => $tutor->id, 'activo' => (bool)$tutor->activo]]);
    }

    /** Catálogo de tipos de tutor */
    public function tipos()
    {
        $tipos = TipoTutor::where('is_active', true)->orderBy('nombre')->get(['id','nombre','is_active']);
        return response()->json(['success' => true, 'data' => $tipos]);
    }

    /**
     * Designar un tutor a un estudiante (y opcionalmente a un proyecto/tema)
     * Body esperado: { tutor_id: number, cod_ceta: number, proyecto_id?: number }
     */
    public function designar(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tutor_id' => 'required|integer|exists:tutores,id',
            'cod_ceta' => 'required|integer|exists:postulantes,cod_ceta',
            'proyecto_id' => 'nullable|integer|exists:proyecto,id',
            'convocatoria_id' => 'nullable|integer|exists:convocatorias,id',
            'convocatoria_nom' => 'nullable|string|max:150',
            'area' => 'nullable|string|max:255',
            'user_id' => 'nullable|integer',
            'user_name' => 'nullable|string|max:150',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        $userIdFromPayload = isset($data['user_id']) ? (int) $data['user_id'] : null;
        unset($data['user_id']);

        $authUser = $request->user();
        $authUserId = $userIdFromPayload !== null
            ? $userIdFromPayload
            : ($authUser ? (int) $authUser->id : null);
        if ($authUserId !== null) {
            $existsUser = DB::table('users')->where('id', $authUserId)->exists();
            if (!$existsUser) {
                $authUserId = null;
            }
        }
        $authUserName = null;
        if ($authUser) {
            if (!empty($authUser->nombre_usuario)) {
                $authUserName = $authUser->nombre_usuario;
            } elseif (!empty($authUser->name)) {
                $authUserName = $authUser->name;
            } elseif (!empty($authUser->email)) {
                $authUserName = $authUser->email;
            }
            if (!$authUserName) {
                $resolvedName = DB::table('usuario')
                    ->where('id', $authUser->id)
                    ->value(DB::raw("TRIM(CONCAT(IFNULL(nombre,''),' ',IFNULL(apellido_p,''),' ',IFNULL(apellido_m,'')))"));
                if ($resolvedName) {
                    $authUserName = trim($resolvedName);
                }
            }
        }

        if (!empty($data['user_name'])) {
            $authUserName = $data['user_name'];
        }

        DB::beginTransaction();
        try {
            $now = Carbon::now();

            // Asegurar unicidad por proyecto si se envía
            if (!empty($data['proyecto_id'])) {
                $exist = DB::table('designacion_tutor')
                    ->where('proyecto_id', $data['proyecto_id'])
                    ->first();
                if ($exist && ($exist->tutor_id != $data['tutor_id'] || $exist->cod_ceta != $data['cod_ceta'])) {
                    DB::table('designacion_tutor')->where('id', $exist->id)->delete();
                }
            }

            // Fallback de nombres (por si los triggers no están disponibles)
            $p = DB::table('postulantes')->where('cod_ceta', $data['cod_ceta'])
                ->first(['nombres_est', 'ap_pat', 'ap_mat']);
            $t = DB::table('tutores')->where('id', $data['tutor_id'])
                ->first(['nombre', 'apellido_p', 'apellido_m']);
            $estNombre = $p ? trim(implode(' ', array_filter([$p->nombres_est, $p->ap_pat, $p->ap_mat]))) : null;
            $tutNombre = $t ? trim(implode(' ', array_filter([$t->nombre, $t->apellido_p, $t->apellido_m]))) : null;

            $updateData = [
                'proyecto_id' => (isset($data['proyecto_id']) ? $data['proyecto_id'] : null),
                'fecha_designacion' => $now->toDateString(),
                'convocatoria_id' => isset($data['convocatoria_id']) ? $data['convocatoria_id'] : null,
                'convocatoria_nom' => isset($data['convocatoria_nom']) ? $data['convocatoria_nom'] : null,
                'area' => isset($data['area']) && trim((string)$data['area']) !== '' ? trim((string)$data['area']) : null,
                'tutor_nombre' => $tutNombre,
                'estudiante_nombre' => $estNombre,
                'updated_at' => $now,
                'created_at' => $now,
            ];

            if ($authUserId !== null) {
                $updateData['user_id'] = $authUserId;
            } else {
                $updateData['user_id'] = null;
            }
            if ($authUserName !== null) {
                $updateData['user_name'] = $authUserName;
            }

            DB::table('designacion_tutor')->updateOrInsert(
                [
                    'tutor_id' => $data['tutor_id'],
                    'cod_ceta' => $data['cod_ceta'],
                ],
                $updateData
            );

            $baseRow = DB::table('designacion_tutor as dt')
                ->leftJoin('tutores as t', 'dt.tutor_id', '=', 't.id')
                ->leftJoin('tipo_tutor as tt', 't.tipo_tutor_id', '=', 'tt.id')
                ->leftJoin('proyecto', 'dt.proyecto_id', '=', 'proyecto.id')
                ->select(
                    'dt.*',
                    'tt.nombre as tipo_tutor_nombre',
                    't.titulo as tutor_titulo_base',
                    'proyecto.nombre as proyecto_nombre'
                )
                ->where('dt.tutor_id', $data['tutor_id'])
                ->where('dt.cod_ceta', $data['cod_ceta'])
                ->first();

            if (!$baseRow) {
                throw new \RuntimeException('No se pudo recuperar la designación recién creada.');
            }

            [$docRecord, $numeroDocumento, $cite] = $this->ensureDocDesignacion($baseRow, $tutNombre ?? '', $estNombre ?? '');

            DB::commit();

            $row = DB::table('designacion_tutor as dt')
                ->leftJoin('tutores as t', 'dt.tutor_id', '=', 't.id')
                ->leftJoin('tipo_tutor as tt', 't.tipo_tutor_id', '=', 'tt.id')
                ->leftJoin('doc_designaciones as dd', 'dd.designacion_tutor_id', '=', 'dt.id')
                ->select(
                    'dt.*',
                    'tt.nombre as tipo_tutor_nombre',
                    'dd.doc_tipo as doc_doc_tipo',
                    'dd.year as doc_year',
                    'dd.correlativo as doc_correlativo',
                    'dd.cite as doc_cite',
                    'dd.para_nombre as doc_para_nombre',
                    'dd.para_cargo as doc_para_cargo',
                    'dd.de_nombre as doc_de_nombre',
                    'dd.de_cargo as doc_de_cargo',
                    'dd.asunto as doc_asunto',
                    'dd.introduccion as doc_introduccion',
                    'dd.cronograma_inicio as doc_cronograma_inicio',
                    'dd.cronograma_fin as doc_cronograma_fin',
                    'dd.cierre as doc_cierre',
                    'dd.pie_notas as doc_pie_notas',
                    'dd.tutor_nombre as doc_tutor_nombre',
                    'dd.tutor_titulo as doc_tutor_titulo',
                    'dd.estudiantes_resumen as doc_estudiantes_resumen'
                )
                ->where('dt.tutor_id', $data['tutor_id'])
                ->where('dt.cod_ceta', $data['cod_ceta'])
                ->first();

            if ($row) {
                $row->designacion_id = $row->id ?? null;
                $row->numero_documento = $this->normalizeNumero($row->doc_correlativo ?? null) ?? $numeroDocumento;
                $row->cite = $row->doc_cite ?? $cite;
                $row->doc_para_cargo = $row->doc_para_cargo ?: self::DOC_PARA_CARGO;
                $row->doc_de_nombre = $row->doc_de_nombre ?: self::DOC_DE_NOMBRE;
                $row->doc_de_cargo = $row->doc_de_cargo ?: self::DOC_DE_CARGO;
                $row->doc_asunto = $row->doc_asunto ?: self::DOC_ASUNTO;
                $row->doc_introduccion = $row->doc_introduccion ?: self::DOC_INTRO_TEXT;
                $row->doc_pie_notas = $this->decodeJsonColumn($row->doc_pie_notas ?? null) ?: self::DOC_PIE_NOTAS;
                $row->doc_estudiantes_resumen = $this->decodeJsonColumn($row->doc_estudiantes_resumen ?? null);
                if (!$row->doc_para_nombre && isset($docRecord->para_nombre)) {
                    $row->doc_para_nombre = $docRecord->para_nombre;
                }
                if (!$row->doc_para_cargo && isset($docRecord->para_cargo)) {
                    $row->doc_para_cargo = $docRecord->para_cargo;
                }
                if (!$row->doc_de_nombre && isset($docRecord->de_nombre)) {
                    $row->doc_de_nombre = $docRecord->de_nombre;
                }
                if (!$row->doc_de_cargo && isset($docRecord->de_cargo)) {
                    $row->doc_de_cargo = $docRecord->de_cargo;
                }
                if (!$row->doc_asunto && isset($docRecord->asunto)) {
                    $row->doc_asunto = $docRecord->asunto;
                }
                if (!$row->doc_introduccion && isset($docRecord->introduccion)) {
                    $row->doc_introduccion = $docRecord->introduccion;
                }
                if (!$row->doc_tutor_nombre && isset($docRecord->tutor_nombre)) {
                    $row->doc_tutor_nombre = $docRecord->tutor_nombre;
                }
                if (!$row->doc_tutor_titulo && isset($docRecord->tutor_titulo)) {
                    $row->doc_tutor_titulo = $docRecord->tutor_titulo;
                }
                if (!$row->doc_pie_notas && isset($docRecord->pie_notas)) {
                    $row->doc_pie_notas = $docRecord->pie_notas;
                }
                if (!$row->doc_estudiantes_resumen && isset($docRecord->estudiantes_resumen)) {
                    $row->doc_estudiantes_resumen = $docRecord->estudiantes_resumen;
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Tutor designado correctamente',
                'data' => $row,
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Error al designar tutor', [
                'payload' => $request->all(),
                'exception' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Error al designar tutor',
            ], 500);
        }
    }
}
