<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddTituloToTutoresTable extends Migration
{
    public function up()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (!Schema::hasColumn('tutores', 'titulo')) {
                $table->string('titulo', 255)->nullable()->after('celular');
            }
        });
    }

    public function down()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (Schema::hasColumn('tutores', 'titulo')) {
                $table->dropColumn('titulo');
            }
        });
    }
}
