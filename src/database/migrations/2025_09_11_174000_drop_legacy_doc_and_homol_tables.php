<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class DropLegacyDocAndHomolTables extends Migration
{
    public function up()
    {
        // Deshabilitar FKs para poder eliminar en cascada manual
        Schema::disableForeignKeyConstraints();

        // Eliminar primero tablas hijas que puedan referenciar a las principales
        $dropOrder = [
            'grados_homol_cp', // hijo de res_homol_cp
            'grado_homol',     // probable hijo de ra_homol_ex
            'ra_homol_ex',
            'res_homol_cp',
            'documentos_adjuntos',
            'documentos_requeridos',
        ];

        foreach ($dropOrder as $tbl) {
            if (Schema::hasTable($tbl)) {
                Schema::drop($tbl);
            }
        }

        Schema::enableForeignKeyConstraints();
    }

    public function down()
    {
        // Recrear estructuras mínimas para revertir (sin datos de negocio), solo con id y timestamps
        if (!Schema::hasTable('documentos_requeridos')) {
            Schema::create('documentos_requeridos', function (Blueprint $table) {
                $table->id();
                $table->string('nombre')->nullable();
                $table->boolean('activo')->default(true);
                $table->timestamps();
            });
        }
        if (!Schema::hasTable('documentos_adjuntos')) {
            Schema::create('documentos_adjuntos', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('cod_ceta_est')->nullable();
                $table->string('tipo')->nullable();
                $table->string('ruta')->nullable();
                $table->timestamps();
                $table->index('cod_ceta_est');
            });
        }
        if (!Schema::hasTable('ra_homol_ex')) {
            Schema::create('ra_homol_ex', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('cod_ceta_est')->nullable();
                $table->string('resolucion')->nullable();
                $table->date('fecha_emision')->nullable();
                $table->timestamps();
                $table->index('cod_ceta_est');
            });
        }
        if (!Schema::hasTable('res_homol_cp')) {
            Schema::create('res_homol_cp', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('cod_ceta_est')->nullable();
                $table->string('resolucion')->nullable();
                $table->date('fecha_emision')->nullable();
                $table->timestamps();
                $table->index('cod_ceta_est');
            });
        }
        if (!Schema::hasTable('grado_homol')) {
            Schema::create('grado_homol', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('ra_homol_ex_id')->nullable();
                $table->string('grado')->nullable();
                $table->string('gestion')->nullable();
                $table->timestamps();
                $table->index('ra_homol_ex_id');
            });
        }
        if (!Schema::hasTable('grados_homol_cp')) {
            Schema::create('grados_homol_cp', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('res_homol_cp_id')->nullable();
                $table->string('grado')->nullable();
                $table->string('gestion')->nullable();
                $table->timestamps();
                $table->index('res_homol_cp_id');
            });
        }
    }
}
