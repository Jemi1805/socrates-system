<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUsuarioTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        if (!Schema::hasTable('usuario')) {
            Schema::create('usuario', function (Blueprint $table) {
            $table->id();
            $table->string('nombre_usuario', 255)->unique()->nullable(false);
            $table->string('contrasena', 255)->nullable(false)->comment('Almacenar hash');
            $table->string('email', 255)->unique()->nullable(false);
            $table->foreignId('rol_id')->nullable(false)->constrained('rol')->onDelete('restrict');
            $table->boolean('activo')->default(true);
            $table->timestamp('fecha_creacion')->useCurrent();
            $table->timestamp('fecha_actualizacion')->nullable()->comment('Actualizar con trigger');
            $table->datetime('fecha_bloqueo')->nullable()->comment('Para bloqueo temporal por intentos');
            
            // Índices
            $table->index('nombre_usuario');
            $table->index('email');
            $table->index('rol_id');
            $table->index('activo');
            $table->index('fecha_creacion');
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
        Schema::dropIfExists('usuario');
    }
}
