<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AddConvocatoriaNomToDesignacionTutorTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('designacion_tutor')) {
            Schema::table('designacion_tutor', function (Blueprint $table) {
                if (!Schema::hasColumn('designacion_tutor', 'convocatoria_nom')) {
                    $table->string('convocatoria_nom', 150)->nullable()->after('convocatoria_id');
                }
                if (!Schema::hasColumn('designacion_tutor', 'user_name')) {
                    $table->string('user_name', 150)->nullable()->after('user_id');
                }
            });

            if (Schema::hasColumn('designacion_tutor', 'convocatoria_nom') && Schema::hasColumn('designacion_tutor', 'convocatoria_id')) {
                DB::statement(
                    'UPDATE designacion_tutor dt
                     LEFT JOIN convocatorias c ON c.id = dt.convocatoria_id
                     SET dt.convocatoria_nom = CASE
                         WHEN c.numero_convocatoria IS NOT NULL THEN CONCAT(c.numero_convocatoria, " - ", c.nombre)
                         ELSE c.nombre
                     END'
                );
            }

            if (Schema::hasColumn('designacion_tutor', 'user_name') && Schema::hasColumn('designacion_tutor', 'user_id')) {
                DB::statement(
                    'UPDATE designacion_tutor dt
                     LEFT JOIN users u ON u.id = dt.user_id
                     SET dt.user_name = COALESCE(
                        NULLIF(TRIM(u.name), \'\'),
                        NULLIF(TRIM(u.email), \'\'),
                        dt.user_name
                     )'
                );
            }
        }
    }

    public function down()
    {
        if (Schema::hasTable('designacion_tutor')) {
            Schema::table('designacion_tutor', function (Blueprint $table) {
                if (Schema::hasColumn('designacion_tutor', 'convocatoria_nom')) {
                    $table->dropColumn('convocatoria_nom');
                }
                if (Schema::hasColumn('designacion_tutor', 'user_name')) {
                    $table->dropColumn('user_name');
                }
            });
        }
    }
}
