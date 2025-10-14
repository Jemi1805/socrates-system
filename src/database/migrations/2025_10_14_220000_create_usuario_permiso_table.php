<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateUsuarioPermisoTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        if (!Schema::hasTable('usuario_permiso')) {
            Schema::create('usuario_permiso', function (Blueprint $table) {
                $table->unsignedBigInteger('usuario_id');
                $table->unsignedBigInteger('permiso_id');
                $table->boolean('concedido')->default(true);

                $table->foreign('usuario_id')->references('id')->on('usuario')->onDelete('cascade');
                $table->foreign('permiso_id')->references('id')->on('permiso')->onDelete('cascade');

                $table->unique(['usuario_id', 'permiso_id'], 'usuario_permiso_unique');
                $table->index(['permiso_id', 'concedido'], 'usuario_permiso_perm_conc_idx');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('usuario_permiso');
    }
}
