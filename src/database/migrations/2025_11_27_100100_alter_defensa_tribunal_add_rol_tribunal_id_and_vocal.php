<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AlterDefensaTribunalAddRolTribunalIdAndVocal extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('defensa_tribunal')) {
            return;
        }

        Schema::table('defensa_tribunal', function (Blueprint $table) {
            if (!Schema::hasColumn('defensa_tribunal', 'rol_tribunal_id')) {
                $table->unsignedBigInteger('rol_tribunal_id')->nullable()->after('rol');
                $table->foreign('rol_tribunal_id')->references('id')->on('rol_tribunal')->onDelete('set null');
            }
        });

        // Ampliar el ENUM de rol para incluir VOCAL (solo si la BD lo soporta)
        try {
            $connection = Schema::getConnection()->getDriverName();
            if ($connection === 'mysql') {
                DB::statement("ALTER TABLE defensa_tribunal MODIFY rol ENUM('PRESIDENTE','DELEGADO_INTERNO','DELEGADO_EXTERNO','VOCAL') NOT NULL");
            }
        } catch (\Throwable $e) {
            // Si falla, dejamos el ENUM como está y seguimos usando el campo rol_tribunal_id para la clasificación adicional
        }
    }

    public function down()
    {
        if (!Schema::hasTable('defensa_tribunal')) {
            return;
        }

        Schema::table('defensa_tribunal', function (Blueprint $table) {
            if (Schema::hasColumn('defensa_tribunal', 'rol_tribunal_id')) {
                $table->dropForeign(['rol_tribunal_id']);
                $table->dropColumn('rol_tribunal_id');
            }
        });
        // No revertimos el ENUM para evitar errores en entornos con datos existentes
    }
}
