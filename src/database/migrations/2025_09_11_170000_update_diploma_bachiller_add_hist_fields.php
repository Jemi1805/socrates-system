<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class UpdateDiplomaBachillerAddHistFields extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('diploma_bachiller')) {
            Schema::create('diploma_bachiller', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('cod_ceta_est');
                $table->enum('tipo_bachiller', ['nacional','extranjero'])->nullable();
                $table->string('nro_serie_titulo')->nullable();
                $table->string('emision')->nullable();
                $table->date('fecha_emision')->nullable();
                $table->string('gestion_bachillerato', 10)->nullable();
                $table->text('observacion')->nullable();
                $table->string('nro_resolucion')->nullable();
                $table->date('fecha_resolucion')->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->index('cod_ceta_est');
            });
        } else {
            Schema::table('diploma_bachiller', function (Blueprint $table) {
                if (!Schema::hasColumn('diploma_bachiller', 'cod_ceta_est')) {
                    $table->unsignedBigInteger('cod_ceta_est')->nullable();
                    $table->index('cod_ceta_est');
                }
                if (!Schema::hasColumn('diploma_bachiller', 'tipo_bachiller')) {
                    $table->enum('tipo_bachiller', ['nacional','extranjero'])->nullable();
                }
                if (!Schema::hasColumn('diploma_bachiller', 'nro_serie_titulo')) {
                    $table->string('nro_serie_titulo')->nullable();
                }
                if (!Schema::hasColumn('diploma_bachiller', 'emision')) {
                    $table->string('emision')->nullable();
                }
                if (!Schema::hasColumn('diploma_bachiller', 'fecha_emision')) {
                    $table->date('fecha_emision')->nullable();
                }
                if (!Schema::hasColumn('diploma_bachiller', 'gestion_bachillerato')) {
                    $table->string('gestion_bachillerato', 10)->nullable();
                }
                if (!Schema::hasColumn('diploma_bachiller', 'observacion')) {
                    $table->text('observacion')->nullable();
                }
                if (!Schema::hasColumn('diploma_bachiller', 'nro_resolucion')) {
                    $table->string('nro_resolucion')->nullable();
                }
                if (!Schema::hasColumn('diploma_bachiller', 'fecha_resolucion')) {
                    $table->date('fecha_resolucion')->nullable();
                }
                if (!Schema::hasColumn('diploma_bachiller', 'is_active')) {
                    $table->boolean('is_active')->default(true);
                }
                if (!Schema::hasColumn('diploma_bachiller', 'created_at')) {
                    $table->timestamps();
                }
            });
        }
    }

    public function down()
    {
        Schema::table('diploma_bachiller', function (Blueprint $table) {
            if (Schema::hasColumn('diploma_bachiller', 'is_active')) $table->dropColumn('is_active');
            if (Schema::hasColumn('diploma_bachiller', 'fecha_resolucion')) $table->dropColumn('fecha_resolucion');
            if (Schema::hasColumn('diploma_bachiller', 'nro_resolucion')) $table->dropColumn('nro_resolucion');
            if (Schema::hasColumn('diploma_bachiller', 'observacion')) $table->dropColumn('observacion');
            if (Schema::hasColumn('diploma_bachiller', 'gestion_bachillerato')) $table->dropColumn('gestion_bachillerato');
            if (Schema::hasColumn('diploma_bachiller', 'fecha_emision')) $table->dropColumn('fecha_emision');
            if (Schema::hasColumn('diploma_bachiller', 'emision')) $table->dropColumn('emision');
            if (Schema::hasColumn('diploma_bachiller', 'nro_serie_titulo')) $table->dropColumn('nro_serie_titulo');
            if (Schema::hasColumn('diploma_bachiller', 'tipo_bachiller')) $table->dropColumn('tipo_bachiller');
        });
    }
}
