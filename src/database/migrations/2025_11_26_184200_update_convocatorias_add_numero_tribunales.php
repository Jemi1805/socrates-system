<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class UpdateConvocatoriasAddNumeroTribunales extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('convocatorias')) {
            return;
        }

        Schema::table('convocatorias', function (Blueprint $table) {
            // Eliminar numero_postulantes si aún existe
            if (Schema::hasColumn('convocatorias', 'numero_postulantes')) {
                $table->dropColumn('numero_postulantes');
            }

            // Agregar numero_tribunales si no existe
            if (!Schema::hasColumn('convocatorias', 'numero_tribunales')) {
                $table->unsignedTinyInteger('numero_tribunales')
                    ->default(3)
                    ->after('descripcion');
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('convocatorias')) {
            return;
        }

        Schema::table('convocatorias', function (Blueprint $table) {
            // Quitar numero_tribunales
            if (Schema::hasColumn('convocatorias', 'numero_tribunales')) {
                $table->dropColumn('numero_tribunales');
            }

            // (Opcional) recrear numero_postulantes para rollback
            if (!Schema::hasColumn('convocatorias', 'numero_postulantes')) {
                $table->unsignedInteger('numero_postulantes')
                    ->default(0)
                    ->after('descripcion');
            }
        });
    }
}
