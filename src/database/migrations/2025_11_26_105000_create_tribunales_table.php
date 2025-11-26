<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTribunalesTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('tribunales')) {
            Schema::create('tribunales', function (Blueprint $table) {
                $table->bigIncrements('id');
                // Datos básicos del tribunal externo
                $table->string('nombre', 150);
                $table->string('apellido_p', 150);
                $table->string('apellido_m', 150)->nullable();
                $table->string('ci', 50);
                $table->string('celular', 50)->nullable();
                $table->string('profesion', 255); // título(s) / profesión
                $table->string('titulo_academico', 10)->nullable(); // Ing., Lic., etc.
                // En el futuro podríamos relacionarlo con carrera o pertinencia si lo necesitas
                $table->boolean('activo')->default(true);
                $table->timestamps();
                $table->index('ci');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('tribunales');
    }
}
