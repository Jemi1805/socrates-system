<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class BackfillGbeAndAddFk extends Migration
{
    public function up()
    {
        // Asegurar que diploma_bachiller tiene columna id como PK UNSIGNED
        if (Schema::hasTable('diploma_bachiller')) {
            if (!Schema::hasColumn('diploma_bachiller', 'id')) {
                DB::statement('ALTER TABLE diploma_bachiller ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY');
            } else {
                try {
                    DB::statement('ALTER TABLE diploma_bachiller MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT');
                } catch (\Throwable $e) {
                    // ignorar
                }
            }
        }

        // Normalizar datos en grados_bach_extranjero: si diploma_bachiller_id guarda cod_ceta_est, actualizarlo al id real
        if (Schema::hasTable('grados_bach_extranjero') && Schema::hasTable('diploma_bachiller')) {
            if (Schema::hasColumn('grados_bach_extranjero', 'diploma_bachiller_id') && Schema::hasColumn('diploma_bachiller', 'cod_ceta_est')) {
                // Intentar convertir los IDs "legacy" (cod_ceta_est) al nuevo id de diploma_bachiller
                // Nota: esto supone una correspondencia 1:1 entre cod_ceta_est y diploma extranjero activo
                try {
                    DB::statement('UPDATE grados_bach_extranjero gbe
                        JOIN diploma_bachiller db ON gbe.diploma_bachiller_id = db.cod_ceta_est
                        SET gbe.diploma_bachiller_id = db.id
                        WHERE db.id IS NOT NULL');
                } catch (\Throwable $e) {
                    // log simple en caso de error
                    \Log::warning("[BackfillGbeAndAddFk] No se pudo backfillear grados_bach_extranjero: ".$e->getMessage());
                }
            }

            // Asegurar tipo correcto
            try {
                DB::statement('ALTER TABLE grados_bach_extranjero MODIFY COLUMN diploma_bachiller_id BIGINT UNSIGNED NOT NULL');
            } catch (\Throwable $e) { /* ignorar */ }
        }

        // Intentar crear la FK si aún no existe
        if (Schema::hasTable('grados_bach_extranjero') && Schema::hasTable('diploma_bachiller')) {
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
    }

    public function down()
    {
        if (Schema::hasTable('grados_bach_extranjero')) {
            $fk = 'grados_bach_extranjero_diploma_bachiller_id_foreign';
            if ($this->fkExists('grados_bach_extranjero', $fk)) {
                Schema::table('grados_bach_extranjero', function (Blueprint $table) use ($fk) {
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
