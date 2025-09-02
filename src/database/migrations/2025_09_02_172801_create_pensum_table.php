<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePensumTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        if (!Schema::hasTable('pensum')) {
            Schema::create('pensum', function (Blueprint $table) {
                $table->string('cod_pensum', 30)->primary();
                $table->string('cod_carrera', 10);
                $table->tinyInteger('cantidadsemestre')->nullable();
                $table->string('descripcion', 255)->nullable();
                $table->smallInteger('orden')->nullable();
                $table->boolean('activo')->default(true);
                $table->integer('cod_secuencial')->nullable();
                $table->string('nivel', 100)->nullable();
                $table->string('identificador', 50)->nullable();
                $table->string('resolucion', 100)->nullable();
                $table->timestamps();

                $table->index('cod_carrera', 'pensum_carrera_index');
                $table->index('activo', 'pensum_activo_index');

                $table->foreign('cod_carrera')
                    ->references('cod_carrera')->on('carrera')
                    ->onDelete('cascade');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('pensum');
    }
}
