<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Carbon\Carbon;
use App\Models\Tutor;
use App\Models\PertinenciaAcad;
use App\Models\TipoTutor;
use App\Models\DesignacionTutor;
use App\Services\SocratesApiService;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\Shared\Converter;
use PhpOffice\PhpWord\TemplateProcessor;

class TutorController extends Controller
{
    protected static $docIntroText = 'En cumplimiento al Reglamento de Modalidades de Graduación de Institutos Técnicos y Tecnológicos de Carácter Fiscal, de Convenio y Privado aprobado por la Resolución Ministerial Nº 0487/2023 del 14 de junio de 2023 y del Reglamento Interno de Modalidades de Graduación del Instituto “CETA”, la Dirección Académica del Instituto, lo designa como Tutor para Defensas de Grado de los siguientes estudiantes:';
    protected static $docParaCargo = 'DOCENTE TÉCNICO';
    protected static $docDeNombre = 'Ing. Bradley Jaillita Burgoa';
    protected static $docDeCargo = 'DIRECTOR ACADÉMICO';
    protected static $docAsunto = 'DESIGNACIÓN COMO TUTOR PARA PROYECTOS DE DEFENSA DE GRADO';
    protected static $docPieNotas = ['BJB', 'CC: REC/DA'];

    public function docDesignacionesByCorrelativo($correlativo)
    {
        $normalized = $this->normalizeNumero($correlativo);
        if (!$normalized) {
            return response()->json([
                'success' => false,
                'message' => 'Correlativo inválido',
                'data' => [],
            ], 400);
        }

        $docs = DB::table('doc_designaciones as dd')
            ->join('designacion_tutor as dt', 'dd.designacion_tutor_id', '=', 'dt.id')
            ->leftJoin('tutores as t', 'dt.tutor_id', '=', 't.id')
            ->leftJoin('tipo_tutor', 't.tipo_tutor_id', '=', 'tipo_tutor.id')
            ->leftJoin('convocatorias as c', 'dt.convocatoria_id', '=', 'c.id')
            ->leftJoin('postulantes as p', 'dt.cod_ceta', '=', 'p.cod_ceta')
            ->leftJoin('proyecto as pr', 'dt.proyecto_id', '=', 'pr.id')
            ->select([
                'dd.id as doc_id',
                'dd.doc_tipo',
                'dd.year',
                'dd.correlativo',
                'dd.cite',
                'dd.para_nombre',
                'dd.para_cargo',
                'dd.de_nombre',
                'dd.de_cargo',
                'dd.asunto',
                'dd.introduccion',
                'dd.cronograma_inicio',
                'dd.cronograma_fin',
                'dd.cierre',
                'dd.pie_notas',
                'dd.tutor_nombre as doc_tutor_nombre',
                'dd.tutor_titulo as doc_tutor_titulo',
                'dd.estudiantes_resumen',
                'dd.created_at as doc_created_at',
                'dd.updated_at as doc_updated_at',
                'dt.id as designacion_id',
                'dt.tutor_id',
                'dt.cod_ceta',
                'dt.proyecto_id',
                'dt.fecha_designacion',
                'dt.area as designacion_area',
                'dt.convocatoria_id',
                'dt.convocatoria_nom as designacion_convocatoria_nom',
                'dt.estudiante_nombre as designacion_estudiante_nom',
                'dt.tutor_nombre as designacion_tutor_nom',
                't.nombre as tutor_nombre',
                't.apellido_p as tutor_apellido_p',
                't.apellido_m as tutor_apellido_m',
                't.celular as tutor_celular',
                't.ci as tutor_ci',
                't.titulo as tutor_titulo',
                't.titulo_academico as tutor_titulo_academico',
                't.cod_carrera',
                'tipo_tutor.id as tipo_tutor_id',
                'tipo_tutor.nombre as tipo_tutor_nombre',
                'c.nombre as convocatoria_nombre',
                'c.numero_convocatoria as convocatoria_numero',
                'c.anio as convocatoria_anio',
                'c.fecha_inicio as convocatoria_fecha_inicio',
                'c.fecha_fin as convocatoria_fecha_fin',
                'p.nombres_est as postulante_nombres',
                'p.ap_pat as postulante_ap_pat',
                'p.ap_mat as postulante_ap_mat',
                DB::raw("TRIM(CONCAT(IFNULL(p.ap_pat,''),' ',IFNULL(p.ap_mat,''),' ',IFNULL(p.nombres_est,''))) AS postulante_nombre_completo"),
                'pr.nombre as proyecto_nombre',
            ])
            ->where('dd.correlativo', (int) $normalized)
            ->orderBy('dd.id')
            ->get();

        if ($docs->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => [],
            ]);
        }

        $first = $docs->first();

        $tutorNombreResolved = trim(implode(' ', array_filter([
            $first->doc_tutor_nombre,
            $first->tutor_nombre,
            $first->tutor_apellido_p,
            $first->tutor_apellido_m,
        ])));
        $tutorNombreResolved = $tutorNombreResolved ?: null;

        $estudiantes = [];
        foreach ($docs as $row) {
            $resumen = $this->decodeJsonColumn($row->estudiantes_resumen);
            if (is_array($resumen) && !empty($resumen)) {
                foreach ($resumen as $est) {
                    $estudiantes[] = $est;
                }
            } else {
                $estudiantes[] = [
                    'cod_ceta' => $row->cod_ceta,
                    'estudiante_nombre' => $row->designacion_estudiante_nom ?: $row->postulante_nombre_completo,
                    'carrera' => $row->cod_carrera,
                    'modalidad' => $row->designacion_convocatoria_nom,
                    'area' => $row->designacion_area,
                    'proyecto_nombre' => $row->proyecto_nombre,
                    'fecha_designacion' => $row->fecha_designacion,
                ];
            }
        }

        $response = [
            'success' => true,
            'data' => [
                'correlativo' => $normalized,
                'doc_tipo' => $first->doc_tipo,
                'year' => $first->year,
                'cite' => $first->cite,
                'tutor_nombre' => $tutorNombreResolved,
                'tutor_ci' => $first->tutor_ci,
                'tutor_celular' => $first->tutor_celular,
                'tutor_titulo' => $first->tutor_titulo ?: $first->doc_tutor_titulo,
                'tutor_titulo_academico' => $first->tutor_titulo_academico,
                'tipo_tutor_nombre' => $first->tipo_tutor_nombre,
                'convocatoria_id' => $first->convocatoria_id,
                'convocatoria_nombre' => $first->convocatoria_nombre,
                'convocatoria_numero' => $first->convocatoria_numero,
                'convocatoria_anio' => $first->convocatoria_anio,
                'convocatoria_fecha_inicio' => $first->convocatoria_fecha_inicio,
                'convocatoria_fecha_fin' => $first->convocatoria_fecha_fin,
                'estudiantes' => $this->mergeEstudiantesResumen($estudiantes),
                'pie_notas' => $this->decodeJsonColumn($first->pie_notas) ?: static::$docPieNotas,
                'para_nombre' => $first->para_nombre ?: $tutorNombreResolved,
                'para_cargo' => $first->para_cargo ?: static::$docParaCargo,
                'de_nombre' => $first->de_nombre ?: static::$docDeNombre,
                'de_cargo' => $first->de_cargo ?: static::$docDeCargo,
                'asunto' => $first->asunto ?: static::$docAsunto,
                'introduccion' => $first->introduccion ?: static::$docIntroText,
                'cronograma_inicio' => $first->cronograma_inicio,
                'cronograma_fin' => $first->cronograma_fin,
            ],
        ];

        return response()->json($response);
    }

    public function planillaSeguimientoDocx($codCeta)
    {
        $select = [
            'dt.cod_ceta',
            'dt.area',
            'dt.tutor_nombre',
            'dt.fecha_designacion',
            'p.nombres_est',
            'p.ap_pat',
            'p.ap_mat',
            'p.apellidos_est',
            'pr.nombre as proyecto_nombre',
            't.titulo_academico as tutor_titulo_academico',
            't.nombre as t_nom',
            't.apellido_p as t_ap',
            't.apellido_m as t_am',
            DB::raw('COALESCE(p.carrera, carrera.nombre_carrera) as carrera_nombre'),
            DB::raw('COALESCE(c2.anio, c.anio) as convocatoria_anio'),
            DB::raw('COALESCE(c2.numero_convocatoria, c.numero_convocatoria) as convocatoria_numero'),
            DB::raw('COALESCE(c2.fecha_fin, c.fecha_fin) as convocatoria_fecha_fin'),
            DB::raw('COALESCE(c2.mes_defensa, c.mes_defensa) as convocatoria_mes_defensa'),
        ];
        $celParts = [];
        if (Schema::hasColumn('postulantes', 'celular')) {
            $celParts[] = 'p.celular';
        }
        if (Schema::hasColumn('proyecto', 'celular')) {
            $celParts[] = 'pr.celular';
        }
        if (!empty($celParts)) {
            $expr = count($celParts) > 1 ? ('COALESCE(' . implode(', ', $celParts) . ')') : $celParts[0];
            $select[] = DB::raw($expr . ' as postulante_celular');
        }
        if (Schema::hasTable('inscrip_modalidad') && Schema::hasColumn('inscrip_modalidad', 'nro_postulante')) {
            $select[] = DB::raw('im.nro_postulante as nro_postulante');
        }
        $row = DB::table('designacion_tutor as dt')
            ->leftJoin('postulantes as p', 'dt.cod_ceta', '=', 'p.cod_ceta')
            ->leftJoin('proyecto as pr', 'dt.proyecto_id', '=', 'pr.id')
            ->leftJoin('tutores as t', 'dt.tutor_id', '=', 't.id')
            ->leftJoin('carrera', 't.cod_carrera', '=', 'carrera.cod_carrera')
            ->leftJoin('inscrip_modalidad as im', 'im.cod_ceta_est', '=', 'dt.cod_ceta')
            ->leftJoin('convocatorias as c', 'dt.convocatoria_id', '=', 'c.id')
            ->leftJoin('convocatorias as c2', 'im.convocatoria_id', '=', 'c2.id')
            ->select($select)
            ->where('dt.cod_ceta', is_numeric($codCeta) ? (int)$codCeta : $codCeta)
            ->orderByDesc('dt.id')
            ->first();

        if (!$row) {
            return response()->json(['message' => 'Designación no encontrada'], 404);
        }

        $estNombre = null;
        if (isset($row->ap_pat) || isset($row->ap_mat)) {
            $estNombre = trim(implode(' ', array_filter([$row->ap_pat ?? '', $row->ap_mat ?? '', $row->nombres_est ?? ''])));
        } elseif (isset($row->apellidos_est)) {
            $estNombre = trim(implode(' ', array_filter([$row->apellidos_est ?? '', $row->nombres_est ?? ''])));
        } else {
            $estNombre = (string) ($row->nombres_est ?? '');
        }

        $tutorPlano = $row->tutor_nombre ?: trim(implode(' ', array_filter([$row->t_nom ?? null, $row->t_ap ?? null, $row->t_am ?? null])));
        $tutorNombre = $row->tutor_titulo_academico ? trim($row->tutor_titulo_academico . ' ' . $tutorPlano) : $tutorPlano;

        $gestion = null;
        if (isset($row->convocatoria_anio) && isset($row->convocatoria_numero)) {
            $roman = ((int)$row->convocatoria_numero) === 1 ? 'I' : 'II';
            $gestion = $roman . '/' . (string)$row->convocatoria_anio;
        }

        $defensaMes = null;
        try {
            if (!empty($row->convocatoria_mes_defensa)) {
                $md = trim((string)$row->convocatoria_mes_defensa);
                if ($md !== '') {
                    $carbon = \Carbon\Carbon::createFromFormat('Y-m', $md)->startOfMonth();
                    $defensaMes = $carbon->locale('es')->isoFormat('MMMM');
                }
            }
            if (!$defensaMes) {
                $fechaBase = $row->convocatoria_fecha_fin ?: $row->fecha_designacion;
                if ($fechaBase) {
                    $defensaMes = \Carbon\Carbon::parse($fechaBase)->locale('es')->isoFormat('MMMM');
                }
            }
            if ($defensaMes) {
                $defensaMes = mb_strtoupper($defensaMes, 'UTF-8');
            }
        } catch (\Throwable $e) {
        }

        // Celular del postulante: prioridad DB (postulantes/proyecto) y fallback al SGA
        $postulanteCel = '';
        if (isset($row->postulante_celular)) {
            $postulanteCel = trim((string)$row->postulante_celular);
        }
        if ($postulanteCel === '') {
            try {
                /** @var SocratesApiService $sga */
                $sga = app(\App\Services\SocratesApiService::class);
                $carreraNombre = isset($row->carrera_nombre) ? (string)$row->carrera_nombre : null;
                $res = $sga->getEstudianteByCodigo((string)$row->cod_ceta, $carreraNombre);
                if (is_array($res) && !empty($res['success']) && !empty($res['data']) && is_array($res['data'])) {
                    $first = $res['data'][0] ?? [];
                    if (is_array($first)) {
                        $cand = isset($first['celular']) ? trim((string)$first['celular']) : '';
                        if ($cand !== '') { $postulanteCel = $cand; }
                    }
                }
            } catch (\Throwable $e) {
                // Ignorar errores del SGA; nos quedamos con vacío si no hay datos
            }
        }

        // Intentar generar desde plantilla si existe
        $nroPostulante = isset($row->nro_postulante) ? $row->nro_postulante : null;
        $apellidosDoc = '';
        if (isset($row->ap_pat) || isset($row->ap_mat)) {
            $apellidosDoc = trim(implode(' ', array_filter([$row->ap_pat ?? '', $row->ap_mat ?? ''])));
        } elseif (isset($row->apellidos_est)) {
            $apellidosDoc = trim((string)$row->apellidos_est);
        }
        $templatePath = resource_path('templates/planilla_seguimiento.docx');
        if (is_string($templatePath) && file_exists($templatePath)) {
            try {
                $tpl = new TemplateProcessor($templatePath);
                $tpl->setValue('NOMBRES', (string)($row->nombres_est ?? ''));
                $tpl->setValue('APELLIDOS', (string)$apellidosDoc);
                $tpl->setValue('CODIGO_CETA', (string)$row->cod_ceta);
                $tpl->setValue('NRO_POSTULANTE', (string)($nroPostulante ?? ''));
                $tpl->setValue('AREA_INVESTIGACION', (string)($row->area ?? ''));
                $tpl->setValue('GESTION', (string)($gestion ?? ''));
                $tpl->setValue('CARRERA', (string)($row->carrera_nombre ?? ''));
                $tpl->setValue('CEL', (string)$postulanteCel);
                $tpl->setValue('DEFENSA_MES', (string)($defensaMes ?? ''));
                $tpl->setValue('TITULO_PROYECTO', (string)($row->proyecto_nombre ?? ''));
                $tpl->setValue('TUTOR', (string)$tutorNombre);

                // Logo opcional si en la plantilla existe el marcador ${LOGO}
                $logoPath = null;
                foreach ([public_path('images/logo_ceta.png'), public_path('logo_ceta.png'), storage_path('app/public/logo_ceta.png')] as $candidate) {
                    if ($logoPath === null && is_string($candidate) && file_exists($candidate)) {
                        $logoPath = $candidate;
                    }
                }
                if ($logoPath && method_exists($tpl, 'setImageValue')) {
                    try { $tpl->setImageValue('LOGO', ['path' => $logoPath, 'width' => 90]); } catch (\Throwable $e) {}
                }

                $path = storage_path('app/tmp');
                if (!is_dir($path)) { @mkdir($path, 0777, true); }
                $fileName = 'planilla-seguimiento-' . (string)$row->cod_ceta . '.docx';
                $temp = $path . DIRECTORY_SEPARATOR . $fileName;
                $tpl->saveAs($temp);
                return response()->download($temp, $fileName, [
                    'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ])->deleteFileAfterSend(true);
            } catch (\Throwable $e) {
                // Si falla la plantilla, continuar con el generador programático
            }
        }

        $phpWord = new PhpWord();
        $phpWord->setDefaultFontName('Calibri');
        $phpWord->setDefaultFontSize(10);

        $section = $phpWord->addSection([
            'marginLeft' => Converter::cmToTwip(3),
            'marginRight' => Converter::cmToTwip(2.5),
            'marginTop' => Converter::cmToTwip(2),
            'marginBottom' => Converter::cmToTwip(2),
        ]);

        // Encabezado: banda azul con logo (opcional) a la izquierda y títulos centrados
        $headerBand = $section->addTable(['borderSize' => 6, 'borderColor' => '0b2a56', 'cellMargin' => 80]);
        $headerBand->addRow(1000);
        $leftHeaderCell = $headerBand->addCell(1400, ['bgColor' => '0b2a56', 'valign' => 'center']);
        // Buscar logo en rutas conocidas (no obligatorio)
        $logoPath = null;
        foreach ([public_path('images/logo_ceta.png'), public_path('logo_ceta.png'), storage_path('app/public/logo_ceta.png')] as $candidate) {
            if ($logoPath === null && is_string($candidate) && file_exists($candidate)) {
                $logoPath = $candidate;
            }
        }
        if ($logoPath) {
            try { $leftHeaderCell->addImage($logoPath, ['width' => 90, 'alignment' => 'left']); } catch (\Throwable $e) {}
        }
        $rightHeaderCell = $headerBand->addCell(7600, ['bgColor' => '0b2a56', 'valign' => 'center']);
        $rightHeaderCell->addText('PLANILLA DE SEGUIMIENTO DE AVANCE', ['bold' => false, 'size' => 20, 'color' => 'FFFFFF'], ['alignment' => 'center']);
        $rightHeaderCell->addText('DEFENSA DE GRADO', ['bold' => false, 'size' => 20, 'color' => 'FFFFFF'], ['alignment' => 'center']);

        $header = $section->addTable(['borderSize' => 6, 'borderColor' => 'b9c2cf', 'cellMargin' => 80]);
        $labelStyle = ['bold' => true, 'size' => 10,'color' => '0b2a56'];
        $wLabel = 1400; $wVal = 1600; // 1400+1600 = 3000 x 3 pares = 9000

        // Fila 1: NOMBRES | CÓDIGO CETA | N° DE POSTULANTE
        $header->addRow();
        $header->addCell($wLabel)->addText('NOMBRES:', $labelStyle);
        $header->addCell($wVal)->addText((string)($row->nombres_est ?? ''));
        $header->addCell($wLabel)->addText('CÓDIGO CETA:', $labelStyle);
        $header->addCell($wVal)->addText((string)$row->cod_ceta);
        $header->addCell($wLabel)->addText('N° DE POSTULANTE:', $labelStyle);
        $header->addCell($wVal)->addText((string)($nroPostulante ?? ''));

        // Fila 2: APELLIDOS | ÁREA DE INVESTIGACIÓN | GESTIÓN
        $apellidos = '';
        if (isset($row->ap_pat) || isset($row->ap_mat)) {
            $apellidos = trim(implode(' ', array_filter([$row->ap_pat ?? '', $row->ap_mat ?? ''])));
        } elseif (isset($row->apellidos_est)) {
            $apellidos = trim((string)$row->apellidos_est);
        }
        $header->addRow();
        $header->addCell($wLabel)->addText('APELLIDOS:', $labelStyle);
        $header->addCell($wVal)->addText($apellidos);
        $header->addCell($wLabel)->addText('ÁREA DE INVESTIGACIÓN:', $labelStyle);
        $header->addCell($wVal)->addText((string)($row->area ?? ''));
        $header->addCell($wLabel)->addText('GESTIÓN:', $labelStyle);
        $header->addCell($wVal)->addText((string)($gestion ?? ''));

        // Fila 3: CARRERA | CEL. | DEFENSA CORRESPONDIENTE A
        $header->addRow();
        $header->addCell($wLabel)->addText('CARRERA:', $labelStyle);
        $header->addCell($wVal)->addText((string)($row->carrera_nombre ?? ''));
        $header->addCell($wLabel)->addText('CEL.:', $labelStyle);
        $header->addCell($wVal)->addText((string)$postulanteCel);
        $header->addCell($wLabel)->addText('DEFENSA CORRESPONDIENTE A:', $labelStyle);
        $header->addCell($wVal)->addText((string)($defensaMes ?? ''));

        // Título del proyecto (encabezado gris + contenido en gris claro)
        $projTbl = $section->addTable(['borderSize' => 6, 'borderColor' => 'b9c2cf', 'cellMargin' => 80]);
        $projTbl->addRow();
        $projTbl->addCell(9000, ['bgColor' => 'dddddd'])->addText('TÍTULO DEL PROYECTO DE INVESTIGACIÓN', ['bold' => true, 'size' => 10], ['alignment' => 'center']);
        $projTbl->addRow();
        $projTbl->addCell(9000, ['bgColor' => 'eeeeee'])->addText((string)($row->proyecto_nombre ?? ''), ['size' => 10], ['alignment' => 'center']);

        $info = $section->addTable(['borderSize' => 6, 'borderColor' => 'b9c2cf', 'cellMargin' => 80]);
        $info->addRow();
        $info->addCell(2200)->addText('SEGUIMIENTO', ['bold' => true]);
        $info->addCell(3700)->addText('');
        $info->addCell(1200)->addText('TUTOR:', ['bold' => true]);
        $info->addCell(1900)->addText((string)$tutorNombre);

        $tbl = $section->addTable(['borderSize' => 6, 'borderColor' => '0b2a56', 'cellMargin' => 80]);
        $tbl->addRow();
        foreach (['N°', 'FECHA DE REVISIÓN', 'CONTENIDO DE TÍTULOS', 'OBSERVACIONES', 'FECHA DE CORRECCIÓN', 'FIRMA DE CONFORMIDAD'] as $th) {
            $tbl->addCell(1500, ['bgColor' => '0b2a56'])->addText($th, ['bold' => true, 'color' => 'FFFFFF']);
        }

        $addSectionRow = function ($label) use ($tbl) {
            $tbl->addRow();
            $tbl->addCell(9000, ['gridSpan' => 6, 'bgColor' => 'c9daf8'])->addText($label, ['bold' => true]);
        };

        $items = [
            ['header' => 'FORMATO INICIAL'],
            ['n' => 1, 'txt' => 'Carátula o portada'],
            ['n' => 2, 'txt' => 'Dedicatoria'],
            ['n' => 3, 'txt' => 'Agradecimientos'],
            ['n' => 4, 'txt' => 'Índice'],
            ['n' => 5, 'txt' => 'Resumen'],
            ['n' => 6, 'txt' => 'Introducción'],
            ['header' => 'CAPÍTULO “I” PLANTEAMIENTO DEL PROBLEMA'],
            ['n' => 7, 'txt' => 'Diagnóstico y justificación'],
            ['n' => 8, 'txt' => 'Planteamiento del problema'],
            ['n' => 9, 'txt' => 'Formulación del problema'],
            ['n' => 10, 'txt' => 'Objetivo general'],
            ['n' => 11, 'txt' => 'Objetivos específicos'],
            ['n' => 12, 'txt' => 'Enfoque metodológico'],
            ['header' => 'CAPÍTULO “II” MARCO TEÓRICO CONCEPTUAL'],
            ['n' => 13, 'txt' => 'Marco teórico'],
            ['header' => 'CAPÍTULO “III” PROPUESTA DE INNOVACIÓN O SOLUCIÓN DEL PROBLEMA'],
            ['n' => 14, 'txt' => 'Pruebas realizadas'],
            ['n' => 15, 'txt' => 'Análisis de resultados'],
            ['header' => 'CAPÍTULO “IV” CONCLUSIONES Y RECOMENDACIONES'],
            ['n' => 16, 'txt' => 'Conclusiones'],
            ['n' => 17, 'txt' => 'Recomendaciones'],
            ['n' => 18, 'txt' => 'Bibliografía (Fuentes de información)'],
            ['n' => 19, 'txt' => 'Anexos'],
        ];

        foreach ($items as $it) {
            if (isset($it['header'])) {
                $addSectionRow($it['header']);
                continue;
            }
            $tbl->addRow();
            $tbl->addCell(800)->addText((string)$it['n']);
            $tbl->addCell(1800)->addText('');
            $tbl->addCell(3000)->addText($it['txt']);
            $tbl->addCell(2200)->addText('');
            $tbl->addCell(1800)->addText('');
            $tbl->addCell(1800)->addText('');
        }

        $section->addText('NOTA:', ['bold' => true]);

        $firmas = $section->addTable(['borderSize' => 6, 'borderColor' => '1f4e78', 'cellMargin' => 80]);
        $firmas->addRow(900);
        $firmas->addCell(3000)->addText('');
        $firmas->addCell(3000)->addText('');
        $firmas->addCell(3000)->addText('');
        $firmas->addRow();
        $firmas->addCell(3000, ['bgColor' => 'c9daf8'])->addText('DOCENTE TUTOR', ['bold' => true]);
        $firmas->addCell(3000, ['bgColor' => 'c9daf8'])->addText('ENCARGADO DE DPTO. TMG', ['bold' => true]);
        $firmas->addCell(3000, ['bgColor' => 'c9daf8'])->addText('JEFATURA DE CARRERA', ['bold' => true]);

        $path = storage_path('app/tmp');
        if (!is_dir($path)) {
            @mkdir($path, 0777, true);
        }
        $fileName = 'planilla-seguimiento-' . (string)$row->cod_ceta . '.docx';
        $temp = $path . DIRECTORY_SEPARATOR . $fileName;
        $writer = IOFactory::createWriter($phpWord, 'Word2007');
        $writer->save($temp);
        return response()->download($temp, $fileName, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ])->deleteFileAfterSend(true);
    }

    private function mergeEstudiantesResumen(array $entries)
    {
        $result = [];
        $seen = [];

        foreach ($entries as $row) {
            if (!is_array($row)) {
                continue;
            }

            $codCeta = isset($row['cod_ceta']) ? (string) $row['cod_ceta'] : '';
            $proyecto = isset($row['proyecto_id']) ? (string) $row['proyecto_id'] : '';
            $key = $codCeta . '|' . $proyecto;

            if (isset($seen[$key])) {
                continue;
            }

            $seen[$key] = true;

            $nombre = isset($row['nombre']) ? $row['nombre'] : (isset($row['estudiante_nombre']) ? $row['estudiante_nombre'] : '');
            $estudianteNombre = isset($row['estudiante_nombre']) ? $row['estudiante_nombre'] : (isset($row['nombre']) ? $row['nombre'] : '');
            $carrera = isset($row['carrera']) ? $row['carrera'] : (isset($row['cod_carrera']) ? $row['cod_carrera'] : null);
            $modalidad = isset($row['modalidad']) ? $row['modalidad'] : null;
            $area = isset($row['area']) ? $row['area'] : null;
            $proyectoNombre = isset($row['proyecto_nombre']) ? $row['proyecto_nombre'] : null;
            $proyectoId = isset($row['proyecto_id']) ? $row['proyecto_id'] : null;
            $fechaDesignacion = isset($row['fecha_designacion']) ? $row['fecha_designacion'] : null;

            $result[] = [
                'cod_ceta' => $codCeta,
                'nombre' => $nombre,
                'estudiante_nombre' => $estudianteNombre,
                'carrera' => $carrera,
                'modalidad' => $modalidad,
                'area' => $area,
                'proyecto_nombre' => $proyectoNombre,
                'proyecto_id' => $proyectoId,
                'fecha_designacion' => $fechaDesignacion,
            ];
        }

        return $result;
    }

    private function resumenContieneEstudiante($resumen, $codCeta)
    {
        if ($codCeta === null || $codCeta === '') {
            return false;
        }

        if ($resumen === null) {
            return false;
        }

        if (!is_array($resumen)) {
            $resumen = $this->decodeJsonColumn($resumen);
        }

        if (!is_array($resumen) || empty($resumen)) {
            return false;
        }

        $target = trim((string) $codCeta);
        if ($target === '') {
            return false;
        }

        foreach ($resumen as $entry) {
            $candidate = null;
            if (is_array($entry)) {
                if (isset($entry['cod_ceta'])) {
                    $candidate = $entry['cod_ceta'];
                } elseif (isset($entry['codCeta'])) {
                    $candidate = $entry['codCeta'];
                }
            } elseif (is_object($entry)) {
                if (isset($entry->cod_ceta)) {
                    $candidate = $entry->cod_ceta;
                } elseif (isset($entry->codCeta)) {
                    $candidate = $entry->codCeta;
                }
            } else {
                $candidate = $entry;
            }

            if ($candidate === null) {
                continue;
            }

            $candidateStr = trim((string) $candidate);
            if ($candidateStr !== '' && strcmp($candidateStr, $target) === 0) {
                return true;
            }
        }

        return false;
    }
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
                'titulo_academico' => $t->titulo_academico,
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
        $codCeta = $request->query('cod_ceta');

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
                'designacion_tutor.created_at as designacion_created_at',
                'designacion_tutor.area as designacion_area',
                'designacion_tutor.convocatoria_id',
                'designacion_tutor.convocatoria_nom as designacion_convocatoria_nom',
                'designacion_tutor.estudiante_nombre as designacion_estudiante_nom',
                'designacion_tutor.tutor_nombre as designacion_tutor_nom',
                'convocatorias.fecha_inicio as convocatoria_fecha_inicio',
                'convocatorias.fecha_fin as convocatoria_fecha_fin',
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
                'doc_designaciones.cronograma_inicio as doc_cronograma_inicio',
                'doc_designaciones.cronograma_fin as doc_cronograma_fin',
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
                'tutores.titulo_academico as tutor_titulo_academico',
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

        if ($codCeta !== null && $codCeta !== '') {
            $query->where('designacion_tutor.cod_ceta', is_numeric($codCeta) ? (int)$codCeta : $codCeta);
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

            $fechaDesignacionRaw = null;
            if (isset($row->designacion_created_at) && $row->designacion_created_at !== null) {
                $fechaDesignacionRaw = $row->designacion_created_at;
            } elseif (isset($row->fecha_designacion) && $row->fecha_designacion !== null) {
                $fechaDesignacionRaw = $row->fecha_designacion;
            }
            $fechaDesignacion = null;
            if ($fechaDesignacionRaw) {
                try {
                    $fechaDesignacion = Carbon::parse($fechaDesignacionRaw)->toIso8601String();
                } catch (\Throwable $e) {
                    $fechaDesignacion = (string) $fechaDesignacionRaw;
                }
            }

            $docResumenRow = $this->decodeJsonColumn(isset($row->doc_estudiantes_resumen) ? $row->doc_estudiantes_resumen : null);

            $convocatoriaInicioIso = null;
            if (isset($row->convocatoria_fecha_inicio) && $row->convocatoria_fecha_inicio) {
                try {
                    $convocatoriaInicioIso = Carbon::parse($row->convocatoria_fecha_inicio)->toIso8601String();
                } catch (\Throwable $e) {
                    $convocatoriaInicioIso = (string) $row->convocatoria_fecha_inicio;
                }
            }

            $convocatoriaFinIso = null;
            if (isset($row->convocatoria_fecha_fin) && $row->convocatoria_fecha_fin) {
                try {
                    $convocatoriaFinIso = Carbon::parse($row->convocatoria_fecha_fin)->toIso8601String();
                } catch (\Throwable $e) {
                    $convocatoriaFinIso = (string) $row->convocatoria_fecha_fin;
                }
            }

            $cronogramaInicioIso = null;
            if (isset($row->doc_cronograma_inicio) && $row->doc_cronograma_inicio) {
                try {
                    $cronogramaInicioIso = Carbon::parse($row->doc_cronograma_inicio)->toIso8601String();
                } catch (\Throwable $e) {
                    $cronogramaInicioIso = (string) $row->doc_cronograma_inicio;
                }
            }

            $cronogramaFinIso = null;
            if (isset($row->doc_cronograma_fin) && $row->doc_cronograma_fin) {
                try {
                    $cronogramaFinIso = Carbon::parse($row->doc_cronograma_fin)->toIso8601String();
                } catch (\Throwable $e) {
                    $cronogramaFinIso = (string) $row->doc_cronograma_fin;
                }
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

                $numeroDocumento = $this->normalizeNumero(isset($row->doc_correlativo) ? $row->doc_correlativo : null);
                $pieNotasDecoded = $this->decodeJsonColumn(isset($row->doc_pie_notas) ? $row->doc_pie_notas : null);
                $pieNotas = $pieNotasDecoded ? $pieNotasDecoded : static::$docPieNotas;
                $grouped[$tutorId] = [
                    'tutor_id' => $tutorId,
                    'tutor_ci' => $row->tutor_ci,
                    'tutor_nombre' => $fullTutorName,
                    'tutor_celular' => $row->tutor_celular,
                    'tutor_titulo' => $row->tutor_titulo,
                    'tutor_titulo_academico' => $row->tutor_titulo_academico,
                    'cod_carrera' => $row->cod_carrera,
                    'carrera_nombre' => $row->carrera_nombre,
                    'tipo_tutor_id' => $row->tipo_tutor_id ? (int)$row->tipo_tutor_id : null,
                    'tipo_tutor_nombre' => $row->tipo_tutor_nombre,
                    'convocatoria_id' => $row->convocatoria_id ? (int) $row->convocatoria_id : null,
                    'convocatoria_label' => $convLabel,
                    'convocatoria_fecha_inicio' => $convocatoriaInicioIso,
                    'convocatoria_fecha_fin' => $convocatoriaFinIso,
                    'designacion_id' => $row->designacion_id ? (int)$row->designacion_id : null,
                    'doc_tipo' => $row->doc_doc_tipo,
                    'doc_year' => $row->doc_year,
                    'numero_documento' => $numeroDocumento,
                    'cite' => $row->doc_cite,
                    'area' => isset($row->designacion_area) ? $row->designacion_area : null,
                    'doc_para_nombre' => $row->doc_para_nombre,
                    'doc_para_cargo' => $row->doc_para_cargo ? $row->doc_para_cargo : static::$docParaCargo,
                    'doc_de_nombre' => $row->doc_de_nombre ? $row->doc_de_nombre : static::$docDeNombre,
                    'doc_de_cargo' => $row->doc_de_cargo ? $row->doc_de_cargo : static::$docDeCargo,
                    'doc_asunto' => $row->doc_asunto ? $row->doc_asunto : static::$docAsunto,
                    'doc_introduccion' => $row->doc_introduccion ? $row->doc_introduccion : static::$docIntroText,
                    'cronograma_inicio' => $cronogramaInicioIso,
                    'cronograma_fin' => $cronogramaFinIso,
                    'doc_pie_notas' => $pieNotas,
                    'doc_tutor_nombre' => $row->doc_tutor_nombre,
                    'doc_tutor_titulo' => $row->doc_tutor_titulo,
                    'doc_estudiantes_resumen' => $docResumenRow,
                    'fecha_designacion' => $fechaDesignacion,
                    'estudiantes' => [],
                ];
            }

            if (!empty($docResumenRow)) {
                $existingResumen = isset($grouped[$tutorId]['doc_estudiantes_resumen']) ? $grouped[$tutorId]['doc_estudiantes_resumen'] : [];
                $mergedResumen = is_array($existingResumen) ? $existingResumen : [];
                if (!is_array($mergedResumen)) {
                    $mergedResumen = $this->decodeJsonColumn($mergedResumen);
                    $mergedResumen = is_array($mergedResumen) ? $mergedResumen : [];
                }
                foreach ($docResumenRow as $entry) {
                    $mergedResumen[] = $entry;
                }
                if (!empty($mergedResumen)) {
                    $grouped[$tutorId]['doc_estudiantes_resumen'] = $mergedResumen;
                }
            }

            if (!$grouped[$tutorId]['area'] && isset($row->designacion_area) && $row->designacion_area) {
                $grouped[$tutorId]['area'] = $row->designacion_area;
            }

            if (!$grouped[$tutorId]['fecha_designacion'] && $fechaDesignacion) {
                $grouped[$tutorId]['fecha_designacion'] = $fechaDesignacion;
            }

            if (!$grouped[$tutorId]['convocatoria_fecha_inicio'] && $convocatoriaInicioIso) {
                $grouped[$tutorId]['convocatoria_fecha_inicio'] = $convocatoriaInicioIso;
            }

            if (!$grouped[$tutorId]['convocatoria_fecha_fin'] && $convocatoriaFinIso) {
                $grouped[$tutorId]['convocatoria_fecha_fin'] = $convocatoriaFinIso;
            }

            if (!$grouped[$tutorId]['cronograma_inicio'] && $cronogramaInicioIso) {
                $grouped[$tutorId]['cronograma_inicio'] = $cronogramaInicioIso;
            }

            if (!$grouped[$tutorId]['cronograma_fin'] && $cronogramaFinIso) {
                $grouped[$tutorId]['cronograma_fin'] = $cronogramaFinIso;
            }

            $estudianteNombre = $row->designacion_estudiante_nom ?: $row->postulante_nombre_completo;

            $grouped[$tutorId]['estudiantes'][] = [
                'cod_ceta' => $row->cod_ceta,
                'estudiante_nombre' => $estudianteNombre,
                'proyecto_id' => $row->proyecto_id,
                'proyecto_nombre' => $row->proyecto_nombre,
                'fecha_designacion' => $fechaDesignacion,
                'area' => isset($row->designacion_area) ? $row->designacion_area : null,
                'documento_generado' => $this->resumenContieneEstudiante(
                    $docResumenRow,
                    $row->cod_ceta
                ),
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
        $abreviatura = 'CETA/DA/';
        try {
            $sgaService = app(SocratesApiService::class);
            if (method_exists($sgaService, 'getAbreviaturaBase')) {
                $abreviatura = $sgaService->getAbreviaturaBase();
            }
        } catch (\Throwable $e) {
            // Ignorar y usar valor por defecto
        }

        $base = rtrim($abreviatura, '/') . '/';
        $segmento = $docType === 'MEM' ? 'MEM' : 'COMINT';

        return sprintf('%s%s/%s/%s', $base, $segmento, $yearStr, $numero);
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

    private function ensureDocDesignacion($row, $tutorNombreResolved, $estudianteNombreResolved, $seleccionadosCodCeta = null)
    {
        $docType = $this->resolveDocumentoTipo(isset($row->tipo_tutor_nombre) ? $row->tipo_tutor_nombre : null);
        $year = $this->extractYear(isset($row->fecha_designacion) ? $row->fecha_designacion : null);
        $currentYear = Carbon::now()->year;
        if ($year !== $currentYear) {
            $year = $currentYear;
        }

        $paraNombre = $tutorNombreResolved ?: (isset($row->tutor_nombre) ? $row->tutor_nombre : null);
        $paraNombre = $paraNombre ? trim(preg_replace('/\s+/', ' ', $paraNombre)) : null;
        $paraCargo = isset($row->doc_para_cargo) && $row->doc_para_cargo
            ? $row->doc_para_cargo
            : static::$docParaCargo;
        $tutorTitulo = null;
        if (!empty($row->tutor_titulo_base)) {
            $tutorTitulo = trim((string) $row->tutor_titulo_base);
        }

        $carreraSlug = $this->resolveCarreraSlugForRow($row);

        $doc = DB::table('doc_designaciones')
            ->where('designacion_tutor_id', $row->id)
            ->lockForUpdate()
            ->first();

        $now = Carbon::now();

        $contextResumen = $this->buildEstudiantesResumenForContext(
            (int) $row->tutor_id,
            isset($row->convocatoria_id) && $row->convocatoria_id !== null ? (int) $row->convocatoria_id : null,
            $year
        );
        if (!$contextResumen) {
            $contextResumen = [];
        }

        if ($seleccionadosCodCeta && !empty($contextResumen)) {
            $seleccionadosNormalizados = array_map(function ($value) {
                return (int) $value;
            }, $seleccionadosCodCeta);
            $selectionLookup = array_flip($seleccionadosNormalizados);
            $contextResumen = array_values(array_filter($contextResumen, function ($rowResumen) use ($selectionLookup) {
                $codigo = isset($rowResumen['cod_ceta']) ? (int) $rowResumen['cod_ceta'] : null;
                return $codigo !== null && isset($selectionLookup[$codigo]);
            }));
        }

        $estudiantesResumen = $contextResumen;
        $resumenJson = !empty($contextResumen) ? json_encode($contextResumen) : null;

        $sharedDoc = $this->findExistingDocForContext($row, $docType, $year, (int) $row->id);
        $sharedDocRow = null;
        $sharedResumen = [];
        $sharedResumenChanged = false;

        Log::info('Ensuring doc designacion', [
            'designacion_id' => $row->id,
            'doc_tipo' => $docType,
            'year' => $year,
            'existing_doc' => (bool) $doc,
        ]);

        if ($sharedDoc) {
            $ownerId = (int) $sharedDoc->owner_designacion_id;
            $sharedDocRow = DB::table('doc_designaciones')
                ->where('designacion_tutor_id', $ownerId)
                ->lockForUpdate()
                ->first();

            if ($sharedDocRow) {
                $sharedResumenDecoded = $this->decodeJsonColumn(isset($sharedDocRow->estudiantes_resumen) ? $sharedDocRow->estudiantes_resumen : null);
                $sharedResumen = $sharedResumenDecoded ? $sharedResumenDecoded : [];
                $sharedResumenChanged = $resumenJson && $this->hasResumenChanged($sharedResumen, $estudiantesResumen);

                if ($seleccionadosCodCeta && $sharedResumenChanged) {
                    $sharedDoc = null;
                }
            } else {
                $sharedDoc = null;
            }
        }

        if ($sharedDoc && $sharedDocRow) {
            if ($sharedResumenChanged) {
                DB::table('doc_designaciones')
                    ->where('designacion_tutor_id', $sharedDocRow->designacion_tutor_id)
                    ->update([
                        'estudiantes_resumen' => $resumenJson,
                        'updated_at' => $now,
                    ]);
                $sharedDocRow->estudiantes_resumen = $resumenJson;
                $sharedResumen = $estudiantesResumen;
            }

            if (!$doc) {
                DB::table('doc_designaciones')->insert([
                    'designacion_tutor_id' => $row->id,
                    'doc_tipo' => $sharedDocRow->doc_tipo,
                    'year' => $sharedDocRow->year,
                    'correlativo' => $sharedDocRow->correlativo,
                    'cite' => $sharedDocRow->cite,
                    'para_nombre' => $sharedDocRow->para_nombre,
                    'para_cargo' => $sharedDocRow->para_cargo,
                    'de_nombre' => $sharedDocRow->de_nombre,
                    'de_cargo' => $sharedDocRow->de_cargo,
                    'asunto' => $sharedDocRow->asunto,
                    'introduccion' => $sharedDocRow->introduccion,
                    'cronograma_inicio' => $sharedDocRow->cronograma_inicio,
                    'cronograma_fin' => $sharedDocRow->cronograma_fin,
                    'cierre' => $sharedDocRow->cierre,
                    'pie_notas' => $sharedDocRow->pie_notas,
                    'tutor_nombre' => $sharedDocRow->tutor_nombre,
                    'tutor_titulo' => $sharedDocRow->tutor_titulo,
                    'estudiantes_resumen' => $resumenJson,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);

                $doc = DB::table('doc_designaciones')
                    ->where('designacion_tutor_id', $row->id)
                    ->first();
            } else {
                $needsUpdate = [];
                if ((int) $doc->correlativo !== (int) $sharedDocRow->correlativo) {
                    $needsUpdate['correlativo'] = (int) $sharedDocRow->correlativo;
                }
                if ((string) $doc->cite !== (string) $sharedDocRow->cite) {
                    $needsUpdate['cite'] = $sharedDocRow->cite;
                }

                $docResumenDecoded = $this->decodeJsonColumn(isset($doc->estudiantes_resumen) ? $doc->estudiantes_resumen : null);
                $docResumen = $docResumenDecoded ? $docResumenDecoded : [];
                if ($resumenJson && $this->hasResumenChanged($docResumen, $estudiantesResumen)) {
                    $needsUpdate['estudiantes_resumen'] = $resumenJson;
                }

                if (!empty($needsUpdate)) {
                    $needsUpdate['updated_at'] = $now;
                    DB::table('doc_designaciones')
                        ->where('designacion_tutor_id', $row->id)
                        ->update($needsUpdate);

                    $doc = DB::table('doc_designaciones')
                        ->where('designacion_tutor_id', $row->id)
                        ->first();
                }
            }

            $correlativoBase = isset($doc->correlativo) ? $doc->correlativo : (isset($sharedDocRow->correlativo) ? $sharedDocRow->correlativo : null);
            $numeroStr = $this->normalizeNumero($correlativoBase);
            $docPieNotasDecoded = $this->decodeJsonColumn(isset($doc->pie_notas) ? $doc->pie_notas : null);
            $doc->pie_notas = $docPieNotasDecoded ? $docPieNotasDecoded : static::$docPieNotas;
            $doc->estudiantes_resumen = $estudiantesResumen;

            return [$doc, $numeroStr, $doc->cite];
        }

        if (!$doc) {
            $sequenceResult = $this->fetchSequenceFromSga($docType, $year, $row, $carreraSlug);
            if ($sequenceResult['source'] !== 'sga') {
                \Log::warning('Usando fallback local para correlativo de designación (SGA no disponible)');
            }

            $numeroInt = $sequenceResult['numeroInt'];
            $numeroStr = $sequenceResult['numeroStr'];
            $cite = $sequenceResult['cite'];

            $sgaDocument = $this->createSgaDocumentForDesignation(
                $docType,
                $year,
                $numeroStr,
                $paraNombre,
                $paraCargo,
                $carreraSlug
            );
            if (is_array($sgaDocument)) {
                if (!empty($sgaDocument['correlativo'])) {
                    $numeroInt = (int) $sgaDocument['correlativo'];
                    $numeroStr = $this->normalizeNumero($numeroInt);
                }
                if (!empty($sgaDocument['cite'])) {
                    $cite = $sgaDocument['cite'];
                }
            }

            if (!$numeroStr) {
                $numeroStr = $this->normalizeNumero($numeroInt);
            }

            DB::table('doc_designaciones')->insert([
                'designacion_tutor_id' => $row->id,
                'doc_tipo' => $docType,
                'year' => $year,
                'correlativo' => $numeroInt,
                'cite' => $cite,
                'para_nombre' => $paraNombre,
                'para_cargo' => $paraCargo,
                'de_nombre' => static::$docDeNombre,
                'de_cargo' => static::$docDeCargo,
                'asunto' => static::$docAsunto,
                'introduccion' => static::$docIntroText,
                'cronograma_inicio' => isset($row->cronograma_inicio) ? $row->cronograma_inicio : null,
                'cronograma_fin' => isset($row->cronograma_fin) ? $row->cronograma_fin : null,
                'cierre' => null,
                'pie_notas' => json_encode(static::$docPieNotas),
                'tutor_nombre' => $tutorNombreResolved ?: $paraNombre,
                'tutor_titulo' => $tutorTitulo,
                'estudiantes_resumen' => $resumenJson,
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
                'para_cargo' => $paraCargo,
                'de_nombre' => static::$docDeNombre,
                'de_cargo' => static::$docDeCargo,
                'asunto' => static::$docAsunto,
                'introduccion' => static::$docIntroText,
                'pie_notas' => static::$docPieNotas,
                'tutor_nombre' => $tutorNombreResolved ?: $paraNombre,
                'tutor_titulo' => $tutorTitulo,
                'estudiantes_resumen' => $estudiantesResumen,
            ];

            return [$doc, $numeroStr, $cite];
        }

        $numeroStr = $this->normalizeNumero(isset($doc->correlativo) ? $doc->correlativo : null);
        $citeExistingRaw = isset($doc->cite) ? $doc->cite : null;
        $citeExisting = is_string($citeExistingRaw) ? trim($citeExistingRaw) : '';
        $citeHasPlaceholder = $citeExisting === '' || strpos($citeExisting, '___') !== false;

        if (!$numeroStr) {
            $sequenceResult = $this->fetchSequenceFromSga($docType, $year, $row, $carreraSlug);
            if ($sequenceResult['source'] !== 'sga') {
                \Log::warning('Usando fallback local para correlativo de designación (actualización) (SGA no disponible)');
            }

            $numeroInt = $sequenceResult['numeroInt'];
            $numeroStr = $sequenceResult['numeroStr'];
            $citeGenerated = $sequenceResult['cite'];
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

            $numeroStr = $this->normalizeNumero(isset($doc->correlativo) ? $doc->correlativo : null);
            $citeExistingRaw = isset($doc->cite) ? $doc->cite : null;
            $citeExisting = is_string($citeExistingRaw) ? trim($citeExistingRaw) : '';
            $citeHasPlaceholder = $citeExisting === '' || strpos($citeExisting, '___') !== false;
        }

        if ($citeHasPlaceholder) {
            $sgaDocument = $this->createSgaDocumentForDesignation(
                $docType,
                $year,
                $numeroStr,
                $paraNombre,
                $paraCargo,
                $carreraSlug
            );
            if (is_array($sgaDocument)) {
                if (!empty($sgaDocument['correlativo'])) {
                    $numeroInt = (int) $sgaDocument['correlativo'];
                    $numeroStr = $this->normalizeNumero($numeroInt);
                    DB::table('doc_designaciones')
                        ->where('designacion_tutor_id', $row->id)
                        ->update([
                            'correlativo' => $numeroInt,
                            'updated_at' => $now,
                        ]);
                }
                if (!empty($sgaDocument['cite'])) {
                    $citeExisting = $sgaDocument['cite'];
                    $citeHasPlaceholder = false;
                }
            }
        }

        $cite = $citeHasPlaceholder
            ? $this->buildCite($docType, $year, $numeroStr ? $numeroStr : '')
            : $citeExisting;

        $updateData = [];
        if (($citeHasPlaceholder || !$doc->cite) && $cite) {
            $updateData['cite'] = $cite;
        }
        if (!$doc->para_nombre && $paraNombre) {
            $updateData['para_nombre'] = $paraNombre;
        }
        if (!$doc->para_cargo && $paraCargo) {
            $updateData['para_cargo'] = $paraCargo;
        }
        if (!$doc->tutor_nombre && $tutorNombreResolved) {
            $updateData['tutor_nombre'] = $tutorNombreResolved;
        }
        if (!$doc->tutor_titulo && $tutorTitulo) {
            $updateData['tutor_titulo'] = $tutorTitulo;
        }
        $docResumenActualDecoded = $this->decodeJsonColumn(isset($doc->estudiantes_resumen) ? $doc->estudiantes_resumen : null);
        $docResumenActual = $docResumenActualDecoded ? $docResumenActualDecoded : [];
        if ($resumenJson && $this->hasResumenChanged($docResumenActual, $estudiantesResumen)) {
            $updateData['estudiantes_resumen'] = $resumenJson;
        }
        if (!$doc->pie_notas) {
            $updateData['pie_notas'] = json_encode(static::$docPieNotas);
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
                'last_correlativo' => isset($doc->correlativo)
                    ? $doc->correlativo
                    : ($numeroStr ? (int) ltrim($numeroStr, '0') : null),
                'updated_at' => $now,
                'created_at' => $now,
            ]
        );

        $docPieNotasDecoded = $this->decodeJsonColumn(isset($doc->pie_notas) ? $doc->pie_notas : null);
        $doc->pie_notas = $docPieNotasDecoded ? $docPieNotasDecoded : static::$docPieNotas;
        $doc->estudiantes_resumen = $estudiantesResumen;

        return [$doc, $numeroStr, $cite];
    }

    private function buildEstudiantesResumen($designacionId)
    {
        $designacion = DB::table('designacion_tutor')
            ->where('id', $designacionId)
            ->first(['tutor_id', 'convocatoria_id', 'fecha_designacion', 'created_at']);

        if (!$designacion || empty($designacion->tutor_id)) {
            return null;
        }

        $year = null;
        if (!empty($designacion->fecha_designacion)) {
            try {
                $year = Carbon::parse($designacion->fecha_designacion)->year;
            } catch (\Throwable $e) {
                // Ignorar y continuar con created_at
            }
        }

        if ($year === null && !empty($designacion->created_at)) {
            try {
                $year = Carbon::parse($designacion->created_at)->year;
            } catch (\Throwable $e) {
                // Ignorar si no se puede parsear
            }
        }

        return $this->buildEstudiantesResumenForContext(
            (int) $designacion->tutor_id,
            $designacion->convocatoria_id ? (int) $designacion->convocatoria_id : null,
            $year
        );
    }

    private function buildEstudiantesResumenForContext(int $tutorId, $convocatoriaId, $year)
    {
        $query = DB::table('designacion_tutor as dt')
            ->where('dt.tutor_id', $tutorId)
            ->join('postulantes as p', 'dt.cod_ceta', '=', 'p.cod_ceta')
            ->leftJoin('proyecto as pr', 'dt.proyecto_id', '=', 'pr.id')
            ->leftJoin('inscrip_modalidad as im', 'pr.inscrip_modalidad_id', '=', 'im.id')
            ->select(
                'dt.id as designacion_id',
                'dt.cod_ceta',
                DB::raw("TRIM(CONCAT(IFNULL(p.ap_pat,''),' ',IFNULL(p.ap_mat,''),' ',IFNULL(p.nombres_est,''))) AS nombre"),
                'dt.proyecto_id',
                'dt.convocatoria_id',
                'dt.fecha_designacion',
                'dt.created_at',
                'pr.nombre as proyecto_nombre',
                'pr.tipo as proyecto_modalidad',
                'im.modalidad_nom as inscripcion_modalidad_nom'
            )
            ->whereNotNull('dt.fecha_designacion');

        if ($convocatoriaId) {
            $query->where('dt.convocatoria_id', $convocatoriaId);
        } elseif ($year) {
            $query->whereYear('dt.fecha_designacion', $year);
        }

        $rows = $query->orderBy('dt.created_at')->get();

        if ($rows->isEmpty()) {
            return null;
        }

        return $rows->map(function ($item) {
            $tema = null;
            if (isset($item->proyecto_nombre) && trim($item->proyecto_nombre) !== '') {
                $tema = trim($item->proyecto_nombre);
            }

            $modalidad = null;
            $modalidadCandidates = [
                isset($item->proyecto_modalidad) ? $item->proyecto_modalidad : null,
                isset($item->inscripcion_modalidad_nom) ? $item->inscripcion_modalidad_nom : null,
            ];
            foreach ($modalidadCandidates as $candidate) {
                if ($candidate !== null && trim((string) $candidate) !== '') {
                    $modalidad = trim((string) $candidate);
                    break;
                }
            }

            $payload = [
                'designacion_id' => (int) $item->designacion_id,
                'cod_ceta' => $item->cod_ceta,
                'nombre' => $item->nombre,
                'proyecto_id' => $item->proyecto_id !== null ? (int) $item->proyecto_id : null,
            ];

            if ($tema !== null) {
                $payload['proyecto_nombre'] = $tema;
            }
            if ($modalidad !== null) {
                $payload['modalidad'] = $modalidad;
                $payload['modalidad_nombre'] = $modalidad;
            }

            return $payload;
        })->toArray();
    }

    private function hasResumenChanged(array $existing, array $candidate)
    {
        $normalize = function (array $items) {
            $normalized = array_map(function ($row) {
                return [
                    'cod_ceta' => isset($row['cod_ceta']) ? (string) $row['cod_ceta'] : '',
                    'nombre' => isset($row['nombre']) ? trim((string) $row['nombre']) : '',
                    'proyecto_id' => array_key_exists('proyecto_id', $row) && $row['proyecto_id'] !== null
                        ? (string) $row['proyecto_id']
                        : '',
                    'modalidad' => isset($row['modalidad']) ? trim((string) $row['modalidad']) : '',
                    'proyecto_nombre' => isset($row['proyecto_nombre']) ? trim((string) $row['proyecto_nombre']) : '',
                ];
            }, $items);

            usort($normalized, function ($a, $b) {
                return strcmp(
                    $a['cod_ceta'] . '|' . $a['proyecto_id'] . '|' . $a['modalidad'] . '|' . $a['proyecto_nombre'],
                    $b['cod_ceta'] . '|' . $b['proyecto_id'] . '|' . $b['modalidad'] . '|' . $b['proyecto_nombre']
                );
            });

            return $normalized;
        };

        return $normalize($existing) !== $normalize($candidate);
    }

    private function findExistingDocForContext($designacionRow, string $docType, int $year, int $currentDesignacionId)
    {
        $tutorId = isset($designacionRow->tutor_id) ? (int) $designacionRow->tutor_id : 0;
        if ($tutorId <= 0) {
            return null;
        }

        $query = DB::table('doc_designaciones as dd')
            ->join('designacion_tutor as dt', 'dd.designacion_tutor_id', '=', 'dt.id')
            ->where('dt.tutor_id', $tutorId)
            ->where('dd.doc_tipo', $docType)
            ->where('dd.year', $year)
            ->where('dd.designacion_tutor_id', '<>', $currentDesignacionId)
            ->orderBy('dd.created_at')
            ->orderBy('dd.id');

        if (!empty($designacionRow->convocatoria_id)) {
            $query->where('dt.convocatoria_id', $designacionRow->convocatoria_id);
        } else {
            if (!empty($designacionRow->fecha_designacion)) {
                try {
                    $fecha = Carbon::parse($designacionRow->fecha_designacion);
                    $query->whereYear('dt.fecha_designacion', $fecha->year);
                } catch (\Throwable $e) {
                    $query->whereYear('dt.created_at', $year);
                }
            } else {
                $query->whereYear('dt.created_at', $year);
            }
        }

        $row = $query->first([
            'dd.designacion_tutor_id as owner_designacion_id',
            'dd.id as doc_id',
            'dd.cite',
            'dd.correlativo'
        ]);

        return $row ?: null;
    }

    private function createSgaDocumentForDesignation($docType, $year, $numeroStr, $paraNombre, $paraCargo, $carreraSlug = null)
    {
        try {
            $sgaService = app(SocratesApiService::class);
        } catch (\Throwable $e) {
            Log::warning('SGA service no disponible para crear documento', ['error' => $e->getMessage()]);
            return null;
        }

        if (!method_exists($sgaService, 'ensureWebSession') || !method_exists($sgaService, 'buildDocumentoPayload') || !method_exists($sgaService, 'crearDocumento')) {
            Log::warning('SocratesApiService no soporta creación de documentos');
            return null;
        }

        if ($carreraSlug) {
            try {
                $sgaService->setCarrera($carreraSlug);
            } catch (\Throwable $e) {
                Log::warning('No se pudo aplicar carrera para documento SGA', [
                    'carrera' => $carreraSlug,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $config = method_exists($sgaService, 'getSgaConfig') ? $sgaService->getSgaConfig() : null;
        if (!$config) {
            Log::warning('No existe configuración SGA en base de datos');
            return null;
        }

        $sessionResult = $sgaService->ensureWebSession(
            isset($config->web_user) ? $config->web_user : null,
            isset($config->web_password) ? $config->web_password : null
        );
        if (empty($sessionResult['success'])) {
            Log::warning('No se pudo iniciar sesión web en el SGA', [
                'message' => isset($sessionResult['message']) ? $sessionResult['message'] : null,
            ]);
            return null;
        }

        $emisorId = isset($config->emisor_id) ? $config->emisor_id : null;
        if (!$emisorId) {
            Log::warning('Configuración SGA sin emisor_id');
            return null;
        }

        $abreviaturaBase = $config->abreviatura ?: 'CETA/DA/';
        $cargoId = isset($config->cargo_id) ? $config->cargo_id : 3;
        $cargoNombre = isset($config->cargo_nombre) && $config->cargo_nombre !== '' ? $config->cargo_nombre : static::$docDeCargo;
        $genero = isset($config->emisor_genero) && $config->emisor_genero !== '' ? $config->emisor_genero : 'M';
        $institucion = isset($config->institucion) ? $config->institucion : '';

        $abreviatura = rtrim($abreviaturaBase, '/') . '/';
        $codigoDocumento = strtoupper($docType);
        $numeroStr = $numeroStr ?: '000';

        $idCargoEmite = $cargoId . '|' . $cargoNombre . '|' . $abreviatura;

        $payloadParams = [
            'codigo_tipo_documento' => $codigoDocumento,
            'emite' => $emisorId,
            'nombre_emite' => static::$docDeNombre,
            'cargo_emite' => static::$docDeCargo,
            'id_cargo_emite' => $idCargoEmite,
            'genero' => $genero,
            'tiene_via' => 'false',
            'via_nombre' => '',
            'via_cargo' => '',
            'nombre_recibe' => $paraNombre ?: '',
            'id_cargo_recibe' => '',
            'cargo_recibe' => $paraCargo ?: '',
            'institucion' => $institucion,
            'asunto' => static::$docAsunto,
        ];

        $payloadResult = $sgaService->buildDocumentoPayload($payloadParams);
        if (empty($payloadResult['success'])) {
            Log::warning('No se pudo construir payload para documento SGA', [
                'message' => isset($payloadResult['message']) ? $payloadResult['message'] : null,
            ]);
            return null;
        }

        $createResult = $sgaService->crearDocumento($payloadResult['data']);
        if (empty($createResult['success'])) {
            Log::warning('Fallo al crear documento en SGA', [
                'status' => isset($createResult['status']) ? $createResult['status'] : null,
                'message' => isset($createResult['message']) ? $createResult['message'] : null,
            ]);
            return null;
        }

        $parsed = $this->parseSgaDocumentResponse($createResult['body'], $abreviatura, $codigoDocumento, $year);
        if ($parsed) {
            if (!empty($parsed['cite'])) {
                return $parsed;
            }

            if ($numeroStr && empty($parsed['correlativo'])) {
                $parsed['correlativo'] = (int) ltrim($numeroStr, '0');
            }

            if (!empty($parsed['correlativo']) || !empty($parsed['url'])) {
                $parsedCorrelativoValue = isset($parsed['correlativo']) ? $parsed['correlativo'] : null;
                $parsedCorrelativoStr = $this->normalizeNumero($parsedCorrelativoValue);
                $parsed['cite'] = $this->buildCite($docType, $year, $numeroStr ? $numeroStr : $parsedCorrelativoStr);
                return $parsed;
            }
        }

        $cite = $abreviatura . $codigoDocumento . '/' . $year . '/' . $numeroStr;
        return [
            'cite' => $cite,
            'correlativo' => $numeroStr ? (int) ltrim($numeroStr, '0') : null,
        ];
    }

    private function resolveDocTypeForSga($docType)
    {
        try {
            $sgaService = app(SocratesApiService::class);
            if (method_exists($sgaService, 'getAbreviaturaBase')) {
                return $sgaService->getAbreviaturaBase();
            }
        } catch (\Throwable $e) {
            // Ignorar y usar valor por defecto
        }

        return 'CETA/DA/';
    }

    private function fetchSequenceFromSga($docType, $year, $designacionRow = null, $carreraSlug = null)
    {
        $now = Carbon::now();
        $abreviatura = $this->resolveDocTypeForSga($docType);
        $idTipoDocumento = $docType === 'MEM' ? 2 : 4;

        Log::info('Solicitando correlativo en SGA', [
            'doc_type' => $docType,
            'year' => $year,
            'abreviatura' => $abreviatura,
            'id_tipo_documento' => $idTipoDocumento,
        ]);

        try {
            $socratesApi = app(SocratesApiService::class);
        } catch (\Throwable $e) {
            Log::warning('Socrates API service no disponible para correlativo', [
                'error' => $e->getMessage(),
            ]);

            return $this->buildSequenceResult(
                $this->fallbackSequence($docType, $year, $now),
                null,
                'fallback'
            );
        }

        $codCeta = null;
        $carreraHint = null;
        if ($designacionRow) {
            $codCeta = isset($designacionRow->cod_ceta) ? $designacionRow->cod_ceta : null;
            $carreraHint = isset($designacionRow->cod_carrera) ? $designacionRow->cod_carrera : null;
        }

        $docConfigSlug = $carreraSlug ? $carreraSlug : null;
        $contextSlug = $socratesApi->resolveContextCarreraSlug($docConfigSlug);
        $targetSlug = $socratesApi->resolveTargetCarreraSlug($docConfigSlug);

        $overrides = $this->resolveSgaCorrelativoOverrides($codCeta, $carreraHint, $contextSlug);
        if ($contextSlug && !isset($overrides['carrera'])) {
            $overrides['carrera'] = $contextSlug;
        }
        if ($docConfigSlug) {
            $overrides['doc_config_slug'] = $docConfigSlug;
        }
        if ($targetSlug && !isset($overrides['target_slug'])) {
            $overrides['target_slug'] = $targetSlug;
        }

        $finalTargetSlug = isset($overrides['target_slug']) ? $overrides['target_slug'] : $targetSlug;

        $response = $socratesApi->getCorrelativoAbreviatura(
            $abreviatura,
            $idTipoDocumento,
            $year,
            $finalTargetSlug,
            $overrides
        );

        Log::info('Respuesta correlativo SGA', [
            'success' => isset($response['success']) ? $response['success'] : null,
            'data' => isset($response['data']) ? $response['data'] : null,
        ]);

        if (!empty($response['success']) && isset($response['data'])) {
            $data = $response['data'];
            $numero = null;
            if (is_array($data) && isset($data['numero'])) {
                $numero = (int) $data['numero'];
            } elseif (is_array($data) && isset($data['raw']) && is_numeric($data['raw'])) {
                $numero = (int) $data['raw'];
            } elseif (is_numeric($data)) {
                $numero = (int) $data;
            }

            if ($numero && $numero > 0) {
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

                return $this->buildSequenceResult([
                    $numero,
                    $normalized,
                    $cite,
                ], $cite, 'sga');
            }
        }

        return $this->buildSequenceResult(
            $this->fallbackSequence($docType, $year, $now),
            null,
            'fallback'
        );
    }

    private function resolveSgaCorrelativoOverrides($codCeta = null, $carreraHint = null, $contextSlug = null)
    {
        $overrides = [];

        $normalizedContext = $contextSlug ? strtolower(trim($contextSlug)) : null;

        $normalizedHint = null;
        if ($carreraHint) {
            $mapped = $this->mapCarreraFromCodigo($carreraHint);
            if ($mapped) {
                $normalizedHint = strtolower($mapped);
            }
        }

        if ($normalizedContext === 'electricidad' || $normalizedHint === 'electricidad') {
            $overrides['target_slug'] = 'mecanica';
        }

        return $overrides;
    }

    private function resolveSgaConfigParameter($config, string $column, $envKey = null)
    {
        if ($config && Schema::hasTable('sga_config') && Schema::hasColumn('sga_config', $column)) {
            $value = isset($config->$column) ? $config->$column : null;
            if ($value !== null && $value !== '') {
                return trim((string) $value);
            }
        }

        if ($envKey) {
            $envValue = env($envKey);
            if ($envValue !== null && $envValue !== '') {
                return trim((string) $envValue);
            }
        }

        return null;
    }

    private function resolveCarreraSlugForRow($row)
    {
        if (!$row) {
            return null;
        }

        if (isset($row->cod_carrera) && $row->cod_carrera !== null && $row->cod_carrera !== '') {
            $mapped = $this->mapCarreraFromCodigo($row->cod_carrera);
            if ($mapped) {
                return $mapped;
            }
        }

        if (isset($row->carrera_nombre) && $row->carrera_nombre) {
            $normalized = $this->normalizeCarreraCodigo($row->carrera_nombre);
            if ($normalized) {
                $mapped = $this->mapCarreraFromCodigo($normalized);
                if ($mapped) {
                    return $mapped;
                }
            }
        }

        if (isset($row->area) && $row->area) {
            $normalized = $this->normalizeCarreraCodigo($row->area);
            if ($normalized) {
                $mapped = $this->mapCarreraFromCodigo($normalized);
                if ($mapped) {
                    return $mapped;
                }
            }
        }

        return null;
    }

    private function mapCarreraFromCodigo($cod)
    {
        if ($cod === null) {
            return null;
        }

        $upper = strtoupper(trim((string) $cod));
        if ($upper === 'MEA') {
            return 'mecanica';
        }
        if ($upper === 'EEA') {
            return 'electricidad';
        }

        return null;
    }

    private function normalizeCarreraCodigo($raw)
    {
        if (!$raw) {
            return null;
        }

        $val = strtoupper(trim($raw));
        if (in_array($val, ['MEA', 'EEA'], true)) {
            return $val;
        }

        $norm = mb_strtolower($raw, 'UTF-8');
        if (strpos($norm, 'mec') !== false) {
            return 'MEA';
        }
        if (strpos($norm, 'elect') !== false) {
            return 'EEA';
        }

        $candidate = DB::table('carrera')
            ->whereRaw('LOWER(nombre_carrera) = ?', [mb_strtolower($raw, 'UTF-8')])
            ->value('cod_carrera');
        if ($candidate) {
            return $candidate;
        }

        $likeCandidate = DB::table('carrera')
            ->select('cod_carrera')
            ->where('nombre_carrera', 'LIKE', '%' . $raw . '%')
            ->limit(1)
            ->value('cod_carrera');

        return $likeCandidate ?: null;
    }

    private function normalizeCodGrupo($raw)
    {
        if ($raw === null) {
            return null;
        }

        $value = trim((string) $raw);
        if ($value === '') {
            return null;
        }

        $upper = strtoupper($value);

        if (is_numeric($upper)) {
            return ltrim($upper, '0');
        }

        $map = [
            '1ER' => '1',
            '1RO' => '1',
            'PRIMERO' => '1',
            'SEGUNDO' => '2',
            '2DO' => '2',
            'TERCERO' => '3',
            '3RO' => '3',
        ];
        if (isset($map[$upper])) {
            return $map[$upper];
        }

        return $upper;
    }

    private function fallbackSequence($docType, $year, Carbon $now)
    {
        $sequenceRow = DB::table('doc_designacion_secuencias')
            ->where('doc_tipo', $docType)
            ->where('year', $year)
            ->lockForUpdate()
            ->first();

        $baseNumero = 0;
        if ($sequenceRow && isset($sequenceRow->last_correlativo)) {
            $baseNumero = max(0, (int) $sequenceRow->last_correlativo);
        } else {
            $maxNumero = DB::table('doc_designaciones')
                ->where('doc_tipo', $docType)
                ->where('year', $year)
                ->max('correlativo');
            $baseNumero = max(0, (int) $maxNumero);
        }

        $numero = max(1, $baseNumero + 1);
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

    private function buildSequenceResult(array $sequence, $cite, string $source): array
    {
        return [
            'numeroInt' => $sequence[0],
            'numeroStr' => $sequence[1],
            'cite' => $sequence[2],
            'source' => $source,
        ];
    }

    private function parseSgaDocumentResponse($body, $abreviatura, $codigoDocumento, $year)
    {
        if (!$body) {
            return null;
        }

        $url = trim((string) $body);
        if ($url === '') {
            return null;
        }

        $path = parse_url($url, PHP_URL_PATH);
        if (!$path) {
            $path = $url;
        }

        $basename = basename($path);
        if (!$basename) {
            return null;
        }

        $segments = explode('_', $basename);
        $codePart = $segments[0];
        if (!$codePart) {
            return null;
        }

        $code = str_replace('-', '/', $codePart);
        $parts = explode('/', $code);
        if (count($parts) < 5) {
            // Intentar reconstruir con abreviatura + docType
            $normalizedNumber = end($parts);
            $cite = rtrim($abreviatura, '/') . '/' . $codigoDocumento . '/' . $year;
            if ($normalizedNumber) {
                $cite .= '/' . $normalizedNumber;
            }
            return [
                'cite' => $cite,
                'correlativo' => $normalizedNumber ? (int) ltrim($normalizedNumber, '0') : null,
                'url' => $url,
            ];
        }

        $correlativoPart = $parts[count($parts) - 1];
        $correlativoInt = (int) ltrim($correlativoPart, '0');
        $cite = implode('/', $parts);

        return [
            'cite' => $cite,
            'correlativo' => $correlativoInt > 0 ? $correlativoInt : null,
            'url' => $url,
        ];
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
            'items.*.titulo_academico' => ['nullable', 'string', 'in:T.S.,Lic.,Ing.'],
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
                if (isset($i['titulo_academico'])) {
                    $snapBase['titulo_academico'] = $i['titulo_academico'];
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

    public function generarDocDesignacion(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'tutor_id' => 'required|integer|exists:tutores,id',
            'cod_ceta' => 'required|integer|exists:postulantes,cod_ceta',
            'seleccionados_cod_ceta' => 'nullable|array',
            'seleccionados_cod_ceta.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        $seleccionadosCodCeta = null;
        if (isset($data['seleccionados_cod_ceta']) && is_array($data['seleccionados_cod_ceta'])) {
            $seleccionadosCodCeta = array_values(array_unique(array_map(function ($value) {
                return (int) $value;
            }, $data['seleccionados_cod_ceta'])));
        }

        DB::beginTransaction();
        try {
            $baseRow = DB::table('designacion_tutor as dt')
                ->leftJoin('tutores as t', 'dt.tutor_id', '=', 't.id')
                ->leftJoin('tipo_tutor as tt', 't.tipo_tutor_id', '=', 'tt.id')
                ->leftJoin('proyecto', 'dt.proyecto_id', '=', 'proyecto.id')
                ->leftJoin('convocatorias as conv', 'dt.convocatoria_id', '=', 'conv.id')
                ->select(
                    'dt.*',
                    'tt.nombre as tipo_tutor_nombre',
                    't.titulo as tutor_titulo_base',
                    'proyecto.nombre as proyecto_nombre',
                    'conv.fecha_inicio as convocatoria_fecha_inicio',
                    'conv.fecha_fin as convocatoria_fecha_fin'
                )
                ->where('dt.tutor_id', $data['tutor_id'])
                ->where('dt.cod_ceta', $data['cod_ceta'])
                ->first();

            if (!$baseRow) {
                throw new \RuntimeException('No existe designación previa para generar documento.');
            }

            $p = DB::table('postulantes')->where('cod_ceta', $data['cod_ceta'])
                ->first(['nombres_est', 'ap_pat', 'ap_mat']);
            $t = DB::table('tutores')->where('id', $data['tutor_id'])
                ->first(['nombre', 'apellido_p', 'apellido_m']);
            $estNombre = $p ? trim(implode(' ', array_filter([$p->nombres_est, $p->ap_pat, $p->ap_mat]))) : '';
            $tutNombre = $t ? trim(implode(' ', array_filter([$t->nombre, $t->apellido_p, $t->apellido_m]))) : '';

            [$docRecord, $numeroDocumento, $cite] = $this->ensureDocDesignacion(
                $baseRow,
                $tutNombre,
                $estNombre,
                $seleccionadosCodCeta
            );

            DB::commit();

            return response()->json([
                'success' => true,
                'data' => [
                    'designacion_id' => $baseRow->id,
                    'numero_documento' => $numeroDocumento,
                    'cite' => $cite,
                ],
            ]);
        } catch (\Throwable $e) {
            DB::rollBack();
            Log::error('Error al generar documento de designación', [
                'payload' => $request->all(),
                'exception' => $e->getMessage(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'No se pudo generar el documento de designación',
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
            'titulo_academico' => ['sometimes', 'nullable', 'string', 'in:T.S.,Lic.,Ing.'],
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
            'generar_documento' => 'nullable|boolean',
            'refrescar_correlativo' => 'nullable|boolean',
            'seleccionados_cod_ceta' => 'nullable|array',
            'seleccionados_cod_ceta.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Datos inválidos',
                'errors' => $validator->errors(),
            ], 422);
        }


        $data = $validator->validated();

        $seleccionadosCodCeta = null;
        if (isset($data['seleccionados_cod_ceta']) && is_array($data['seleccionados_cod_ceta'])) {
            $seleccionadosCodCeta = array_values(array_unique(array_map(function ($value) {
                return (int) $value;
            }, $data['seleccionados_cod_ceta'])));
        }
        unset($data['seleccionados_cod_ceta']);

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
                ->leftJoin('convocatorias as conv', 'dt.convocatoria_id', '=', 'conv.id')
                ->select(
                    'dt.*',
                    'tt.nombre as tipo_tutor_nombre',
                    't.titulo as tutor_titulo_base',
                    'proyecto.nombre as proyecto_nombre',
                    'conv.fecha_inicio as convocatoria_fecha_inicio',
                    'conv.fecha_fin as convocatoria_fecha_fin'
                )
                ->where('dt.tutor_id', $data['tutor_id'])
                ->where('dt.cod_ceta', $data['cod_ceta'])
                ->first();

            if (!$baseRow) {
                throw new \RuntimeException('No se pudo recuperar la designación recién creada.');
            }

            if ($seleccionadosCodCeta && !in_array((int) $data['cod_ceta'], $seleccionadosCodCeta, true)) {
                $seleccionadosCodCeta[] = (int) $data['cod_ceta'];
            }

            $docRecord = null;
            $numeroDocumento = null;
            $cite = null;
            if ($request->boolean('generar_documento', false)) {
                $docRecordResult = $this->ensureDocDesignacion(
                    $baseRow,
                    $tutNombre ? $tutNombre : '',
                    $estNombre ? $estNombre : '',
                    $seleccionadosCodCeta
                );
                [$docRecord, $numeroDocumento, $cite] = $docRecordResult;
            }

            DB::commit();

            $row = DB::table('designacion_tutor as dt')
                ->leftJoin('tutores as t', 'dt.tutor_id', '=', 't.id')
                ->leftJoin('tipo_tutor as tt', 't.tipo_tutor_id', '=', 'tt.id')
                ->leftJoin('doc_designaciones as dd', 'dd.designacion_tutor_id', '=', 'dt.id')
                ->leftJoin('convocatorias as conv', 'dt.convocatoria_id', '=', 'conv.id')
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
                    'dd.estudiantes_resumen as doc_estudiantes_resumen',
                    'conv.fecha_inicio as convocatoria_fecha_inicio',
                    'conv.fecha_fin as convocatoria_fecha_fin'
                )
                ->where('dt.tutor_id', $data['tutor_id'])
                ->where('dt.cod_ceta', $data['cod_ceta'])
                ->first();

            if ($row) {
                $convocatoriaInicioIso = null;
                if (isset($row->convocatoria_fecha_inicio) && $row->convocatoria_fecha_inicio) {
                    try {
                        $convocatoriaInicioIso = Carbon::parse($row->convocatoria_fecha_inicio)->toIso8601String();
                    } catch (\Throwable $e) {
                        $convocatoriaInicioIso = (string) $row->convocatoria_fecha_inicio;
                    }
                }

                $convocatoriaFinIso = null;
                if (isset($row->convocatoria_fecha_fin) && $row->convocatoria_fecha_fin) {
                    try {
                        $convocatoriaFinIso = Carbon::parse($row->convocatoria_fecha_fin)->toIso8601String();
                    } catch (\Throwable $e) {
                        $convocatoriaFinIso = (string) $row->convocatoria_fecha_fin;
                    }
                }

                $cronogramaInicioIso = null;
                if (isset($row->doc_cronograma_inicio) && $row->doc_cronograma_inicio) {
                    try {
                        $cronogramaInicioIso = Carbon::parse($row->doc_cronograma_inicio)->toIso8601String();
                    } catch (\Throwable $e) {
                        $cronogramaInicioIso = (string) $row->doc_cronograma_inicio;
                    }
                }

                $cronogramaFinIso = null;
                if (isset($row->doc_cronograma_fin) && $row->doc_cronograma_fin) {
                    try {
                        $cronogramaFinIso = Carbon::parse($row->doc_cronograma_fin)->toIso8601String();
                    } catch (\Throwable $e) {
                        $cronogramaFinIso = (string) $row->doc_cronograma_fin;
                    }
                }

                $row->designacion_id = isset($row->id) ? $row->id : null;
                $row->numero_documento = $this->normalizeNumero(isset($row->doc_correlativo) ? $row->doc_correlativo : null);
                if (!$row->numero_documento) {
                    $row->numero_documento = $numeroDocumento;
                }
                $row->cite = isset($row->doc_cite) ? $row->doc_cite : $cite;
                $row->doc_para_cargo = $row->doc_para_cargo ?: static::$docParaCargo;
                $row->doc_de_nombre = $row->doc_de_nombre ?: static::$docDeNombre;
                $row->doc_de_cargo = $row->doc_de_cargo ?: static::$docDeCargo;
                $row->doc_asunto = $row->doc_asunto ?: static::$docAsunto;
                $row->doc_introduccion = $row->doc_introduccion ?: static::$docIntroText;
                $rowDocPieNotasDecoded = $this->decodeJsonColumn(isset($row->doc_pie_notas) ? $row->doc_pie_notas : null);
                $row->doc_pie_notas = $rowDocPieNotasDecoded ? $rowDocPieNotasDecoded : static::$docPieNotas;
                $row->doc_estudiantes_resumen = $this->decodeJsonColumn(isset($row->doc_estudiantes_resumen) ? $row->doc_estudiantes_resumen : null);
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
                $row->convocatoria_fecha_inicio = $convocatoriaInicioIso;
                $row->convocatoria_fecha_fin = $convocatoriaFinIso;
                $row->cronograma_inicio = $cronogramaInicioIso;
                $row->cronograma_fin = $cronogramaFinIso;
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
