<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDiplomaBachillerTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('diploma_bachiller', function (Blueprint $table) {
            $table->string('nro_serie', 255)->primary();
            $table->integer('id_doc_req')->nullable();
            $table->string('emision', 255)->nullable();
            $table->date('fecha_emision')->nullable();
            $table->text('observación')->nullable();
            $table->integer('gestion_bachiller')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('diploma_bachiller');
    }
};
