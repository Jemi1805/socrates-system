<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateRolTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        if (!Schema::hasTable('rol')) {
            Schema::create('rol', function (Blueprint $table) {
                $table->id();
                $table->string('nombre', 100)->nullable();  // Longitud reducida
                $table->text('descripcion')->nullable();
                $table->smallInteger('nivel_acceso')->default(1);  // Tipo más adecuado
                $table->timestamp('fecha_creacion')->useCurrent();
                $table->timestamp('fecha_actualizacion')->nullable()->useCurrentOnUpdate();
                $table->boolean('activo')->default(true);
                
                // Índices con nombres explícitos
                $table->index('nombre', 'rol_nombre_index');
                $table->index('nivel_acceso', 'rol_nivel_index');
                $table->index('activo', 'rol_activo_index');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('rol');
    }
}