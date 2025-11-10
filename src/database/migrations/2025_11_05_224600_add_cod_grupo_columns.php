<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddCodGrupoColumns extends Migration
{
    public function up()
    {
        if (Schema::hasTable('inscrip_modalidad') && !Schema::hasColumn('inscrip_modalidad', 'grupo')) {
            Schema::table('inscrip_modalidad', function (Blueprint $table) {
                $table->string('grupo')->nullable()->after('modalidad_id');
            });
        }

        if (Schema::hasTable('sga_config') && !Schema::hasColumn('sga_config', 'cod_grupo')) {
            Schema::table('sga_config', function (Blueprint $table) {
                if (Schema::hasColumn('sga_config', 'cod_carrera')) {
                    $table->string('cod_grupo', 20)->nullable()->after('cod_carrera');
                } else {
                    $table->string('cod_grupo', 20)->nullable();
                }
            });
        }
    }

    public function down()
    {
        if (Schema::hasTable('inscrip_modalidad') && Schema::hasColumn('inscrip_modalidad', 'grupo')) {
            Schema::table('inscrip_modalidad', function (Blueprint $table) {
                $table->dropColumn('grupo');
            });
        }

        if (Schema::hasTable('sga_config') && Schema::hasColumn('sga_config', 'cod_grupo')) {
            Schema::table('sga_config', function (Blueprint $table) {
                $table->dropColumn('cod_grupo');
            });
        }
    }
}
