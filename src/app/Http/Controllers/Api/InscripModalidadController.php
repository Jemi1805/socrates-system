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
    
    protected function rules()
    {
        return [
            'cod_ceta_est' => 'nullable|integer',
            'modalidad_id' => 'nullable|exists:modalidad,id',
            // columnas legacy removidas
            'fecha_inscripcion' => 'nullable|date',
            'estado' => 'nullable|string|max:255',
        ];
    }

    // Registro de inscripción con aranceles seleccionados en una sola operación
    public function storeWithAranceles(Request $request)
    {
        $data = $request->validate([
            'cod_ceta_est' => 'required|integer',
            'nombres_est' => 'nullable|string|max:150',
            'apellidos_est' => 'nullable|string|max:200',
            'modalidad_id' => 'nullable|exists:modalidad,id',
            'modalidad_nom' => 'nullable|string|max:120',
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
            $ins = new InscripModalidad();
            $ins->cod_ceta_est = $data['cod_ceta_est'];
            if (isset($data['nombres_est'])) $ins->nombres_est = $data['nombres_est'];
            if (isset($data['apellidos_est'])) $ins->apellidos_est = $data['apellidos_est'];
            if (isset($data['modalidad_id'])) $ins->modalidad_id = $data['modalidad_id'];
            if (isset($data['modalidad_nom'])) $ins->modalidad_nom = $data['modalidad_nom'];
            if (isset($data['aranceles_completos'])) $ins->aranceles_completos = (bool)$data['aranceles_completos'];
            // Usuario registrador
            $ins->user_id = isset($data['user_id']) ? $data['user_id'] : ($user ? $user->id : null);
            // Preferir nombre_usuario; si no, email; si el payload lo trae explícito, respetarlo
            if (isset($data['user_name'])) {
                $ins->user_name = $data['user_name'];
            } else if ($user) {
                $ins->user_name = $user->nombre_usuario ? $user->nombre_usuario : $user->email;
            }
            // Valores por defecto
            $ins->fecha_inscripcion = now()->toDateString();
            $ins->estado = 'pendiente';
            $ins->save();

            $allPaid = true;
            if (!empty($data['aranceles'])) {
                foreach ($data['aranceles'] as $a) {
                    $item = null;
                    if (!empty($a['id'])) {
                        $item = ArancelesEst::find($a['id']);
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
                    if (!$item->pagado) $allPaid = false;
                }
            } else {
                // Si no hay aranceles en el payload, no es pago completo
                $allPaid = false;
            }

            // Actualizar pago completo si corresponde
            $ins->aranceles_completos = $allPaid ? 1 : 0;
            // Actualizar estado según pagos
            $ins->estado = $allPaid ? 'inscrito' : 'pendiente';
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
                DatosCarrera::updateOrCreate(
                    ['cod_ceta_est' => $data['cod_ceta_est']],
                    [
                        'regimen_ini' => $regIni,
                        'regimen_fin' => $regFin,
                        'gestion_ini' => $dc['gestion_ini'] ?? null,
                        'gestion_fin' => $dc['gestion_fin'] ?? null,
                        'is_active' => true,
                    ]
                );
            }

            // Guardar Diploma de Bachiller (solo nacional) según payload y esquema actual
            if (!empty($data['tipo_bachiller']) && $data['tipo_bachiller'] === 'nacional' && !empty($data['diploma_bachiller'])) {
                $d = $data['diploma_bachiller'];
                DiplomaBachiller::updateOrCreate(
                    ['cod_ceta_est' => $data['cod_ceta_est']],
                    [
                        'tipo_bachiller' => $data['tipo_bachiller'],
                        'nro_serie_titulo' => data_get($data, 'diploma_bachiller.nro_serie_titulo'),
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
                    TransitabilidadEduReg::updateOrCreate(
                        ['cod_ceta_est' => $data['cod_ceta_est']],
                        [
                            'serie_titulo_tm' => $t['serie_titulo_tm'] ?? null,
                            'numero_titulo_tm' => $t['numero_titulo_tm'] ?? null,
                            'fecha_emision' => $t['fecha_emision'] ?? null,
                            'observacion' => $t['observacion'] ?? null,
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
                    TransitabilidadInstTec::updateOrCreate(
                        ['cod_ceta_est' => $data['cod_ceta_est']],
                        [
                            'serie_titulo_tm' => $t2['serie_titulo_tm'] ?? null,
                            'numero_titulo_tm' => $t2['numero_titulo_tm'] ?? null,
                            'fecha_emision' => $t2['fecha_emision'] ?? null,
                            'observacion' => $t2['observacion'] ?? null,
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
                $diplomaExtranjero = DiplomaBachiller::updateOrCreate(
                    ['cod_ceta_est' => $data['cod_ceta_est']],
                    [
                        'tipo_bachiller' => 'extranjero',
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
                        $diplomaKey = $diplomaExtranjero->id ?? null;
                        if ($diplomaKey === null) {
                            $diplomaKey = $diplomaExtranjero->cod_ceta_est ?? ($data['cod_ceta_est'] ?? null);
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
                                $g = $gg['grado'] ?? null;
                                $gest = $gg['gestion'] ?? null;
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
                        $payloadTrasp['instituto_origen'] = $ti['instituto_origen'] ?? null;
                    }
                    if (Schema::hasColumn('traspasos_instituto', 'grados_cursados')) {
                        $payloadTrasp['grados_cursados'] = $ti['grados_cursados'] ?? null;
                    }
                    if (Schema::hasColumn('traspasos_instituto', 'gestiones_cursadas')) {
                        $payloadTrasp['gestiones_cursadas'] = $ti['gestiones_cursadas'] ?? null;
                    }
                    if (Schema::hasColumn('traspasos_instituto', 'observacion')) {
                        $payloadTrasp['observacion'] = $ti['observacion'] ?? null;
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
                        $traspasoId = $traspasoGuardado->id ?? null;
                        if ($traspasoId) {
                            // Limpiar existentes
                            DB::table('grados_trasp')->where('traspaso_id', $traspasoId)->delete();
                            foreach ($gradosT as $gt) {
                                $g = $gt['grado'] ?? null;
                                $gest = $gt['gestion'] ?? null;
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
                        $payloadCp['cod_ceta_est'] = $data['cod_ceta_est'] ?? null;
                    }
                    if (Schema::hasColumn('homologacion_cambio_plan', 'nro_resolucion')) {
                        $payloadCp['nro_resolucion'] = $cp['nro_resolucion'] ?? null;
                    }
                    if (Schema::hasColumn('homologacion_cambio_plan', 'fecha_emision')) {
                        $payloadCp['fecha_emision'] = $cp['fecha_emision'] ?? null;
                    }
                    if (Schema::hasColumn('homologacion_cambio_plan', 'grados_cursados')) {
                        $payloadCp['grados_cursados'] = $cp['grados_cursados'] ?? null;
                    }
                    if (Schema::hasColumn('homologacion_cambio_plan', 'gestiones_cursadas')) {
                        $payloadCp['gestiones_cursadas'] = $cp['gestiones_cursadas'] ?? null;
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
                                    $parentIdVal = $homolCpGuardado->nro_resolucion ?? null;
                                }
                            }
                            if ($parentIdVal === null) {
                                Log::warning('No se pudo determinar valor para la FK en grados_homologacion_cp; omitiendo inserción de grados.', ['fk' => $fk]);
                            } else {
                                DB::table('grados_homologacion_cp')->where($fk, $parentIdVal)->delete();
                                $insertados = 0;
                                foreach ($gradosCp as $gg) {
                                    $g = $gg['grado'] ?? null;
                                    $gest = $gg['gestion'] ?? null;
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
                                    'primer_grado' => $gradosCp[0]['grado'] ?? null,
                                    'primer_gestion' => $gradosCp[0]['gestion'] ?? null,
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
                    'datos_carrera' => $data['datos_carrera'] ?? null,
                    'datos_carrera_guardado' => $datosCarreraGuardado,
                    'diploma_bachiller_guardado' => $diplomaGuardado,
                    'traspaso_instituto_guardado' => $traspasoGuardado,
                    'homol_cambio_plan_guardado' => $homolCpGuardado,
                ],
            ]);
        });
    }
}