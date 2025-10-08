<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTutorPertinenciaTable extends Migration {
    public function up()
    {
        Schema::create('tutor_pertinencia', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tutor_id');
            $table->unsignedBigInteger('pertinencia_acad_id');
            $table->timestamps();

            $table->unique(['tutor_id', 'pertinencia_acad_id']);
            $table->foreign('tutor_id')->references('id')->on('tutores')->onDelete('cascade');
            $table->foreign('pertinencia_acad_id')->references('id')->on('pertinencia_acad')->onDelete('cascade');
        });
    }

    public function down()
    {
        Schema::dropIfExists('tutor_pertinencia');
    }
}