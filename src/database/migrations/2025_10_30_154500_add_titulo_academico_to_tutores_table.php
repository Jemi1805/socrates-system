<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddTituloAcademicoToTutoresTable extends Migration
{
    public function up()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (!Schema::hasColumn('tutores', 'titulo_academico')) {
                $table->string('titulo_academico', 10)->nullable()->after('titulo');
            }
        });
    }

    public function down()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (Schema::hasColumn('tutores', 'titulo_academico')) {
                $table->dropColumn('titulo_academico');
            }
        });
    }
}
