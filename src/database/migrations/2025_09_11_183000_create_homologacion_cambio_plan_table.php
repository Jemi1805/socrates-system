<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateHomologacionCambioPlanTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('homologacion_cambio_plan')) {
            return;
        }
        Schema::create('homologacion_cambio_plan', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cod_ceta_est');
            $table->string('nro_resolucion', 100)->nullable();
            $table->date('fecha_emision')->nullable();
            $table->text('observacion')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('cod_ceta_est');
        });
    }

    public function down()
    {
        Schema::dropIfExists('homologacion_cambio_plan');
    }
}
