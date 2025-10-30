<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDocDesignacionesTables extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('doc_designacion_secuencias')) {
            Schema::create('doc_designacion_secuencias', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('doc_tipo', 10);
                $table->unsignedSmallInteger('year');
                $table->unsignedInteger('last_correlativo')->default(0);
                $table->timestamps();

                $table->unique(['doc_tipo', 'year'], 'doc_designacion_seq_unique');
            });
        }

        if (!Schema::hasTable('doc_designaciones')) {
            Schema::create('doc_designaciones', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('designacion_tutor_id')->unique();
                $table->string('doc_tipo', 10);
                $table->unsignedSmallInteger('year');
                $table->unsignedInteger('correlativo');
                $table->string('cite', 120);
                $table->string('para_nombre', 255)->nullable();
                $table->string('para_cargo', 255)->nullable();
                $table->string('de_nombre', 255)->nullable();
                $table->string('de_cargo', 255)->nullable();
                $table->string('asunto', 255)->nullable();
                $table->text('introduccion')->nullable();
                $table->date('cronograma_inicio')->nullable();
                $table->date('cronograma_fin')->nullable();
                $table->text('cierre')->nullable();
                $table->text('pie_notas')->nullable();
                $table->string('tutor_nombre', 255)->nullable();
                $table->string('tutor_titulo', 255)->nullable();
                $table->text('estudiantes_resumen')->nullable();
                $table->timestamps();

                $table->foreign('designacion_tutor_id')
                    ->references('id')->on('designacion_tutor')
                    ->onDelete('cascade');

                $table->index(['doc_tipo', 'year', 'correlativo'], 'doc_designaciones_lookup');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('doc_designaciones');
        Schema::dropIfExists('doc_designacion_secuencias');
    }
}
