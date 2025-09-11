<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class DropCelularFromPostulantesTable extends Migration
{
    public function up()
    {
        Schema::table('postulantes', function (Blueprint $table) {
            if (Schema::hasColumn('postulantes', 'celular')) {
                $table->dropColumn('celular');
            }
        });
    }

    public function down()
    {
        Schema::table('postulantes', function (Blueprint $table) {
            if (!Schema::hasColumn('postulantes', 'celular')) {
                $table->string('celular')->default('')->after('expedido');
            }
        });
    }
}
