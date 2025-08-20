<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePermisoTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (!Schema::hasTable('permiso')) {
            Schema::create('permiso', function (Blueprint $table) {
                $table->id();
                $table->string('codigo', 255)->nullable();
                $table->string('nombre', 255)->nullable();
                $table->text('descripcion')->nullable();
                
                // Índices
                $table->index('codigo');
                $table->index('nombre');
            });
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('permiso');
    }
}