<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class MakeDatosCarreraPivotAddCarreraIdFk extends Migration
{
    public function up()
    {
        // 1) Agregar cod_carrera (string) a datos_carrera para usarlo como pivote a carrera.cod_carrera
        if (Schema::hasTable('datos_carrera') && !Schema::hasColumn('datos_carrera', 'cod_carrera')) {
            Schema::table('datos_carrera', function (Blueprint $table) {
                $table->string('cod_carrera', 10)->nullable()->after('cod_ceta_est');
                $table->index('cod_carrera');
            });
        }

        // 2) Crear FKs
        if (Schema::hasTable('datos_carrera')) {
            // FK a carrera.cod_carrera (PK string)
            if (Schema::hasTable('carrera') && Schema::hasColumn('carrera', 'cod_carrera') && Schema::hasColumn('datos_carrera', 'cod_carrera')) {
                $fk = 'datos_carrera_cod_carrera_foreign';
                if (!$this->fkExists('datos_carrera', $fk)) {
                    Schema::table('datos_carrera', function (Blueprint $table) use ($fk) {
                        $table->foreign('cod_carrera', $fk)
                              ->references('cod_carrera')
                              ->on('carrera')
                              ->onDelete('cascade');
                    });
                }
            }
            // FK a postulantes.cod_ceta
            if (Schema::hasTable('postulantes') && Schema::hasColumn('datos_carrera', 'cod_ceta_est')) {
                $fk2 = 'datos_carrera_cod_ceta_est_foreign';
                if (!$this->fkExists('datos_carrera', $fk2)) {
                    Schema::table('datos_carrera', function (Blueprint $table) use ($fk2) {
                        $table->foreign('cod_ceta_est', $fk2)
                              ->references('cod_ceta')
                              ->on('postulantes')
                              ->onDelete('cascade');
                    });
                }
            }
        }
    }

    public function down()
    {
        if (Schema::hasTable('datos_carrera')) {
            $fk = 'datos_carrera_cod_carrera_foreign';
            if ($this->fkExists('datos_carrera', $fk)) {
                Schema::table('datos_carrera', function (Blueprint $table) use ($fk) {
                    $table->dropForeign($fk);
                });
            }
            // opcionalmente quitar columna (no recomendado si hay datos)
            // Schema::table('datos_carrera', function (Blueprint $table) { $table->dropColumn('cod_carrera'); });
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
