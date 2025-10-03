<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AddAdditionalFkRelations extends Migration
{
    public function up()
    {
        // Normalizar tipos de columnas
        if (Schema::hasTable('inscrip_modalidad') && Schema::hasColumn('inscrip_modalidad', 'cod_ceta_est')) {
            DB::statement('ALTER TABLE inscrip_modalidad MODIFY COLUMN cod_ceta_est BIGINT UNSIGNED NULL');
        }
        if (Schema::hasTable('grados_bach_extranjero') && Schema::hasColumn('grados_bach_extranjero', 'diploma_bachiller_id')) {
            DB::statement('ALTER TABLE grados_bach_extranjero MODIFY COLUMN diploma_bachiller_id BIGINT UNSIGNED NOT NULL');
        }
        if (Schema::hasTable('grados_homologacion_cp') && Schema::hasColumn('grados_homologacion_cp', 'homologacion_cambio_plan_id')) {
            DB::statement('ALTER TABLE grados_homologacion_cp MODIFY COLUMN homologacion_cambio_plan_id BIGINT UNSIGNED NOT NULL');
        }

        // FK: inscrip_modalidad.cod_ceta_est -> postulantes.cod_ceta
        if (Schema::hasTable('inscrip_modalidad') && Schema::hasTable('postulantes')) {
            $fk = 'inscrip_modalidad_cod_ceta_est_foreign';
            if (!$this->fkExists('inscrip_modalidad', $fk)) {
                Schema::table('inscrip_modalidad', function (Blueprint $table) use ($fk) {
                    $table->foreign('cod_ceta_est', $fk)
                          ->references('cod_ceta')
                          ->on('postulantes')
                          ->onDelete('cascade');
                });
            }
        }

        // FK: grados_bach_extranjero.diploma_bachiller_id -> diploma_bachiller.id
        // Solo crear si existe la columna 'id' en diploma_bachiller (esquemas antiguos no la tenían)
        if (Schema::hasTable('grados_bach_extranjero') && Schema::hasTable('diploma_bachiller') && Schema::hasColumn('diploma_bachiller', 'id')) {
            $fk = 'grados_bach_extranjero_diploma_bachiller_id_foreign';
            if (!$this->fkExists('grados_bach_extranjero', $fk)) {
                Schema::table('grados_bach_extranjero', function (Blueprint $table) use ($fk) {
                    $table->foreign('diploma_bachiller_id', $fk)
                          ->references('id')
                          ->on('diploma_bachiller')
                          ->onDelete('cascade');
                });
            }
        }

        // FK: grados_homologacion_cp.homologacion_cambio_plan_id -> homologacion_cambio_plan.id
        if (Schema::hasTable('grados_homologacion_cp') && Schema::hasTable('homologacion_cambio_plan')) {
            $fk = 'grados_homologacion_cp_homologacion_cambio_plan_id_foreign';
            if (!$this->fkExists('grados_homologacion_cp', $fk)) {
                Schema::table('grados_homologacion_cp', function (Blueprint $table) use ($fk) {
                    $table->foreign('homologacion_cambio_plan_id', $fk)
                          ->references('id')
                          ->on('homologacion_cambio_plan')
                          ->onDelete('cascade');
                });
            }
        }
    }

    public function down()
    {
        // Drop FK: inscrip_modalidad.cod_ceta_est
        if (Schema::hasTable('inscrip_modalidad')) {
            $fk = 'inscrip_modalidad_cod_ceta_est_foreign';
            if ($this->fkExists('inscrip_modalidad', $fk)) {
                Schema::table('inscrip_modalidad', function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk);
                });
            }
        }
        // Drop FK: grados_bach_extranjero.diploma_bachiller_id
        if (Schema::hasTable('grados_bach_extranjero')) {
            $fk = 'grados_bach_extranjero_diploma_bachiller_id_foreign';
            if ($this->fkExists('grados_bach_extranjero', $fk)) {
                Schema::table('grados_bach_extranjero', function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk);
                });
            }
        }
        // Drop FK: grados_homologacion_cp.homologacion_cambio_plan_id
        if (Schema::hasTable('grados_homologacion_cp')) {
            $fk = 'grados_homologacion_cp_homologacion_cambio_plan_id_foreign';
            if ($this->fkExists('grados_homologacion_cp', $fk)) {
                Schema::table('grados_homologacion_cp', function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk);
                });
            }
        }
    }

    private function fkExists($table, $fkName)
    {
        $database = DB::getDatabaseName();
        $sql = "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_NAME = ?";
        $res = DB::select($sql, [$database, $fkName]);
        return !empty($res);
    }
}
