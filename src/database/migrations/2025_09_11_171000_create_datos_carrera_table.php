<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDatosCarreraTable extends Migration
{
    public function up()
    {
        Schema::create('datos_carrera', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('cod_ceta_est');
            $table->enum('regimen', ['semestral', 'anual'])->nullable();
            $table->string('gestion_ini', 7); // p. ej., 1/2019
            $table->date('fecha_ini')->nullable();
            $table->string('gestion_fin', 7)->nullable();
            $table->date('fecha_fin')->nullable();
            $table->text('observacion')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('cod_ceta_est');
            // No enforce FK because postulantes.primaryKey es cod_ceta (no id autoinc)
        });
    }

    public function down()
    {
        Schema::dropIfExists('datos_carrera');
    }
}
