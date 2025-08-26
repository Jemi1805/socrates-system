<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDocumentosAdjuntosTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('documentos_adjuntos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('inscripcion_id')->nullable()->constrained('inscrip_modalidad')->onDelete('cascade');
            $table->foreignId('tipo_doc_id')->nullable()->constrained('documentos_requeridos')->onDelete('set null');
            $table->string('archivo_pdf', 255)->nullable();
            $table->timestamp('fecha_subida')->useCurrent();
            $table->boolean('validado')->nullable();
            $table->integer('usuario_validador')->nullable();
            $table->dateTime('fecha_validacion')->nullable();
            $table->text('observaciones')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('documentos_adjuntos');
    }
};
