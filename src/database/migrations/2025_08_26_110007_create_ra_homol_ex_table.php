<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateRaHomolExTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('ra_homol_ex', function (Blueprint $table) {
            $table->id();
            $table->integer('id_doc_req')->nullable();
            $table->string('nro_res', 255)->nullable();
            $table->date('fecha_emision')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('ra_homol_ex');
    }
};
