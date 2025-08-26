<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePractIndTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('pract_ind', function (Blueprint $table) {
            $table->id();
            $table->string('empresa', 255)->nullable();
            $table->date('fecha_inicio')->nullable();
            $table->date('fecha_fin')->nullable();
            $table->text('descripcion')->nullable();
            $table->string('estado', 255)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('pract_ind');
    }
};
