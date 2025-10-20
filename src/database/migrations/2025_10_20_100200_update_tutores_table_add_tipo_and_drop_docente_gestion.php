<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class UpdateTutoresTableAddTipoAndDropDocenteGestion extends Migration
{
    public function up()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (Schema::hasColumn('tutores', 'docente_id')) {
                try { $table->dropForeign(['docente_id']); } catch (\Throwable $e) {}
                try { $table->dropUnique(['docente_id']); } catch (\Throwable $e) {}
                $table->dropColumn('docente_id');
            }
            if (Schema::hasColumn('tutores', 'gestion_registro')) {
                $table->dropColumn('gestion_registro');
            }
            if (!Schema::hasColumn('tutores', 'tipo_tutor_id')) {
                $table->unsignedBigInteger('tipo_tutor_id')->default(1)->after('pertinencia_nom');
            }
        });
        // Add FK separately to avoid issues when using after/drop in same call
        Schema::table('tutores', function (Blueprint $table) {
            if (Schema::hasColumn('tutores', 'tipo_tutor_id')) {
                try {
                    $table->foreign('tipo_tutor_id')->references('id')->on('tipo_tutor')->onDelete('restrict');
                } catch (\Throwable $e) {}
            }
        });
        // Normalizar valores nulos a 1
        DB::table('tutores')->whereNull('tipo_tutor_id')->update(['tipo_tutor_id' => 1]);
    }

    public function down()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (Schema::hasColumn('tutores', 'tipo_tutor_id')) {
                try { $table->dropForeign(['tipo_tutor_id']); } catch (\Throwable $e) {}
                $table->dropColumn('tipo_tutor_id');
            }
            // No restauramos docente_id ni gestion_registro automáticamente
        });
    }
}
