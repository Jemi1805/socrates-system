<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePostulantesTable extends Migration
{
    public function up()
    {
        Schema::create('postulantes', function (Blueprint $table) {
            $table->id('cod_ceta');
            $table->string('nombres_est');
            $table->string('apellidos_est');
            $table->string('ci');
            $table->string('expedido');
            $table->string('celular');
            $table->string('carrera');
            $table->string('reg_ini_c');
            $table->string('gestion_ini');
            $table->string('reg_con_c');
            $table->string('gestion_fin');
            $table->boolean('incrip_uni');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('postulantes');
    }
}