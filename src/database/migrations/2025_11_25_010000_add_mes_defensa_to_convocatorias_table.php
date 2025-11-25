<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddMesDefensaToConvocatoriasTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('convocatorias')) {
            return;
        }
        Schema::table('convocatorias', function (Blueprint $table) {
            if (!Schema::hasColumn('convocatorias', 'mes_defensa')) {
                $table->string('mes_defensa', 7)->nullable()->after('fecha_fin'); // formato YYYY-MM
                $table->index('mes_defensa', 'convocatorias_mes_defensa_index');
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('convocatorias')) {
            return;
        }
        Schema::table('convocatorias', function (Blueprint $table) {
            if (Schema::hasColumn('convocatorias', 'mes_defensa')) {
                $table->dropIndex('convocatorias_mes_defensa_index');
                $table->dropColumn('mes_defensa');
            }
        });
    }
}
