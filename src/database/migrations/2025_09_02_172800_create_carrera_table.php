<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateCarreraTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        if (!Schema::hasTable('carrera')) {
            Schema::create('carrera', function (Blueprint $table) {
                $table->string('cod_carrera', 10)->primary();
                $table->string('nombre_carrera', 255);
                $table->string('descripcion', 255)->nullable();
                $table->timestamps();

                $table->index('nombre_carrera', 'carrera_nombre_index');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('carrera');
    }
}
