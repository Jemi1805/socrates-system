<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateGradosHomologacionCpTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('grados_homologacion_cp')) {
            return;
        }

        Schema::create('grados_homologacion_cp', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('homologacion_cambio_plan_id');
            $table->string('grado', 50);
            $table->string('gestion', 9); // Ej.: "2018" o "1/2018"
            $table->timestamps();

            $table->index('homologacion_cambio_plan_id');
            $table->unique(['homologacion_cambio_plan_id', 'grado', 'gestion'], 'ux_hcp_grado_gestion');
        });
    }

    public function down()
    {
        Schema::dropIfExists('grados_homologacion_cp');
    }
}
