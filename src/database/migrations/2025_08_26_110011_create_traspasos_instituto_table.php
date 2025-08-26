<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTraspasosInstitutoTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('traspasos_instituto', function (Blueprint $table) {
            $table->id();
            $table->integer('id_doc_req')->nullable();
            $table->string('instituto_origen', 255)->nullable();
            $table->string('grados_cursados', 255)->nullable();
            $table->string('gestiones_cursadas', 255)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('traspasos_instituto');
    }
};
