<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AlterTransitabilidadInstTecTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('transitabilidad_inst_tec')) {
            return;
        }

        Schema::table('transitabilidad_inst_tec', function (Blueprint $table) {
            if (!Schema::hasColumn('transitabilidad_inst_tec', 'cod_ceta_est')) {
                $table->unsignedBigInteger('cod_ceta_est')->nullable()->after('id');
                $table->index('cod_ceta_est');
            }
            if (!Schema::hasColumn('transitabilidad_inst_tec', 'serie_titulo_tm')) {
                $table->string('serie_titulo_tm', 50)->nullable();
            }
            if (!Schema::hasColumn('transitabilidad_inst_tec', 'numero_titulo_tm')) {
                $table->string('numero_titulo_tm', 50)->nullable();
            }
            if (!Schema::hasColumn('transitabilidad_inst_tec', 'fecha_emision')) {
                $table->date('fecha_emision')->nullable();
            }
            if (!Schema::hasColumn('transitabilidad_inst_tec', 'observacion')) {
                $table->text('observacion')->nullable();
            }
            if (!Schema::hasColumn('transitabilidad_inst_tec', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('transitabilidad_inst_tec')) {
            return;
        }
        Schema::table('transitabilidad_inst_tec', function (Blueprint $table) {
            if (Schema::hasColumn('transitabilidad_inst_tec', 'is_active')) $table->dropColumn('is_active');
            if (Schema::hasColumn('transitabilidad_inst_tec', 'observacion')) $table->dropColumn('observacion');
            if (Schema::hasColumn('transitabilidad_inst_tec', 'fecha_emision')) $table->dropColumn('fecha_emision');
            if (Schema::hasColumn('transitabilidad_inst_tec', 'numero_titulo_tm')) $table->dropColumn('numero_titulo_tm');
            if (Schema::hasColumn('transitabilidad_inst_tec', 'serie_titulo_tm')) $table->dropColumn('serie_titulo_tm');
        });
    }
}
