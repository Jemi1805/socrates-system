<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateRolPermisoTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (!Schema::hasTable('rol_permiso')) {
            Schema::create('rol_permiso', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rol_id')->constrained('rol')->onDelete('cascade');
            $table->foreignId('permiso_id')->constrained('permiso')->onDelete('cascade');
            $table->boolean('concedido')->default(true);
            
            // Índices y restricciones
            $table->unique(['rol_id', 'permiso_id'], 'rol_permiso_unique');
            $table->index('rol_id');
            $table->index('permiso_id');
            $table->index('concedido');
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
        Schema::dropIfExists('rol_permiso');
    }
}
