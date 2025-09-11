<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AlterTransitabilidadEduRegTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('transitabilidad_edu_reg')) {
            return; // si no existe, se deja para una futura creación
        }

        Schema::table('transitabilidad_edu_reg', function (Blueprint $table) {
            if (!Schema::hasColumn('transitabilidad_edu_reg', 'cod_ceta_est')) {
                $table->unsignedBigInteger('cod_ceta_est')->nullable()->after('id');
                $table->index('cod_ceta_est');
            }
            if (!Schema::hasColumn('transitabilidad_edu_reg', 'serie_titulo_tm')) {
                $table->string('serie_titulo_tm', 50)->nullable();
            }
            if (!Schema::hasColumn('transitabilidad_edu_reg', 'numero_titulo_tm')) {
                $table->string('numero_titulo_tm', 50)->nullable();
            }
            if (!Schema::hasColumn('transitabilidad_edu_reg', 'fecha_emision')) {
                $table->date('fecha_emision')->nullable();
            }
            if (!Schema::hasColumn('transitabilidad_edu_reg', 'observacion')) {
                $table->text('observacion')->nullable();
            }
            if (!Schema::hasColumn('transitabilidad_edu_reg', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('transitabilidad_edu_reg')) {
            return;
        }
        Schema::table('transitabilidad_edu_reg', function (Blueprint $table) {
            if (Schema::hasColumn('transitabilidad_edu_reg', 'is_active')) $table->dropColumn('is_active');
            if (Schema::hasColumn('transitabilidad_edu_reg', 'observacion')) $table->dropColumn('observacion');
            if (Schema::hasColumn('transitabilidad_edu_reg', 'fecha_emision')) $table->dropColumn('fecha_emision');
            if (Schema::hasColumn('transitabilidad_edu_reg', 'numero_titulo_tm')) $table->dropColumn('numero_titulo_tm');
            if (Schema::hasColumn('transitabilidad_edu_reg', 'serie_titulo_tm')) $table->dropColumn('serie_titulo_tm');
            // dejar cod_ceta_est tal cual si ya fue usado
        });
    }
}
