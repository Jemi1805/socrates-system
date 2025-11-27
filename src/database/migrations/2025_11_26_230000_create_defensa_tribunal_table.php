<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDefensaTribunalTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('defensas')) {
            return;
        }

        Schema::create('defensa_tribunal', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('defensa_id');
            $table->unsignedBigInteger('miembro_id');
            $table->enum('tipo', ['interno', 'externo']);
            $table->enum('rol', ['PRESIDENTE', 'DELEGADO_INTERNO', 'DELEGADO_EXTERNO']);
            $table->timestamps();

            $table->foreign('defensa_id')->references('id')->on('defensas')->onDelete('cascade');
            // miembro_id referencia lógica: si tipo = interno -> tutores.id, si externo -> tribunales.id
            $table->index(['defensa_id', 'rol'], 'defensa_tribunal_defensa_rol_idx');
        });
    }

    public function down()
    {
        if (Schema::hasTable('defensa_tribunal')) {
            Schema::dropIfExists('defensa_tribunal');
        }
    }
}
