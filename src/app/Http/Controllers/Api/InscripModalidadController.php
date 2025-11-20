<?php

namespace App\Http\Controllers\Api;

use App\Models\InscripModalidad;
use App\Models\ArancelesEst;
use App\Models\DiplomaBachiller;
use App\Models\DatosCarrera;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use App\Models\TransitabilidadEduReg;
use App\Models\TransitabilidadInstTec;
use App\Models\RaHomolEx;
use App\Models\GradoHomol;
use App\Models\ResHomolCp;
use App\Models\GradosHomolCp;
use App\Models\TraspasosInstituto;
use App\Models\GradosTrasp;

class InscripModalidadController extends CrudController
{
    protected $modelClass = InscripModalidad::class;

    public function index()
    {
        $request = request();
        $query = InscripModalidad::query();

        if ($request->filled('cod_ceta_est')) {
            $query->where('cod_ceta_est', (int) $request->query('cod_ceta_est'));
        }
        if ($request->filled('modalidad_id')) {
            $query->where('modalidad_id', (int) $request->query('modalidad_id'));
        }

        if ($request->filled('estado')) {
            $query->where('estado', $request->query('estado'));
        }

        $perPage = (int) $request->query('per_page', 15);
        if ($perPage <= 0) {
            $perPage = 15;
        }

        return $query->paginate($perPage);
    }

    public function assignPostulanteNum(Request $request)
    {
        $data = $request->validate([
            'inscrip_modalidad_id' => 'nullable|integer|exists:inscrip_modalidad,id',
            'cod_ceta_est' => 'nullable|integer',
        ]);

        if (empty($data['inscrip_modalidad_id']) && empty($data['cod_ceta_est'])) {
            return response()->json(['message' => 'Se requiere inscrip_modalidad_id o cod_ceta_est'], 422);
        }

        return DB::transaction(function () use ($data) {
            // 1) Localizar inscripción
            $query = DB::table('inscrip_modalidad');
            if (!empty($data['inscrip_modalidad_id'])) {
                $query->where('id', (int)$data['inscrip_modalidad_id']);
            } else {
                $query->where('cod_ceta_est', (int)$data['cod_ceta_est'])->orderByDesc('id');
            }
            $ins = $query->lockForUpdate()->first();
            if (!$ins) {
                return response()->json(['message' => 'Inscripción no encontrada'], 404);
            }

            // Si ya tiene número, devolverlo
            if (isset($ins->nro_postulante) && $ins->nro_postulante !== null) {
                return response()->json(['nro_postulante' => (int)$ins->nro_postulante]);
            }

            // 2) Determinar convocatoria
            $convId = isset($ins->convocatoria_id) ? (int)$ins->convocatoria_id : null;
            if (!$convId) {
                return response()->json(['message' => 'La inscripción no tiene convocatoria asociada'], 422);
            }

            // 3) Obtener/incrementar secuencia por convocatoria
            $seqRow = DB::table('postulante_num_secuencias')
                ->where('convocatoria_id', $convId)
                ->lockForUpdate()
                ->first();

            if (!$seqRow) {
                DB::table('postulante_num_secuencias')->insert([
                    'convocatoria_id' => $convId,
                    'last_numero' => 0,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $seqRow = DB::table('postulante_num_secuencias')
                    ->where('convocatoria_id', $convId)
                    ->lockForUpdate()
                    ->first();
            }

            $next = ((int)$seqRow->last_numero) + 1;

            DB::table('postulante_num_secuencias')
                ->where('id', $seqRow->id)
                ->update(['last_numero' => $next, 'updated_at' => now()]);

            // 4) Persistir en inscripción
            DB::table('inscrip_modalidad')
                ->where('id', $ins->id)
                ->update(['nro_postulante' => $next, 'updated_at' => now()]);

            return response()->json(['nro_postulante' => $next]);
        });
    }
    /**
     * Sanitiza números de serie/resoluciones: permite solo A-Z, 0-9, guion -, comillas dobles " y símbolo °, y devuelve en MAYÚSCULAS.
     */
    private function sanitizeSerie($v)
    {
        if ($v === null) return null;
        $v = strtoupper($v);
        // Mantener solo A-Z, 0-9, -, " , ° y espacios
        $v = preg_replace('/[^A-Z0-9\-\"°\s]+/u', '', $v);
        return $v;
    }

    // Resolver código de carrera (MEA/EEA) desde postulantes.carrera y tabla carrera
    private function resolveCodCarrera($codCeta)
    {
        try {
            $raw = DB::table('postulantes')->where('cod_ceta', (int)$codCeta)->value('carrera');
            if ($raw === null) return null;
            $val = trim((string)$raw);
            if ($val === '') return null;
            $upper = strtoupper($val);
            if (in_array($upper, array('MEA','EEA'), true)) {
                $exists = DB::table('carrera')->where('cod_carrera', $upper)->exists();
                if ($exists) return $upper;
            }
            $norm = mb_strtolower($val, 'UTF-8');
            $map = array(
                'mecanica' => 'MEA',
                'mecánica' => 'MEA',
                'mecanica automotriz' => 'MEA',
                'mecánica automotriz' => 'MEA',
                'electricidad' => 'EEA',
                'eléctrica' => 'EEA',
                'electronica' => 'EEA',
                'eléctrónica' => 'EEA',
                'electricidad y electrónica automotriz' => 'EEA',
            );
            if (isset($map[$norm])) {
                $code = $map[$norm];
                $exists = DB::table('carrera')->where('cod_carrera', $code)->exists();
                if ($exists) return $code;
            }
            $candidate = DB::table('carrera')
                ->whereRaw('LOWER(nombre_carrera) = ?', array(mb_strtolower($val, 'UTF-8')))
                ->value('cod_carrera');
            if ($candidate) return $candidate;
            $like = DB::table('carrera')->select('cod_carrera')->where('nombre_carrera', 'LIKE', '%'.$val.'%')->limit(2)->get();
            if ($like && count($like) === 1) {
                $row = (array)$like[0];
                return isset($row['cod_carrera']) ? $row['cod_carrera'] : null;
            }
        } catch (\Throwable $e) {
            // ignorar
        }
        return null;
    }
    
    protected function rules()
    {
        return [
            'cod_ceta_est' => 'nullable|integer',
            'modalidad_id' => 'nullable|exists:modalidad,id',
            // columnas legacy removidas
            'fecha_inscripcion' => 'nullable|date',
            'estado' => 'nullable|string|max:255',
            'convocatoria_id' => 'nullable|exists:convocatorias,id',
            'nom_convocatoria' => 'nullable|string|max:150',
        ];
    }

    public function upsertByCod(Request $request)
    {
        $data = $request->validate([
            'cod_ceta_est' => 'required|integer',
            'modalidad_id' => 'nullable|exists:modalidad,id',
            'modalidad_nom' => 'nullable|string|max:120',
            'estado' => 'nullable|string|max:255',
            'fecha_inscripcion' => 'nullable|date',
            'convocatoria_id' => 'nullable|exists:convocatorias,id',
            'nom_convocatoria' => 'nullable|string|max:150',
            'aranceles_completos' => 'nullable|boolean',
            'estado_arancel' => 'nullable|in:sin_pagos,parcial,completo',
        ]);

        $payload = [
            'cod_ceta_est' => $data['cod_ceta_est'],
        ];

        foreach ([
            'modalidad_id',
            'modalidad_nom',
            'estado',
            'fecha_inscripcion',
            'convocatoria_id',
            'nom_convocatoria',
            'aranceles_completos',
            'estado_arancel',
        ] as $key) {
            if (array_key_exists($key, $data)) {
                $payload[$key] = $data[$key];
            }
        }

        $record = InscripModalidad::query()
            ->where('cod_ceta_est', $data['cod_ceta_est'])
            ->orderByDesc('updated_at')
            ->first();

        if ($record) {
            $record->fill($payload);
            $record->save();
        } else {
            $record = InscripModalidad::create($payload);
        }

        return response()->json($record);
    }

    // Registro de inscripción con aranceles seleccionados en una sola operación
    public function storeWithAranceles(Request $request)
    {
        $data = $request->validate([
            'cod_ceta_est' => 'nullable|integer',
            'nombres_est' => 'nullable|string|max:150',
            'apellidos_est' => 'nullable|string|max:200',
            'modalidad_id' => 'nullable|exists:modalidad,id',
            'modalidad_nom' => 'nullable|string|max:120',
            'carrera' => 'nullable|string|max:100',
            'aranceles_completos' => 'nullable|boolean',
            'user_id' => 'nullable|integer',
            'user_name' => 'nullable|string|max:150',
            'aranceles' => 'array',
            'aranceles.*.id' => 'nullable|integer|exists:aranceles_est,id',
            'aranceles.*.gestion' => 'nullable|string|max:10',
            'aranceles.*.fecha' => 'nullable|date',
            'aranceles.*.concepto' => 'nullable|string|max:255',
            'aranceles.*.monto' => 'nullable|numeric',
            'aranceles.*.num_factura' => 'nullable|string|max:50',
            'aranceles.*.num_comprobante' => 'nullable|string|max:50',
            'aranceles.*.razon' => 'nullable|string|max:255',
            'aranceles.*.nit' => 'nullable|string|max:30',
            'aranceles.*.pagado' => 'nullable|boolean',
            'aranceles.*.origen' => 'nullable|string|max:20',
            'aranceles.*.seleccionado' => 'nullable|boolean',
            // Diploma de bachiller (según esquema actual)
            'tipo_bachiller' => 'nullable|in:nacional,extranjero',
            'diploma_bachiller' => 'nullable|array',
            'diploma_bachiller.nro_serie_titulo' => 'nullable|string|max:255|required_if:tipo_bachiller,nacional',
            'diploma_bachiller.emision' => 'nullable|string|max:255',
            'diploma_bachiller.fecha_emision' => 'nullable|date',
            'diploma_bachiller.observacion' => 'nullable|string',
            'diploma_bachiller.gestion_bachillerato' => 'nullable|string|max:10',
            // Datos de carrera
            'datos_carrera' => 'nullable|array',
            'datos_carrera.regimen_ini' => 'nullable|in:semestral,anual',
            'datos_carrera.regimen_fin' => 'nullable|in:semestral,anual',
            'datos_carrera.gestion_ini' => 'required_with:datos_carrera|string|max:7',
            'datos_carrera.gestion_fin' => 'nullable|string|max:7',
            // fechas y observacion eliminadas del esquema
            // Transitabilidad Educación Regular
            'transitabilidad_edu_reg' => 'nullable|array',
            'transitabilidad_edu_reg.serie_titulo_tm' => 'nullable|string|max:50',
            'transitabilidad_edu_reg.numero_titulo_tm' => 'nullable|string|max:50',
            'transitabilidad_edu_reg.fecha_emision' => 'nullable|date',
            'transitabilidad_edu_reg.observacion' => 'nullable|string',
            // Transitabilidad Técnico Medio
            'transitabilidad_inst_tec' => 'nullable|array',
            'transitabilidad_inst_tec.serie_titulo_tm' => 'nullable|string|max:50',
            'transitabilidad_inst_tec.numero_titulo_tm' => 'nullable|string|max:50',
            'transitabilidad_inst_tec.fecha_emision' => 'nullable|date',
            'transitabilidad_inst_tec.observacion' => 'nullable|string',
            // Homologación de Bachiller Extranjero
            'homol_extranjero' => 'nullable|array',
            'homol_extranjero.nro_resolucion' => 'nullable|string|max:255',
            'homol_extranjero.fecha_emision' => 'nullable|date',
            'homol_extranjero.grados_gestiones' => 'nullable|array',
            'homol_extranjero.grados_gestiones.*.grado' => 'nullable|string|max:50',
            'homol_extranjero.grados_gestiones.*.gestion' => 'nullable|string|max:10',
            // Traspasos de Instituto
            'traspaso_instituto' => 'nullable|array',
            'traspaso_instituto.instituto_origen' => 'nullable|string|max:255',
            'traspaso_instituto.grados_cursados' => 'nullable|string|max:255',
            'traspaso_instituto.gestiones_cursadas' => 'nullable|string|max:255',
            'traspaso_instituto.observacion' => 'nullable|string',
            'traspaso_instituto.grados' => 'nullable|array',
            'traspaso_instituto.grados.*.grado' => 'nullable|string|max:50',
            'traspaso_instituto.grados.*.gestion' => 'nullable|string|max:10',
            // Homologación por cambio de plan
            'homol_cambio_plan' => 'nullable|array',
            'homol_cambio_plan.nro_resolucion' => 'nullable|string|max:255',
            'homol_cambio_plan.fecha_emision' => 'nullable|date',
            'homol_cambio_plan.grados_cursados' => 'nullable|string|max:255',
            'homol_cambio_plan.gestiones_cursadas' => 'nullable|string|max:255',
            'homol_cambio_plan.grados_gestiones' => 'nullable|array',
            'homol_cambio_plan.grados_gestiones.*.grado' => 'nullable|string|max:50',
            'homol_cambio_plan.grados_gestiones.*.gestion' => 'nullable|string|max:10',
        ]);

        $user = $request->user();

        return DB::transaction(function () use ($data, $user) {
            $codCeta = isset($data['cod_ceta_est']) ? $data['cod_ceta_est'] : null;
            if (empty($codCeta)) {
                // Generar código CETA: 9 + AAAA + F + NNN
                $year = (int) date('Y');
                $flag = 0; // 0 = mecánica, 1 = electrónica
                $carrera = strtolower((string)(isset($data['carrera']) ? $data['carrera'] : ''));
                if (strpos($carrera, 'elect') !== false) { $flag = 1; }
                // Prefijo base por año (sin distinguir carrera para el correlativo)
                $yearPrefix = '9' . sprintf('%04d', $year);
                // Buscar correlativo máximo para el año actual (independiente del flag/carrera)
                $minRange = (int)($yearPrefix . '0000'); // 9 + AAAA + 0 + 000
                $maxRange = (int)($yearPrefix . '1999'); // 9 + AAAA + 1 + 999
                $max = DB::table('inscrip_modalidad')
                    ->whereBetween('cod_ceta_est', [$minRange, $maxRange])
                    ->max('cod_ceta_est');
                $seq = 0;
                if ($max) {
                    // Extraer últimos 4 dígitos (flag + correlativo) para obtener el correlativo real
                    $lastFour = (int) substr((string)$max, -4);
                    // El correlativo son los últimos 3 dígitos de esos 4
                    $seq = $lastFour % 1000;
                }
                $seq = $seq + 1;
                $codCeta = (int)($yearPrefix . $flag . str_pad((string)$seq, 3, '0', STR_PAD_LEFT));
                $data['cod_ceta_est'] = $codCeta;
            }
            $ins = new InscripModalidad();
            $ins->cod_ceta_est = $data['cod_ceta_est'];
            if (isset($data['nombres_est'])) $ins->nombres_est = $data['nombres_est'];
            if (isset($data['apellidos_est'])) $ins->apellidos_est = $data['apellidos_est'];
            if (isset($data['modalidad_id'])) $ins->modalidad_id = $data['modalidad_id'];
            if (isset($data['modalidad_nom'])) $ins->modalidad_nom = $data['modalidad_nom'];
            if (isset($data['convocatoria_id'])) $ins->convocatoria_id = $data['convocatoria_id'];
            if (array_key_exists('nom_convocatoria', $data)) $ins->nom_convocatoria = $data['nom_convocatoria'];
            if (isset($data['aranceles_completos'])) $ins->aranceles_completos = (bool)$data['aranceles_completos'];
            // Usuario registrador
            $ins->user_id = isset($data['user_id']) ? $data['user_id'] : ($user ? $user->id : null);
            // Preferir nombre_usuario; si el payload lo trae explícito, respetarlo
            if (isset($data['user_name'])) {
                $ins->user_name = $data['user_name'];
            } else if ($user) {
                $ins->user_name = $user->nombre_usuario;
            }
            // Valores por defecto
            $ins->fecha_inscripcion = now()->toDateString();
            $ins->estado = 'pendiente';
            $ins->save();
            
            $allPaid = true;
            $total = 0;
            $paid = 0;
            if (!empty($data['aranceles'])) {
                foreach ($data['aranceles'] as $a) {
                    $item = null;
                    if (!empty($a['id'])) {
                        $item = ArancelesEst::find($a['id']);
                    }
                    // Evitar duplicados: intentar localizar registro existente por claves fuertes
                    if (!$item) {
                        $base = DB::table('aranceles_est')->where('cod_ceta_est', $ins->cod_ceta_est);
                        $nf = (isset($a['num_factura']) && trim((string)$a['num_factura']) !== '') ? trim((string)$a['num_factura']) : '';
                        $nc = (isset($a['num_comprobante']) && trim((string)$a['num_comprobante']) !== '') ? trim((string)$a['num_comprobante']) : '';
                        $fecha = array_key_exists('fecha', $a) ? $a['fecha'] : null;
                        $concepto = array_key_exists('concepto', $a) ? $a['concepto'] : null;
                        $monto = array_key_exists('monto', $a) ? $a['monto'] : null;
                        $q = clone $base;
                        if ($nf !== '' && $nf !== '0') {
                            $q->where('num_factura', $nf);
                        } elseif ($nc !== '' && $nc !== '0') {
                            $q->where('num_comprobante', $nc);
                        } else {
                            if ($fecha !== null) $q->where('fecha', $fecha);
                            if ($concepto !== null) $q->where('concepto', $concepto);
                            if ($monto !== null) $q->where('monto', $monto);
                        }
                        $exists = $q->first();
                        if ($exists) {
                            $item = ArancelesEst::find($exists->id);
                        }
                    }
                    if (!$item) {
                        $item = new ArancelesEst();
                        $item->cod_ceta_est = $ins->cod_ceta_est;
                    }
                    $item->inscrip_modalidad_id = $ins->id;
                    if (isset($a['gestion'])) $item->gestion = $a['gestion'];
                    if (isset($a['fecha'])) $item->fecha = $a['fecha'];
                    if (isset($a['concepto'])) $item->concepto = $a['concepto'];
                    if (isset($a['monto'])) $item->monto = $a['monto'];
                    if (isset($a['num_factura'])) $item->num_factura = $a['num_factura'];
                    if (isset($a['num_comprobante'])) $item->num_comprobante = $a['num_comprobante'];
                    if (isset($a['razon'])) $item->razon = $a['razon'];
                    if (isset($a['nit'])) $item->nit = $a['nit'];
                    if (isset($a['origen'])) $item->origen = $a['origen'];
                    $item->seleccionado = isset($a['seleccionado']) ? (bool)$a['seleccionado'] : true;
                    $item->pagado = isset($a['pagado']) ? (bool)$a['pagado'] : false;
                    if ($item->pagado) {
                        // Si viene fecha de pago explícita úsala; si no, usa fecha del arancel o la fecha actual
                        if (isset($a['fecha_pago']) && !empty($a['fecha_pago'])) {
                            $item->fecha_pago = $a['fecha_pago'];
                        } elseif (isset($a['fecha']) && !empty($a['fecha'])) {
                            $item->fecha_pago = $a['fecha'];
                        } else {
                            $item->fecha_pago = now()->toDateString();
                        }
                    }
                    $item->save();
                    $total++;
                    if ($item->pagado) { $paid++; } else { $allPaid = false; }
                }
            } else {
                // Si no hay aranceles en el payload, no es pago completo
                $allPaid = false;
                $total = 0;
                $paid = 0;
            }

            // Actualizar pago completo si corresponde
            $ins->aranceles_completos = $allPaid ? 1 : 0;
            // Actualizar estado según pagos
            $ins->estado = $allPaid ? 'inscrito' : 'pendiente';
            // Calcular estado_arancel granular: sin_pagos | parcial | completo
            if ($total <= 0 || $paid === 0) {
                $ins->estado_arancel = 'sin_pagos';
            } elseif ($paid === $total) {
                $ins->estado_arancel = 'completo';
            } else {
                $ins->estado_arancel = 'parcial';
            }
            $ins->save();

            // Guardar/actualizar Datos de Carrera si vienen en el payload
            if (!empty($data['datos_carrera'])) {
                $dc = $data['datos_carrera'];
                // Normalizar y establecer defaults
                $regIni = (isset($dc['regimen_ini']) && $dc['regimen_ini'] !== '') ? $dc['regimen_ini'] : 'semestral';
                $regFin = (isset($dc['regimen_fin']) && $dc['regimen_fin'] !== '') ? $dc['regimen_fin'] : null;
                if (!$regFin && !empty($dc['gestion_fin'])) {
                    $regFin = $regIni; // si hay gestión fin pero no régimen fin, asumir el mismo
                }
                // Resolver cod_carrera si no viene en datos_carrera
                $codCarr = isset($dc['cod_carrera']) ? $dc['cod_carrera'] : null;
                if ($codCarr === null || $codCarr === '') {
                    $codCarr = $this->resolveCodCarrera((int)$data['cod_ceta_est']);
                }
                $keyDc = ['cod_ceta_est' => $data['cod_ceta_est']];
                if ($codCarr !== null && $codCarr !== '') {
                    $keyDc['cod_carrera'] = $codCarr;
                }
                DatosCarrera::updateOrCreate(
                    $keyDc,
                    [
                        'cod_carrera' => $codCarr,
                        'regimen_ini' => $regIni,
                        'regimen_fin' => $regFin,
                        'gestion_ini' => isset($dc['gestion_ini']) ? $dc['gestion_ini'] : null,
                        'gestion_fin' => isset($dc['gestion_fin']) ? $dc['gestion_fin'] : null,
                        'is_active' => true,
                    ]
                );
            }

            // Guardar Diploma de Bachiller (solo nacional) según payload y esquema actual
            if (!empty($data['diploma_bachiller']) && $data['tipo_bachiller'] === 'nacional' && !empty($data['diploma_bachiller'])) {
                $d = $data['diploma_bachiller'];
                // Sanear número de serie del diploma nacional
                if (isset($d['nro_serie_titulo'])) {
                    $d['nro_serie_titulo'] = $this->sanitizeSerie($d['nro_serie_titulo']);
                }
                DiplomaBachiller::updateOrCreate(
                    ['cod_ceta_est' => $data['cod_ceta_est']],
                    [
                        // Persistir capitalizado
                        'tipo_bachiller' => ucfirst(strtolower($data['tipo_bachiller'])),
                        'nro_serie_titulo' => isset($d['nro_serie_titulo']) ? $d['nro_serie_titulo'] : null,
                        'emision' => data_get($data, 'diploma_bachiller.emision'),
                        'fecha_emision' => data_get($data, 'diploma_bachiller.fecha_emision'),
                        'observacion' => data_get($data, 'diploma_bachiller.observacion'),
                        'gestion_bachillerato' => data_get($data, 'diploma_bachiller.gestion_bachillerato'),
                    ]
                );
            }

            // Guardar Transitabilidad Educación Regular
            if (!empty($data['transitabilidad_edu_reg'])) {
                if (Schema::hasTable('transitabilidad_edu_reg')) {
                    $t = $data['transitabilidad_edu_reg'];
                    // Sanitizar serie y número de título TM
                    if (isset($t['serie_titulo_tm'])) $t['serie_titulo_tm'] = $this->sanitizeSerie($t['serie_titulo_tm']);
                    if (isset($t['numero_titulo_tm'])) $t['numero_titulo_tm'] = $this->sanitizeSerie($t['numero_titulo_tm']);
                    TransitabilidadEduReg::updateOrCreate(
                        ['cod_ceta_est' => $data['cod_ceta_est']],
                        [
                            'serie_titulo_tm' => isset($t['serie_titulo_tm']) ? $t['serie_titulo_tm'] : null,
                            'numero_titulo_tm' => isset($t['numero_titulo_tm']) ? $t['numero_titulo_tm'] : null,
                            'fecha_emision' => isset($t['fecha_emision']) ? $t['fecha_emision'] : null,
                            'observacion' => isset($t['observacion']) ? $t['observacion'] : null,
                            'is_active' => true,
                        ]
                    );
                } else {
                    Log::warning('Tabla transitabilidad_edu_reg no existe; omitiendo guardado de transitabilidad educación regular.', [
                        'cod_ceta_est' => $data['cod_ceta_est']
                    ]);
                }
            }

            // Guardar Transitabilidad Técnico Medio
            if (!empty($data['transitabilidad_inst_tec'])) {
                if (Schema::hasTable('transitabilidad_inst_tec')) {
                    $t2 = $data['transitabilidad_inst_tec'];
                    // Sanitizar serie y número de título TM (inst. técnica)
                    if (isset($t2['serie_titulo_tm'])) $t2['serie_titulo_tm'] = $this->sanitizeSerie($t2['serie_titulo_tm']);
                    if (isset($t2['numero_titulo_tm'])) $t2['numero_titulo_tm'] = $this->sanitizeSerie($t2['numero_titulo_tm']);
                    TransitabilidadInstTec::updateOrCreate(
                        ['cod_ceta_est' => $data['cod_ceta_est']],
                        [
                            'serie_titulo_tm' => isset($t2['serie_titulo_tm']) ? $t2['serie_titulo_tm'] : null,
                            'numero_titulo_tm' => isset($t2['numero_titulo_tm']) ? $t2['numero_titulo_tm'] : null,
                            'fecha_emision' => isset($t2['fecha_emision']) ? $t2['fecha_emision'] : null,
                            'observacion' => isset($t2['observacion']) ? $t2['observacion'] : null,
                            'is_active' => true,
                        ]
                    );
                } else {
                    Log::warning('Tabla transitabilidad_inst_tec no existe; omitiendo guardado de transitabilidad técnico medio.', [
                        'cod_ceta_est' => $data['cod_ceta_est']
                    ]);
                }
            }

            // Se desactiva el uso de ra_homol_ex/grado_homol según decisión: solo se persiste vía grados_bach_extranjero.
            // Los grados serán leídos del payload homol_extranjero.grados_gestiones y vinculados al diploma extranjero.

            // Sin importar si viene o no la resolución, cuando el tipo es extranjero reflejar en diploma_bachiller
            if (!empty($data['tipo_bachiller']) && $data['tipo_bachiller'] === 'extranjero') {
                $nroRes = data_get($data, 'homol_extranjero.nro_resolucion')
                    ?: data_get($data, 'diploma_bachiller.nro_serie_titulo');
                $nroRes = $this->sanitizeSerie($nroRes);
                $diplomaExtranjero = DiplomaBachiller::updateOrCreate(
                    ['cod_ceta_est' => $data['cod_ceta_est']],
                    [
                        // Persistir capitalizado
                        'tipo_bachiller' => 'Extranjero',
                        'nro_resolucion' => $nroRes,
                        'fecha_resolucion' => data_get($data, 'homol_extranjero.fecha_emision'),
                        'is_active' => true,
                    ]
                );

                // Guardar grados/gestiones en tabla grados_bach_extranjero ligada al diploma
                if (!empty($diplomaExtranjero)) {
                    $grados = data_get($data, 'homol_extranjero.grados_gestiones', []);
                    if (!empty($grados) && Schema::hasTable('grados_bach_extranjero')) {
                        Log::info('Guardando grados_bach_extranjero', ['cod_ceta_est' => $data['cod_ceta_est'], 'count' => count($grados)]);
                        // Determinar clave para relación: preferir id del diploma, fallback a cod_ceta_est si no existe id
                        $diplomaKey = isset($diplomaExtranjero->id) ? $diplomaExtranjero->id : null;
                        if ($diplomaKey === null) {
                            $diplomaKey = isset($diplomaExtranjero->cod_ceta_est) ? $diplomaExtranjero->cod_ceta_est : (isset($data['cod_ceta_est']) ? $data['cod_ceta_est'] : null);
                            Log::warning('Diploma sin columna id; usando cod_ceta_est como clave en grados_bach_extranjero.', [
                                'cod_ceta_est' => $diplomaKey
                            ]);
                        }
                        if ($diplomaKey === null) {
                            Log::error('No se pudo determinar clave para grados_bach_extranjero; omitiendo inserción.');
                        } else {
                            // limpiar existentes
                            DB::table('grados_bach_extranjero')
                            ->where('diploma_bachiller_id', $diplomaKey)
                            ->delete();
                            foreach ($grados as $gg) {
                                $g = isset($gg['grado']) ? $gg['grado'] : null;
                                $gest = isset($gg['gestion']) ? $gg['gestion'] : null;
                                if ($g || $gest) {
                                    DB::table('grados_bach_extranjero')->insert([
                                    'diploma_bachiller_id' => $diplomaKey,
                                    'grado' => $g,
                                    'gestion' => $gest,
                                    'created_at' => now(),
                                    'updated_at' => now(),
                                    ]);
                                }
                            }
                        }
                    } elseif (!Schema::hasTable('grados_bach_extranjero')) {
                        Log::warning('Tabla grados_bach_extranjero no existe; omitiendo guardado de grados.', [
                            'cod_ceta_est' => $data['cod_ceta_est']
                        ]);
                    } else {
                        Log::info('No se enviaron grados_gestiones para extranjero; no hay nada que guardar.', [
                            'cod_ceta_est' => $data['cod_ceta_est']
                        ]);
                    }
                }
            }

            // Obtener datos de carrera guardados (si existen)
            $datosCarreraGuardado = null;
            if (!empty($data['cod_ceta_est'])) {
                $datosCarreraGuardado = DatosCarrera::where('cod_ceta_est', $data['cod_ceta_est'])->first();
            }

            // Guardar Traspasos de Instituto y sus grados
            $traspasoGuardado = null;
            if (!empty($data['traspaso_instituto'])) {
                $ti = $data['traspaso_instituto'];
                if (Schema::hasTable('traspasos_instituto')) {
                    // Construir payload sólo con columnas existentes
                    $payloadTrasp = [];
                    if (Schema::hasColumn('traspasos_instituto', 'cod_ceta_est')) {
                        $payloadTrasp['cod_ceta_est'] = $data['cod_ceta_est'];
                    }
                    if (Schema::hasColumn('traspasos_instituto', 'instituto_origen')) {
                        $payloadTrasp['instituto_origen'] = isset($ti['instituto_origen']) ? $ti['instituto_origen'] : null;
                    }
                    if (Schema::hasColumn('traspasos_instituto', 'grados_cursados')) {
                        $payloadTrasp['grados_cursados'] = isset($ti['grados_cursados']) ? $ti['grados_cursados'] : null;
                    }
                    if (Schema::hasColumn('traspasos_instituto', 'gestiones_cursadas')) {
                        $payloadTrasp['gestiones_cursadas'] = isset($ti['gestiones_cursadas']) ? $ti['gestiones_cursadas'] : null;
                    }
                    if (Schema::hasColumn('traspasos_instituto', 'observacion')) {
                        $payloadTrasp['observacion'] = isset($ti['observacion']) ? $ti['observacion'] : null;
                    }
                    if (Schema::hasColumn('traspasos_instituto', 'is_active')) {
                        $payloadTrasp['is_active'] = true;
                    }

                    // Si existe cod_ceta_est en payload, upsert por cod_ceta_est; caso contrario, create
                    if (array_key_exists('cod_ceta_est', $payloadTrasp)) {
                        $traspasoGuardado = TraspasosInstituto::updateOrCreate(
                            ['cod_ceta_est' => $payloadTrasp['cod_ceta_est']],
                            $payloadTrasp
                        );
                    } else {
                        $traspasoGuardado = TraspasosInstituto::create($payloadTrasp);
                    }

                    // Guardar grados en grados_trasp si la tabla existe
                    $gradosT = data_get($ti, 'grados', []);
                    if (!empty($gradosT) && Schema::hasTable('grados_trasp')) {
                        $traspasoId = isset($traspasoGuardado->id) ? $traspasoGuardado->id : null;
                        if ($traspasoId) {
                            // Limpiar existentes
                            DB::table('grados_trasp')->where('traspaso_id', $traspasoId)->delete();
                            foreach ($gradosT as $gt) {
                                $g = isset($gt['grado']) ? $gt['grado'] : null;
                                $gest = isset($gt['gestion']) ? $gt['gestion'] : null;
                                if ($g || $gest) {
                                    DB::table('grados_trasp')->insert([
                                        'traspaso_id' => $traspasoId,
                                        'grado' => $g,
                                        'gestion' => $gest,
                                        'created_at' => now(),
                                        'updated_at' => now(),
                                    ]);
                                }
                            }
                        } else {
                            Log::warning('No se pudo obtener id de traspasos_instituto para vincular grados_trasp.');
                        }
                    } elseif (!Schema::hasTable('grados_trasp')) {
                        Log::warning('Tabla grados_trasp no existe; omitiendo detalle de grados traspaso.');
                    }
                } else {
                    Log::warning('Tabla traspasos_instituto no existe; omitiendo guardado de traspaso.');
                }
            }

            // Obtener diploma guardado
            $diplomaGuardado = DiplomaBachiller::where('cod_ceta_est', $data['cod_ceta_est'])->first();

            // Guardar Homologación por Cambio de Plan y sus grados (tablas: homologacion_cambio_plan, grados_homologacion_cp)
            $homolCpGuardado = null;
            if (!empty($data['homol_cambio_plan'])) {
                $cp = $data['homol_cambio_plan'];
                if (Schema::hasTable('homologacion_cambio_plan')) {
                    // Construir payload solo con columnas existentes
                    $payloadCp = [];
                    if (Schema::hasColumn('homologacion_cambio_plan', 'cod_ceta_est')) {
                        $payloadCp['cod_ceta_est'] = isset($data['cod_ceta_est']) ? $data['cod_ceta_est'] : null;
                    }
                    if (Schema::hasColumn('homologacion_cambio_plan', 'nro_resolucion')) {
                        $payloadCp['nro_resolucion'] = isset($cp['nro_resolucion']) ? $this->sanitizeSerie($cp['nro_resolucion']) : null;
                    }
                    if (Schema::hasColumn('homologacion_cambio_plan', 'fecha_emision')) {
                        $payloadCp['fecha_emision'] = isset($cp['fecha_emision']) ? $cp['fecha_emision'] : null;
                    }
                    if (Schema::hasColumn('homologacion_cambio_plan', 'grados_cursados')) {
                        $payloadCp['grados_cursados'] = isset($cp['grados_cursados']) ? $cp['grados_cursados'] : null;
                    }
                    if (Schema::hasColumn('homologacion_cambio_plan', 'gestiones_cursadas')) {
                        $payloadCp['gestiones_cursadas'] = isset($cp['gestiones_cursadas']) ? $cp['gestiones_cursadas'] : null;
                    }
                    // Upsert por nro_resolucion si existe, caso contrario create
                    if (!empty($payloadCp['nro_resolucion'])) {
                        $exists = DB::table('homologacion_cambio_plan')->where('nro_resolucion', $payloadCp['nro_resolucion'])->first();
                        if ($exists) {
                            // Actualizar por nro_resolucion para no depender de una columna 'id' inexistente
                            DB::table('homologacion_cambio_plan')
                                ->where('nro_resolucion', $payloadCp['nro_resolucion'])
                                ->update(array_merge($payloadCp, ['updated_at' => now()]));
                            $homolCpGuardado = DB::table('homologacion_cambio_plan')->where('nro_resolucion', $payloadCp['nro_resolucion'])->first();
                        } else {
                            // Insert y obtención robusta del registro insertado
                            $id = null;
                            if (Schema::hasColumn('homologacion_cambio_plan', 'id')) {
                                $id = DB::table('homologacion_cambio_plan')->insertGetId(array_merge($payloadCp, [
                                    'created_at' => now(),
                                    'updated_at' => now(),
                                ]));
                            } else {
                                DB::table('homologacion_cambio_plan')->insert(array_merge($payloadCp, [
                                    'created_at' => now(),
                                    'updated_at' => now(),
                                ]));
                            }
                            $homolCpGuardado = $id !== null
                                ? DB::table('homologacion_cambio_plan')->where('id', $id)->first()
                                : DB::table('homologacion_cambio_plan')->where('nro_resolucion', $payloadCp['nro_resolucion'])->first();
                        }
                    } else {
                        // Sin nro_resolucion: insert directo
                        $id = null;
                        if (Schema::hasColumn('homologacion_cambio_plan', 'id')) {
                            $id = DB::table('homologacion_cambio_plan')->insertGetId(array_merge($payloadCp, [
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]));
                            $homolCpGuardado = DB::table('homologacion_cambio_plan')->where('id', $id)->first();
                        } else {
                            DB::table('homologacion_cambio_plan')->insert(array_merge($payloadCp, [
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]));
                            // Si no hay 'id' ni 'nro_resolucion' para identificar, no podemos recuperar con certeza
                            $homolCpGuardado = null;
                            Log::warning('homologacion_cambio_plan insertado sin id ni nro_resolucion; no se puede recuperar el registro automáticamente.');
                        }
                    }

                    // Guardar grados en grados_homologacion_cp si existe
                    $gradosCp = data_get($cp, 'grados_gestiones', []);
                    if ($homolCpGuardado && Schema::hasTable('grados_homologacion_cp') && !empty($gradosCp)) {
                        // Determinar nombre de columna FK admitiendo varias convenciones
                        $fk = null;
                        foreach (['homologacion_cambio_plan_id', 'homologacion_cambio_plan', 'homol_cp_id', 'cambio_plan_id', 'homologacion_id', 'id_homologacion'] as $cand) {
                            if (Schema::hasColumn('grados_homologacion_cp', $cand)) { $fk = $cand; break; }
                        }
                        if ($fk) {
                            // Obtener valor para la FK: preferir 'id' si existe; si no, usar nro_resolucion si la FK parece textual
                            $parentIdVal = property_exists($homolCpGuardado, 'id') ? $homolCpGuardado->id : null;
                            if ($parentIdVal === null) {
                                if (in_array($fk, ['homologacion_cambio_plan', 'homologacion'])) {
                                    $parentIdVal = isset($homolCpGuardado->nro_resolucion) ? $homolCpGuardado->nro_resolucion : null;
                                }
                            }
                            if ($parentIdVal === null) {
                                Log::warning('No se pudo determinar valor para la FK en grados_homologacion_cp; omitiendo inserción de grados.', ['fk' => $fk]);
                            } else {
                                DB::table('grados_homologacion_cp')->where($fk, $parentIdVal)->delete();
                                $insertados = 0;
                                foreach ($gradosCp as $gg) {
                                    $g = isset($gg['grado']) ? $gg['grado'] : null;
                                    $gest = isset($gg['gestion']) ? $gg['gestion'] : null;
                                    if ($g || $gest) {
                                        DB::table('grados_homologacion_cp')->insert([
                                            $fk => $parentIdVal,
                                            'grado' => $g,
                                            'gestion' => $gest,
                                            'created_at' => now(),
                                            'updated_at' => now(),
                                        ]);
                                        $insertados++;
                                    }
                                }
                                Log::info('Grados de homologación CP insertados', [
                                    'parent_val' => $parentIdVal,
                                    'count' => $insertados,
                                    'fk' => $fk,
                                    'primer_grado' => (isset($gradosCp[0]['grado']) ? $gradosCp[0]['grado'] : null),
                                    'primer_gestion' => (isset($gradosCp[0]['gestion']) ? $gradosCp[0]['gestion'] : null),
                                ]);
                            }
                        } else {
                            Log::warning('Tabla grados_homologacion_cp no tiene columna FK esperada (homol_cp_id, cambio_plan_id, homologacion_id o id_homologacion).');
                        }
                    }
                } else {
                    Log::warning('Tabla homologacion_cambio_plan no existe; omitiendo guardado de homologación por cambio de plan.');
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Inscripción registrada correctamente',
                'data' => [
                    'inscripcion' => $ins,
                    'datos_carrera' => isset($data['datos_carrera']) ? $data['datos_carrera'] : null,
                    'datos_carrera_guardado' => $datosCarreraGuardado,
                    'diploma_bachiller_guardado' => $diplomaGuardado,
                    'traspaso_instituto_guardado' => $traspasoGuardado,
                    'homol_cambio_plan_guardado' => $homolCpGuardado,
                ],
            ]);
        });
    }
}