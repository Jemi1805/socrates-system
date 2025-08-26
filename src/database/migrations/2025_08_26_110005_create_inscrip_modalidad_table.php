<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateInscripModalidadTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('inscrip_modalidad', function (Blueprint $table) {
            $table->id();
            $table->integer('cod_ceta_est')->nullable();
            $table->foreignId('modalidad_id')->nullable()->constrained('modalidad')->onDelete('set null');
            $table->foreignId('pract_ind_id')->nullable()->unique()->constrained('pract_ind')->onDelete('set null');
            $table->foreignId('aranceles_id')->nullable()->constrained('aranceles_est')->onDelete('set null');
            $table->date('fecha_inscripcion')->nullable();
            $table->string('estado', 255)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('inscrip_modalidad');
    }
};
