<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class UpdateDatosCarreraRegimenColumns extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('datos_carrera')) {
            return;
        }
        Schema::table('datos_carrera', function (Blueprint $table) {
            // Add new columns if they don't exist
            if (!Schema::hasColumn('datos_carrera', 'regimen_ini')) {
                $table->enum('regimen_ini', ['semestral', 'anual'])->nullable()->after('cod_ceta_est');
            }
            if (!Schema::hasColumn('datos_carrera', 'regimen_fin')) {
                $table->enum('regimen_fin', ['semestral', 'anual'])->nullable()->after('regimen_ini');
            }
        });
        Schema::table('datos_carrera', function (Blueprint $table) {
            // Drop old columns if they exist
            if (Schema::hasColumn('datos_carrera', 'regimen')) {
                $table->dropColumn('regimen');
            }
            if (Schema::hasColumn('datos_carrera', 'fecha_ini')) {
                $table->dropColumn('fecha_ini');
            }
            if (Schema::hasColumn('datos_carrera', 'fecha_fin')) {
                $table->dropColumn('fecha_fin');
            }
            if (Schema::hasColumn('datos_carrera', 'observacion')) {
                $table->dropColumn('observacion');
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('datos_carrera')) {
            return;
        }
        Schema::table('datos_carrera', function (Blueprint $table) {
            // Recreate old columns if they don't exist
            if (!Schema::hasColumn('datos_carrera', 'regimen')) {
                $table->enum('regimen', ['semestral', 'anual'])->nullable()->after('cod_ceta_est');
            }
            if (!Schema::hasColumn('datos_carrera', 'fecha_ini')) {
                $table->date('fecha_ini')->nullable()->after('gestion_ini');
            }
            if (!Schema::hasColumn('datos_carrera', 'fecha_fin')) {
                $table->date('fecha_fin')->nullable()->after('gestion_fin');
            }
            if (!Schema::hasColumn('datos_carrera', 'observacion')) {
                $table->text('observacion')->nullable()->after('fecha_fin');
            }
        });
        Schema::table('datos_carrera', function (Blueprint $table) {
            // Drop new columns
            if (Schema::hasColumn('datos_carrera', 'regimen_ini')) {
                $table->dropColumn('regimen_ini');
            }
            if (Schema::hasColumn('datos_carrera', 'regimen_fin')) {
                $table->dropColumn('regimen_fin');
            }
        });
    }
}
