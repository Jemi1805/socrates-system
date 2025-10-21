<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class UpdateConvocatoriasAnioNumero extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('convocatorias')) {
            return;
        }

        $addedStructure = false;
        Schema::table('convocatorias', function (Blueprint $table) use (&$addedStructure) {
            if (!Schema::hasColumn('convocatorias', 'anio')) {
                $table->unsignedSmallInteger('anio')->default((int) date('Y'))->after('id');
                $addedStructure = true;
            }
            if (!Schema::hasColumn('convocatorias', 'numero_convocatoria')) {
                $table->unsignedInteger('numero_convocatoria')->default(1)->after('anio');
                $addedStructure = true;
            }
        });

        $convocatorias = DB::table('convocatorias')->orderBy('fecha_inicio')->orderBy('id')->get();
        $yearCounters = [];
        foreach ($convocatorias as $convocatoria) {
            $anio = (int) date('Y');
            if (!empty($convocatoria->gestion)) {
                $anio = (int) preg_replace('/[^0-9]/', '', substr($convocatoria->gestion, 0, 4));
            } elseif (!empty($convocatoria->fecha_inicio)) {
                $anio = (int) date('Y', strtotime($convocatoria->fecha_inicio));
            }
            if ($anio <= 0) {
                $anio = (int) date('Y');
            }

            $yearCounters[$anio] = ($yearCounters[$anio] ?? 0) + 1;
            $numero = $yearCounters[$anio];

            DB::table('convocatorias')->where('id', $convocatoria->id)->update([
                'anio' => $anio,
                'numero_convocatoria' => $numero,
            ]);
        }

        if (Schema::hasColumn('convocatorias', 'gestion')) {
            Schema::table('convocatorias', function (Blueprint $table) {
                $table->dropIndex('convocatorias_gestion_index');
                $table->dropColumn('gestion');
            });
        }

        if ($addedStructure) {
            Schema::table('convocatorias', function (Blueprint $table) {
                $table->index('anio', 'convocatorias_anio_index');
                $table->unique(['anio', 'numero_convocatoria'], 'convocatorias_anio_numero_unique');
            });
        }
    }

    public function down()
    {
        if (!Schema::hasTable('convocatorias')) {
            return;
        }

        Schema::table('convocatorias', function (Blueprint $table) {
            if (!Schema::hasColumn('convocatorias', 'gestion')) {
                $table->string('gestion', 20)->after('id');
            }
        });

        $convocatorias = DB::table('convocatorias')->orderBy('anio')->orderBy('numero_convocatoria')->get();
        foreach ($convocatorias as $convocatoria) {
            $gestion = trim($convocatoria->anio . '-' . $convocatoria->numero_convocatoria);
            DB::table('convocatorias')->where('id', $convocatoria->id)->update([
                'gestion' => $gestion,
            ]);
        }

        Schema::table('convocatorias', function (Blueprint $table) {
            if (Schema::hasColumn('convocatorias', 'anio')) {
                $table->dropUnique('convocatorias_anio_numero_unique');
                $table->dropIndex('convocatorias_anio_index');
                $table->dropColumn(['anio', 'numero_convocatoria']);
            }
            $table->index('gestion');
        });
    }
}
