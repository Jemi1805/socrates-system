<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddNumeroPostulantesToConvocatorias extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('convocatorias')) {
            return;
        }

        Schema::table('convocatorias', function (Blueprint $table) {
            if (Schema::hasColumn('convocatorias', 'numero_postulantes')) {
                $table->dropColumn('numero_postulantes');
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('convocatorias')) {
            return;
        }

        Schema::table('convocatorias', function (Blueprint $table) {
            if (!Schema::hasColumn('convocatorias', 'numero_postulantes')) {
                $table->unsignedInteger('numero_postulantes')
                    ->default(0)
                    ->after('descripcion');
            }
        });
    }
}
