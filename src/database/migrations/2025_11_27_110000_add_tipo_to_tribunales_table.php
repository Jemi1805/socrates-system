<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddTipoToTribunalesTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('tribunales') && !Schema::hasColumn('tribunales', 'tipo')) {
            Schema::table('tribunales', function (Blueprint $table) {
                $table->enum('tipo', ['interno', 'externo'])->default('externo')->after('titulo_academico');
            });
        }
    }

    public function down()
    {
        if (Schema::hasTable('tribunales') && Schema::hasColumn('tribunales', 'tipo')) {
            Schema::table('tribunales', function (Blueprint $table) {
                $table->dropColumn('tipo');
            });
        }
    }
}
