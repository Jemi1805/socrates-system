<?php

namespace App\Http\Controllers;

use App\Models\Postulante;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class InscripcionController extends Controller
{
    /**
     * Devuelve un payload composite con todos los datos de inscripción
     * para prellenado del frontend.
     */
    public function showByCodCeta($cod_ceta)
    {
        try {
            $postulante = Postulante::query()
                ->where('cod_ceta', (int) $cod_ceta)
                ->first();

            if (!$postulante) {
                return response()->json(['message' => 'Postulante no encontrado'], Response::HTTP_NOT_FOUND);
            }

            $pid = isset($postulante->id) ? $postulante->id : null; // Puede no usarse si las tablas se vinculan por cod_ceta_est

        // Diploma Bachiller (nacional) - se vincula por cod_ceta_est
        $diploma = Schema::hasTable('diploma_bachiller')
            ? DB::table('diploma_bachiller')->where('cod_ceta_est', (int) $cod_ceta)->orderByDesc('updated_at')->first()
            : null;

        // Homologación Extranjero (RA) y sus grados
        // Nota: en el esquema actual no hay columna cod_ceta_est directa en ra_homol_ex.
        // Hasta definir la relación exacta, devolvemos null para evitar errores.
        $ra = null;
        $gradosRa = [];
        // if ($ra) { ... }

        // Datos de carrera (inicio/conclusión) - vinculados por cod_ceta_est
        $datosCarrera = Schema::hasTable('datos_carrera')
            ? DB::table('datos_carrera')->where('cod_ceta_est', (int) $cod_ceta)->first()
            : null;

        // Transitabilidad Educación Regular (cod_ceta_est)
        $eduReg = Schema::hasTable('transitabilidad_edu_reg')
            ? DB::table('transitabilidad_edu_reg')->where('cod_ceta_est', (int) $cod_ceta)->first()
            : null;

        // Transitabilidad Nivel Técnico Medio (cod_ceta_est)
        $tecMed = Schema::hasTable('transitabilidad_inst_tec')
            ? DB::table('transitabilidad_inst_tec')->where('cod_ceta_est', (int) $cod_ceta)->first()
            : null;

        // Traspaso de Instituto y sus grados (cod_ceta_est)
        $trasp = Schema::hasTable('traspasos_instituto')
            ? DB::table('traspasos_instituto')->where('cod_ceta_est', (int) $cod_ceta)->first()
            : null;
        $gradosTrasp = [];
        if ($trasp) {
            // Intentar ambas FK comunes
            $colTrasp = Schema::hasTable('grados_trasp')
                ? DB::table('grados_trasp')
                    ->where(function ($q) use ($trasp) {
                        $q->where('traspasos_instituto_id', $trasp->id)
                          ->orWhere('traspaso_id', $trasp->id);
                    })
                    ->get()
                : collect();
            $gradosTrasp = $colTrasp->map(function ($g) {
                return [
                    'grado' => isset($g->grado) ? $g->grado : null,
                    'gestion' => isset($g->gestion) ? $g->gestion : null,
                ];
            })->values()->toArray();
        }

        // Homologación por Cambio de Plan y sus grados
        // Nota: en el esquema actual no hay columna cod_ceta_est directa en res_homol_cp.
        // Hasta definir la relación exacta, devolvemos null para evitar errores.
        $cp = null;
        $gradosCp = [];
        // if ($cp) { ... }

        // Inscripción de modalidad (para recuperar aranceles_completos y estado)
        $insRow = Schema::hasTable('inscrip_modalidad')
            ? DB::table('inscrip_modalidad')->where('cod_ceta_est', (int) $cod_ceta)->orderByDesc('updated_at')->first()
            : null;
        $arancelesCompletos = $insRow && isset($insRow->aranceles_completos) ? (bool)$insRow->aranceles_completos : null;
        $estadoInscripcion = $insRow && isset($insRow->estado) ? $insRow->estado : null;

        // Armar payload conforme al mapeo del FE
        $payload = [
            'cod_ceta' => $postulante->cod_ceta,
            'nombres_est' => $postulante->nombres_est,
            'ap_pat' => $postulante->ap_pat,
            'ap_mat' => $postulante->ap_mat,
            'ci' => $postulante->ci,
            'procedencia' => (isset($postulante->procedencia) && $postulante->procedencia !== null && $postulante->procedencia !== '') ? $postulante->procedencia : $postulante->expedido,
            'fecha_nacimiento' => $postulante->fecha_nacimiento,
            'lugar_nacimiento' => $postulante->lugar_nacimiento,
            'carrera' => $postulante->carrera,
            'pensum' => $postulante->pensum,
            'tipo_bachiller' => $postulante->tipo_bachiller,
            'nro_serie_titulo' => $postulante->nro_serie_titulo,

            // Inicio/Conclusión (si existe tabla usarla; si no, columnas del postulante)
            'reg_ini_c' => ($datosCarrera && isset($datosCarrera->regimen_ini)) ? $datosCarrera->regimen_ini : $postulante->reg_ini_c,
            'gestion_ini' => ($datosCarrera && isset($datosCarrera->gestion_ini)) ? $datosCarrera->gestion_ini : $postulante->gestion_ini,
            'reg_con_c' => ($datosCarrera && isset($datosCarrera->regimen_fin)) ? $datosCarrera->regimen_fin : $postulante->reg_con_c,
            'gestion_fin' => ($datosCarrera && isset($datosCarrera->gestion_fin)) ? $datosCarrera->gestion_fin : $postulante->gestion_fin,

            // Bachiller nacional
            'diploma_bachiller' => $diploma ? [
                'nro_serie' => isset($diploma->nro_serie_titulo) ? $diploma->nro_serie_titulo : (isset($diploma->nro_serie) ? $diploma->nro_serie : null),
                'emision' => isset($diploma->emision) ? $diploma->emision : null,
                'fecha_emision' => isset($diploma->fecha_emision) ? $diploma->fecha_emision : null,
                'observacion' => isset($diploma->observacion) ? $diploma->observacion : null,
                'gestion_bachillerato' => isset($diploma->gestion_bachillerato) ? $diploma->gestion_bachillerato : null,
            ] : null,

            // Bachiller extranjero
            'homologacion_extranjero' => $ra ? [
                'nro_resolucion' => null,
                'fecha_emision' => null,
                'grados_gestiones' => $gradosRa,
            ] : null,

            // Casos especiales
            'educacion_regular' => $eduReg ? [
                'serie_titulo_tm' => isset($eduReg->serie_titulo_tm) ? $eduReg->serie_titulo_tm : null,
                'numero_titulo_tm' => isset($eduReg->numero_titulo_tm) ? $eduReg->numero_titulo_tm : null,
                'fecha_emision' => isset($eduReg->fecha_emision) ? $eduReg->fecha_emision : null,
            ] : null,

            'tecnico_medio' => $tecMed ? [
                'serie_titulo_tm' => isset($tecMed->serie_titulo_tm) ? $tecMed->serie_titulo_tm : null,
                'numero_titulo_tm' => isset($tecMed->numero_titulo_tm) ? $tecMed->numero_titulo_tm : null,
                'fecha_emision' => isset($tecMed->fecha_emision) ? $tecMed->fecha_emision : null,
            ] : null,

            'traspaso_instituto' => $trasp ? [
                'instituto_origen' => isset($trasp->instituto_origen) ? $trasp->instituto_origen : null,
                'grados_gestiones' => $gradosTrasp,
            ] : null,

            'homol_cambio_plan' => $cp ? [
                'nro_resolucion_rectoral' => null,
                'fecha_emision' => null,
                'grados_gestiones' => $gradosCp,
            ] : null,

            // Indicadores de inscripción
            'aranceles_completos' => $arancelesCompletos,
            'estado' => $estadoInscripcion,
        ];

            return response()->json($payload);
        } catch (\Throwable $e) {
            Log::error('[InscripcionController@showByCodCeta] Error composite', [
                'cod_ceta' => $cod_ceta,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json(['message' => 'Error al componer inscripción', 'error' => $e->getMessage()], 500);
        }
    }
}
