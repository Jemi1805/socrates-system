<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AlterPertinenciaAcadAddActivo extends Migration
{
    public function up()
    {
        Schema::table('pertinencia_acad', function (Blueprint $table) {
            if (!Schema::hasColumn('pertinencia_acad', 'activo')) {
                $table->boolean('activo')->default(true)->after('cod_carrera');
            }
        });
    }

    public function down()
    {
        Schema::table('pertinencia_acad', function (Blueprint $table) {
            if (Schema::hasColumn('pertinencia_acad', 'activo')) {
                $table->dropColumn('activo');
            }
        });
    }
}
