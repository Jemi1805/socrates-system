<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddColumnsToTutoresTable extends Migration {
    public function up()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (!Schema::hasColumn('tutores', 'nombre')) {
                $table->string('nombre', 150)->nullable()->after('activo');
            }
            if (!Schema::hasColumn('tutores', 'apellido_p')) {
                $table->string('apellido_p', 150)->nullable()->after('nombre');
            }
            if (!Schema::hasColumn('tutores', 'apellido_m')) {
                $table->string('apellido_m', 150)->nullable()->after('apellido_p');
            }
            if (!Schema::hasColumn('tutores', 'celular')) {
                $table->string('celular', 50)->nullable()->after('apellido_m');
            }
            if (!Schema::hasColumn('tutores', 'cod_carrera')) {
                $table->string('cod_carrera', 10)->nullable()->after('celular');
                $table->index('cod_carrera');
            }
            if (!Schema::hasColumn('tutores', 'ci')) {
                $table->string('ci', 50)->nullable()->after('cod_carrera');
                $table->index('ci');
            }
            if (!Schema::hasColumn('tutores', 'pertinencia_acad_id')) {
                $table->unsignedBigInteger('pertinencia_acad_id')->nullable()->after('ci');
                $table->foreign('pertinencia_acad_id')
                    ->references('id')->on('pertinencia_acad')
                    ->onDelete('set null');
            }
            if (!Schema::hasColumn('tutores', 'pertinencia_nom')) {
                $table->string('pertinencia_nom', 255)->nullable()->after('pertinencia_acad_id');
            }
            if (!Schema::hasColumn('tutores', 'gestion_registro')) {
                $table->string('gestion_registro', 10)->nullable()->after('pertinencia_nom');
            }
        });
    }

    public function down()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (Schema::hasColumn('tutores', 'gestion_registro')) {
                $table->dropColumn('gestion_registro');
            }
            if (Schema::hasColumn('tutores', 'pertinencia_nom')) {
                $table->dropColumn('pertinencia_nom');
            }
            if (Schema::hasColumn('tutores', 'pertinencia_acad_id')) {
                $table->dropForeign(['pertinencia_acad_id']);
                $table->dropColumn('pertinencia_acad_id');
            }
            if (Schema::hasColumn('tutores', 'ci')) {
                $table->dropIndex(['ci']);
                $table->dropColumn('ci');
            }
            if (Schema::hasColumn('tutores', 'cod_carrera')) {
                $table->dropIndex(['cod_carrera']);
                $table->dropColumn('cod_carrera');
            }
            if (Schema::hasColumn('tutores', 'celular')) {
                $table->dropColumn('celular');
            }
            if (Schema::hasColumn('tutores', 'apellido_m')) {
                $table->dropColumn('apellido_m');
            }
            if (Schema::hasColumn('tutores', 'apellido_p')) {
                $table->dropColumn('apellido_p');
            }
            if (Schema::hasColumn('tutores', 'nombre')) {
                $table->dropColumn('nombre');
            }
        });
    }
};
