<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateResHomolCpTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('res_homol_cp', function (Blueprint $table) {
            $table->id();
            $table->integer('id_doc_req')->nullable();
            $table->string('nro_res', 255)->nullable();
            $table->date('fecha_emision')->nullable();
            $table->string('grados_cursados', 255)->nullable();
            $table->string('gestiones_cursadas', 255)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('res_homol_cp');
    }
};
