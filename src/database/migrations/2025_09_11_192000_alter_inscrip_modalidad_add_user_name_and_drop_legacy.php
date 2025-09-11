<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AlterInscripModalidadAddUserNameAndDropLegacy extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('inscrip_modalidad')) {
            return;
        }
        // Deshabilitar FKs para poder eliminar columnas referenciadas
        Schema::disableForeignKeyConstraints();

        // Localizar y eliminar cualquier FK que apunte a aranceles_id y pract_ind_id
        $fks = DB::select("SELECT CONSTRAINT_NAME
                              FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                             WHERE TABLE_SCHEMA = DATABASE()
                               AND TABLE_NAME = 'inscrip_modalidad'
                               AND COLUMN_NAME IN ('aranceles_id','pract_ind_id')
                               AND REFERENCED_TABLE_NAME IS NOT NULL");
        foreach ($fks as $fk) {
            $name = $fk->CONSTRAINT_NAME;
            try {
                DB::statement("ALTER TABLE `inscrip_modalidad` DROP FOREIGN KEY `{$name}`");
            } catch (\Throwable $e) {
                // ignorar si no existe
            }
        }
        Schema::table('inscrip_modalidad', function (Blueprint $table) {
            // Nombre del usuario que registra (cacheado para auditoría)
            if (!Schema::hasColumn('inscrip_modalidad', 'user_name')) {
                $table->string('user_name', 150)->nullable()->after('user_id');
            }
            // Eliminar columnas legacy que ya no se usarán
            if (Schema::hasColumn('inscrip_modalidad', 'aranceles_id')) {
                $table->dropColumn('aranceles_id');
            }
            if (Schema::hasColumn('inscrip_modalidad', 'pract_ind_id')) {
                $table->dropColumn('pract_ind_id');
            }
        });
        Schema::enableForeignKeyConstraints();
    }

    public function down()
    {
        if (!Schema::hasTable('inscrip_modalidad')) {
            return;
        }
        Schema::table('inscrip_modalidad', function (Blueprint $table) {
            if (Schema::hasColumn('inscrip_modalidad', 'user_name')) {
                $table->dropColumn('user_name');
            }
            // Restaurar columnas legacy solo para permitir rollback
            if (!Schema::hasColumn('inscrip_modalidad', 'aranceles_id')) {
                $table->unsignedBigInteger('aranceles_id')->nullable();
            }
            if (!Schema::hasColumn('inscrip_modalidad', 'pract_ind_id')) {
                $table->unsignedBigInteger('pract_ind_id')->nullable();
            }
        });
    }
}
