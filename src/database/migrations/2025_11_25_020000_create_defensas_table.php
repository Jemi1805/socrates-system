<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('defensas', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('proyecto_id');
            $table->string('cod_ceta');
            $table->unsignedBigInteger('convocatoria_id');
            $table->date('fecha_defensa');
            $table->time('hora_inicio');
            $table->time('hora_fin');
            $table->string('grupo', 50)->nullable();
            $table->string('aula', 100)->nullable();
            $table->string('estado_defensa', 50)->default('programada');
            $table->text('observaciones')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();

            $table->foreign('proyecto_id')->references('id')->on('proyecto')->onDelete('cascade');
            $table->foreign('convocatoria_id')->references('id')->on('convocatorias')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('defensas');
    }
};
