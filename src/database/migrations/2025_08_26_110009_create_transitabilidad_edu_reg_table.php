<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTransitabilidadEduRegTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('transitabilidad_edu_reg', function (Blueprint $table) {
            $table->id();
            $table->integer('id_doc_req')->nullable();
            $table->string('serie_titulo_tm', 255)->nullable();
            $table->string('numero_titulo_tm', 255)->nullable();
            $table->date('fecha_emision')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('transitabilidad_edu_reg');
    }
};
