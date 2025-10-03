<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class FixDiplomaBachillerAddIdPk extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('diploma_bachiller')) {
            return;
        }

        // Verificar existencia de columna id y PK actual
        $hasId = Schema::hasColumn('diploma_bachiller', 'id');
        $hasPk = $this->primaryKeyExists('diploma_bachiller');

        // Si existe una PK previa (posiblemente sobre una columna eliminada legacy), intentar eliminarla primero
        if ($hasPk) {
            try {
                DB::statement('ALTER TABLE diploma_bachiller DROP PRIMARY KEY');
            } catch (\Throwable $e) {
                // Ignorar si no hay PK real activa o si ya se eliminó
            }
        }

        if (!$hasId) {
            // Agregar columna id autoincremental y declararla PRIMARY KEY
            DB::statement('ALTER TABLE diploma_bachiller ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY');
        } else {
            // Asegurar tipo y PK en id
            try {
                DB::statement('ALTER TABLE diploma_bachiller MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (id)');
            } catch (\Throwable $e) {
                // Si falla por PK ya existente, reintentar sólo modificar tipo/auto_increment
                try {
                    DB::statement('ALTER TABLE diploma_bachiller MODIFY COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT');
                } catch (\Throwable $e2) {
                    // No hacer nada más; se reportará en la siguiente migración si aún falla la FK
                }
            }
        }
    }

    public function down()
    {
        if (!Schema::hasTable('diploma_bachiller')) {
            return;
        }
        // Eliminar PK basada en id y la columna id
        try {
            DB::statement('ALTER TABLE diploma_bachiller DROP PRIMARY KEY');
        } catch (\Throwable $e) {
            // continuar
        }
        if (Schema::hasColumn('diploma_bachiller', 'id')) {
            Schema::table('diploma_bachiller', function (Blueprint $table) {
                $table->dropColumn('id');
            });
        }
    }

    private function primaryKeyExists($table)
    {
        $database = DB::getDatabaseName();
        $sql = "SELECT COUNT(1) as c FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'PRIMARY KEY'";
        $res = DB::select($sql, [$database, $table]);
        if (!empty($res)) {
            $row = (array) $res[0];
            return isset($row['c']) ? ((int)$row['c'] > 0) : false;
        }
        return false;
    }
}
