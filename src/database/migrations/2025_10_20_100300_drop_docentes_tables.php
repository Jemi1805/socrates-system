<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class DropDocentesTables extends Migration
{
    public function up()
    {
        // Drop pivots/foreign tables first if exist
        if (Schema::hasTable('docente_carrera')) {
            Schema::drop('docente_carrera');
        }
        if (Schema::hasTable('docentes')) {
            Schema::drop('docentes');
        }
    }

    public function down()
    {
        // No restore (eliminación definitiva)
    }
}
