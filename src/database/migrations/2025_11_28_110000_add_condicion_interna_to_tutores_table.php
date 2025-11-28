<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddCondicionInternaToTutoresTable extends Migration
{
    public function up()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (!Schema::hasColumn('tutores', 'condicion_interna')) {
                $table->enum('condicion_interna', ['planta', 'consultor'])->nullable()->after('es_tribunal');
            }
        });
    }

    public function down()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (Schema::hasColumn('tutores', 'condicion_interna')) {
                $table->dropColumn('condicion_interna');
            }
        });
    }
}
