<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDocumentosRequeridosTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('documentos_requeridos', function (Blueprint $table) {
            $table->id();
            $table->string('nombre_doc', 255)->nullable(false);
            $table->boolean('obligatorio')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('documentos_requeridos');
    }
};
