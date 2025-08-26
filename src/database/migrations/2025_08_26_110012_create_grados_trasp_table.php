<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateGradosTraspTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('grados_trasp', function (Blueprint $table) {
            $table->id();
            $table->foreignId('traspaso_id')->nullable()->constrained('traspasos_instituto')->onDelete('cascade');
            $table->string('grado', 255)->nullable();
            $table->integer('gestion')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('grados_trasp');
    }
};
