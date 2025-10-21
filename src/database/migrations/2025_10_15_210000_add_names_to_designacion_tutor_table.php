<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AddNamesToDesignacionTutorTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('designacion_tutor')) {
            Schema::table('designacion_tutor', function (Blueprint $table) {
                if (!Schema::hasColumn('designacion_tutor', 'tutor_nombre')) {
                    $table->string('tutor_nombre', 255)->nullable()->after('tutor_id');
                }
                if (!Schema::hasColumn('designacion_tutor', 'estudiante_nombre')) {
                    $table->string('estudiante_nombre', 255)->nullable()->after('cod_ceta');
                }
            });

            // Backfill nombres para registros existentes
            DB::statement(
                'UPDATE designacion_tutor dt
                 LEFT JOIN postulantes p ON p.cod_ceta = dt.cod_ceta
                 LEFT JOIN tutores t ON t.id = dt.tutor_id
                 SET dt.estudiante_nombre = TRIM(CONCAT_WS(CHAR(32), p.nombres_est, p.ap_pat, p.ap_mat)),
                     dt.tutor_nombre      = TRIM(CONCAT_WS(CHAR(32), t.nombre, t.apellido_p, t.apellido_m))'
            );

            // Triggers para poblar nombres automáticamente en INSERT/UPDATE directos (desde DB)
            DB::unprepared('DROP TRIGGER IF EXISTS trg_designacion_tutor_bi;');
            DB::unprepared(
                'CREATE TRIGGER trg_designacion_tutor_bi
                 BEFORE INSERT ON designacion_tutor FOR EACH ROW
                 SET NEW.estudiante_nombre = (
                        SELECT TRIM(CONCAT_WS(CHAR(32), p.nombres_est, p.ap_pat, p.ap_mat))
                        FROM postulantes p WHERE p.cod_ceta = NEW.cod_ceta LIMIT 1
                     ),
                     NEW.tutor_nombre = (
                        SELECT TRIM(CONCAT_WS(CHAR(32), t.nombre, t.apellido_p, t.apellido_m))
                        FROM tutores t WHERE t.id = NEW.tutor_id LIMIT 1
                     )'
            );

            DB::unprepared('DROP TRIGGER IF EXISTS trg_designacion_tutor_bu;');
            DB::unprepared(
                'CREATE TRIGGER trg_designacion_tutor_bu
                 BEFORE UPDATE ON designacion_tutor FOR EACH ROW
                 SET NEW.estudiante_nombre = (
                        SELECT TRIM(CONCAT_WS(CHAR(32), p.nombres_est, p.ap_pat, p.ap_mat))
                        FROM postulantes p WHERE p.cod_ceta = NEW.cod_ceta LIMIT 1
                     ),
                     NEW.tutor_nombre = (
                        SELECT TRIM(CONCAT_WS(CHAR(32), t.nombre, t.apellido_p, t.apellido_m))
                        FROM tutores t WHERE t.id = NEW.tutor_id LIMIT 1
                     )'
            );
        }
    }

    public function down()
    {
        if (Schema::hasTable('designacion_tutor')) {
            // Eliminar triggers
            DB::unprepared('DROP TRIGGER IF EXISTS trg_designacion_tutor_bi;');
            DB::unprepared('DROP TRIGGER IF EXISTS trg_designacion_tutor_bu;');

            Schema::table('designacion_tutor', function (Blueprint $table) {
                if (Schema::hasColumn('designacion_tutor', 'estudiante_nombre')) {
                    $table->dropColumn('estudiante_nombre');
                }
                if (Schema::hasColumn('designacion_tutor', 'tutor_nombre')) {
                    $table->dropColumn('tutor_nombre');
                }
            });
        }
    }
}
