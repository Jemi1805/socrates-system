<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDocDesignacionesTribunalTable extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('doc_designaciones_tribunal')) {
            Schema::create('doc_designaciones_tribunal', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('doc_tipo', 10);
                $table->unsignedSmallInteger('year');
                $table->unsignedInteger('correlativo');
                $table->string('cite', 120);

                $table->unsignedBigInteger('miembro_id')->nullable();
                $table->string('tipo_miembro', 20)->nullable(); // interno / externo
                $table->string('rol', 50)->nullable();
                $table->unsignedBigInteger('convocatoria_id')->nullable();

                $table->string('para_nombre', 255)->nullable();
                $table->string('para_cargo', 255)->nullable();
                $table->string('de_nombre', 255)->nullable();
                $table->string('de_cargo', 255)->nullable();
                $table->string('asunto', 255)->nullable();

                // Resumen de defensas asociadas al tribunal (JSON)
                $table->text('defensas_resumen')->nullable();

                $table->timestamps();

                $table->index(['doc_tipo', 'year', 'correlativo'], 'doc_designaciones_tribunal_lookup');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('doc_designaciones_tribunal');
    }
}
