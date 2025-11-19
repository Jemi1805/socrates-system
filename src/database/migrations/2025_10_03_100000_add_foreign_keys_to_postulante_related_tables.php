<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AddForeignKeysToPostulanteRelatedTables extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        // Asegurar tipos de columna vía SQL nativo (evita necesidad de doctrine/dbal)
        if (Schema::hasTable('diploma_bachiller') && Schema::hasColumn('diploma_bachiller', 'cod_ceta_est')) {
            DB::statement('ALTER TABLE diploma_bachiller MODIFY COLUMN cod_ceta_est BIGINT UNSIGNED NOT NULL');
        }
        if (Schema::hasTable('datos_carrera') && Schema::hasColumn('datos_carrera', 'cod_ceta_est')) {
            DB::statement('ALTER TABLE datos_carrera MODIFY COLUMN cod_ceta_est BIGINT UNSIGNED NOT NULL');
        }
        if (Schema::hasTable('aranceles_est') && Schema::hasColumn('aranceles_est', 'cod_ceta_est')) {
            DB::statement('ALTER TABLE aranceles_est MODIFY COLUMN cod_ceta_est BIGINT UNSIGNED NULL');
        }
        if (Schema::hasTable('inscrip_modalidad') && Schema::hasColumn('inscrip_modalidad', 'cod_ceta_est')) {
            DB::statement('ALTER TABLE inscrip_modalidad MODIFY COLUMN cod_ceta_est BIGINT UNSIGNED NULL');
        }

        // Agregar FK en diploma_bachiller
        if (Schema::hasTable('diploma_bachiller') && Schema::hasTable('postulantes')) {
            $fk = 'diploma_bachiller_cod_ceta_est_foreign';
            if (!$this->fkExists('diploma_bachiller', $fk)) {
                Schema::table('diploma_bachiller', function (Blueprint $table) use ($fk) {
                    $table->foreign('cod_ceta_est', $fk)
                          ->references('cod_ceta')
                          ->on('postulantes')
                          ->onDelete('cascade');
                });
            }
        }

        // Agregar FK en datos_carrera
        if (Schema::hasTable('datos_carrera') && Schema::hasTable('postulantes')) {
            $fk = 'datos_carrera_cod_ceta_est_foreign';
            if (!$this->fkExists('datos_carrera', $fk)) {
                Schema::table('datos_carrera', function (Blueprint $table) use ($fk) {
                    $table->foreign('cod_ceta_est', $fk)
                          ->references('cod_ceta')
                          ->on('postulantes')
                          ->onDelete('cascade');
                });
            }
        }

        // Agregar FK en aranceles_est
        if (Schema::hasTable('aranceles_est') && Schema::hasTable('postulantes')) {
            $fk = 'aranceles_est_cod_ceta_est_foreign';
            if (!$this->fkExists('aranceles_est', $fk)) {
                Schema::table('aranceles_est', function (Blueprint $table) use ($fk) {
                    $table->foreign('cod_ceta_est', $fk)
                          ->references('cod_ceta')
                          ->on('postulantes')
                          ->onDelete('cascade');
                });
            }
        }

        // Agregar FK en inscrip_modalidad -> postulantes
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

        // Agregar FK en grados_bach_extranjero -> diploma_bachiller
        // Solo si 'diploma_bachiller' ya tiene la columna 'id' (esquemas antiguos no la tenían)
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

        // Agregar FK en grados_homologacion_cp -> homologacion_cambio_plan
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

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        // Eliminar FK de diploma_bachiller
        if (Schema::hasTable('diploma_bachiller')) {
            $fk = 'diploma_bachiller_cod_ceta_est_foreign';
            if ($this->fkExists('diploma_bachiller', $fk)) {
                Schema::table('diploma_bachiller', function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk);
                });
            }
        }

        // Eliminar FK de datos_carrera
        if (Schema::hasTable('datos_carrera')) {
            $fk = 'datos_carrera_cod_ceta_est_foreign';
            if ($this->fkExists('datos_carrera', $fk)) {
                Schema::table('datos_carrera', function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk);
                });
            }
        }

        // Eliminar FK de aranceles_est
        if (Schema::hasTable('aranceles_est')) {
            $fk = 'aranceles_est_cod_ceta_est_foreign';
            if ($this->fkExists('aranceles_est', $fk)) {
                Schema::table('aranceles_est', function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk);
                });
            }
        }

        // Eliminar FK de inscrip_modalidad
        if (Schema::hasTable('inscrip_modalidad')) {
            $fk = 'inscrip_modalidad_cod_ceta_est_foreign';
            if ($this->fkExists('inscrip_modalidad', $fk)) {
                Schema::table('inscrip_modalidad', function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk);
                });
            }
        }

        // Eliminar FK de grados_bach_extranjero
        if (Schema::hasTable('grados_bach_extranjero')) {
            $fk = 'grados_bach_extranjero_diploma_bachiller_id_foreign';
            if ($this->fkExists('grados_bach_extranjero', $fk)) {
                Schema::table('grados_bach_extranjero', function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk);
                });
            }
        }

        // Eliminar FK de grados_homologacion_cp
        if (Schema::hasTable('grados_homologacion_cp')) {
            $fk = 'grados_homologacion_cp_homologacion_cambio_plan_id_foreign';
            if ($this->fkExists('grados_homologacion_cp', $fk)) {
                Schema::table('grados_homologacion_cp', function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk);
                });
            }
        }
    }

    /**
     * Verifica si existe una clave foránea en MySQL usando INFORMATION_SCHEMA
     */
    private function fkExists(string $table, string $fkName)
    {
        $database = DB::getDatabaseName();
        $sql = "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_NAME = ?";
        $res = DB::select($sql, [$database, $fkName]);
        return !empty($res);
    }
}
