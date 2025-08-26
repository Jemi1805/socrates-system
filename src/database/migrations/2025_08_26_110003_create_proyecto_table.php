<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateProyectoTable extends Migration

{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('proyecto', function (Blueprint $table) {
            $table->id();
            $table->foreignId('modalidad_id')->nullable()->constrained('modalidad')->onDelete('set null');
            $table->string('nombre', 255)->nullable();
            $table->string('tipo', 255)->nullable();
            $table->text('objetivo')->nullable();
            $table->string('estado', 255)->default('En progreso');
            $table->integer('porcentaje_avance')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('proyecto');
    }
};
