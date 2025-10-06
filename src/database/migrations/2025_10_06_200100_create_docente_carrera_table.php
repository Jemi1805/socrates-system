<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDocenteCarreraTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('docente_carrera')) {
            Schema::create('docente_carrera', function (Blueprint $table) {
                $table->unsignedBigInteger('docente_id');
                $table->string('cod_carrera', 10);
                $table->timestamps();

                $table->primary(['docente_id', 'cod_carrera']);

                $table->foreign('docente_id')
                    ->references('id')->on('docentes')
                    ->onDelete('cascade');
                $table->foreign('cod_carrera')
                    ->references('cod_carrera')->on('carrera')
                    ->onDelete('cascade');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('docente_carrera');
    }
};
