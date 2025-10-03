<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AddDiplomaFkToTransitTraspHomol extends Migration
{
    public function up()
    {
        // Asegurar que diploma_bachiller tiene columna id PK
        if (Schema::hasTable('diploma_bachiller') && !Schema::hasColumn('diploma_bachiller', 'id')) {
            DB::statement('ALTER TABLE diploma_bachiller ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY');
        }

        // Tablas destino
        $targets = [
            'transitabilidad_edu_reg',
            'transitabilidad_inst_tec',
            'traspasos_instituto',
            'homologacion_cambio_plan',
        ];

        foreach ($targets as $tbl) {
            if (!Schema::hasTable($tbl)) { continue; }
            // Agregar columna si no existe
            if (!Schema::hasColumn($tbl, 'diploma_bachiller_id')) {
                try {
                    DB::statement("ALTER TABLE {$tbl} ADD COLUMN diploma_bachiller_id BIGINT UNSIGNED NULL");
                } catch (\Throwable $e) {
                    // Ignorar si ya existe por alguna carrera de migraciones diferente
                }
            }
            // Asegurar tipo UNSIGNED BIGINT
            if (Schema::hasColumn($tbl, 'diploma_bachiller_id')) {
                try {
                    DB::statement("ALTER TABLE {$tbl} MODIFY COLUMN diploma_bachiller_id BIGINT UNSIGNED NULL");
                } catch (\Throwable $e) { /* noop */ }
            }
        }

        // Backfill diploma_bachiller_id desde cod_ceta_est utilizando el último diploma por cod
        if (Schema::hasTable('diploma_bachiller') && Schema::hasColumn('diploma_bachiller', 'cod_ceta_est')) {
            $sub = ' (SELECT cod_ceta_est, MAX(id) AS id FROM diploma_bachiller GROUP BY cod_ceta_est) as db2 ';
            $pairs = [
                'transitabilidad_edu_reg' => 'cod_ceta_est',
                'transitabilidad_inst_tec' => 'cod_ceta_est',
                'traspasos_instituto' => 'cod_ceta_est',
                'homologacion_cambio_plan' => 'cod_ceta_est',
            ];
            foreach ($pairs as $tbl => $col) {
                if (Schema::hasTable($tbl) && Schema::hasColumn($tbl, $col) && Schema::hasColumn($tbl, 'diploma_bachiller_id')) {
                    try {
                        DB::statement("UPDATE {$tbl} t JOIN {$sub} ON db2.cod_ceta_est = t.{$col} SET t.diploma_bachiller_id = db2.id WHERE t.diploma_bachiller_id IS NULL");
                    } catch (\Throwable $e) {
                        // Log simple sin romper migración
                        \Log::warning('[AddDiplomaFkToTransitTraspHomol] Backfill falló en ' . $tbl . ': ' . $e->getMessage());
                    }
                }
            }
        }

        // Crear FKs si no existen y si diploma.id está disponible
        if (Schema::hasTable('diploma_bachiller') && Schema::hasColumn('diploma_bachiller', 'id')) {
            $fkMap = [
                'transitabilidad_edu_reg' => 'transitabilidad_edu_reg_diploma_bachiller_id_foreign',
                'transitabilidad_inst_tec' => 'transitabilidad_inst_tec_diploma_bachiller_id_foreign',
                'traspasos_instituto' => 'traspasos_instituto_diploma_bachiller_id_foreign',
                'homologacion_cambio_plan' => 'homologacion_cambio_plan_diploma_bachiller_id_foreign',
            ];
            foreach ($fkMap as $tbl => $fkName) {
                if (!Schema::hasTable($tbl) || !Schema::hasColumn($tbl, 'diploma_bachiller_id')) { continue; }
                if (!$this->fkExists($tbl, $fkName)) {
                    Schema::table($tbl, function (Blueprint $table) use ($fkName) {
                        $table->foreign('diploma_bachiller_id', $fkName)
                            ->references('id')
                            ->on('diploma_bachiller')
                            ->onDelete('cascade');
                    });
                }
            }
        }
    }

    public function down()
    {
        $fkMap = [
            'transitabilidad_edu_reg' => 'transitabilidad_edu_reg_diploma_bachiller_id_foreign',
            'transitabilidad_inst_tec' => 'transitabilidad_inst_tec_diploma_bachiller_id_foreign',
            'traspasos_instituto' => 'traspasos_instituto_diploma_bachiller_id_foreign',
            'homologacion_cambio_plan' => 'homologacion_cambio_plan_diploma_bachiller_id_foreign',
        ];
        foreach ($fkMap as $tbl => $fkName) {
            if (Schema::hasTable($tbl)) {
                if ($this->fkExists($tbl, $fkName)) {
                    Schema::table($tbl, function (Blueprint $table) use ($fkName) {
                        $table->dropForeign($fkName);
                    });
                }
            }
        }
        // No se eliminan columnas para no perder datos
    }

    private function fkExists($table, $fkName)
    {
        $database = DB::getDatabaseName();
        $sql = "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND CONSTRAINT_NAME = ?";
        $res = DB::select($sql, [$database, $fkName]);
        return !empty($res);
    }
}
