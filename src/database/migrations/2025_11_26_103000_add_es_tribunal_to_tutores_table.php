<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddEsTribunalToTutoresTable extends Migration
{
    public function up()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (!Schema::hasColumn('tutores', 'es_tribunal')) {
                // Usamos booleano para simplicidad; se puede mapear a 't'/'f' en capa de aplicación si se requiere
                $table->boolean('es_tribunal')->default(false)->after('activo');
            }
        });
    }

    public function down()
    {
        Schema::table('tutores', function (Blueprint $table) {
            if (Schema::hasColumn('tutores', 'es_tribunal')) {
                $table->dropColumn('es_tribunal');
            }
        });
    }
}
