<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AlterPertinenciaAcadAddCodCarreraFk extends Migration
{
    public function up()
    {
        Schema::table('pertinencia_acad', function (Blueprint $table) {
            if (!Schema::hasColumn('pertinencia_acad', 'cod_carrera')) {
                $table->string('cod_carrera', 10)->nullable()->after('nombre_pert');
                $table->index('cod_carrera');
            }
        });

        Schema::table('pertinencia_acad', function (Blueprint $table) {
            if (Schema::hasColumn('pertinencia_acad', 'cod_carrera')) {
                $table->foreign('cod_carrera')
                    ->references('cod_carrera')->on('carrera')
                    ->onDelete('set null');
            }
        });
    }

    public function down()
    {
        Schema::table('pertinencia_acad', function (Blueprint $table) {
            if (Schema::hasColumn('pertinencia_acad', 'cod_carrera')) {
                try { $table->dropForeign(['cod_carrera']); } catch (\Throwable $e) {}
                $table->dropIndex(['cod_carrera']);
                $table->dropColumn('cod_carrera');
            }
        });
    }
}
