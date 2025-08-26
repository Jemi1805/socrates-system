<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateGradoHomolTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('grado_homol', function (Blueprint $table) {
            $table->id();
            $table->foreignId('homologacion_id')->nullable()->constrained('ra_homol_ex')->onDelete('cascade');
            $table->string('grado_sec', 255)->nullable();
            $table->integer('gestion_sec')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('grado_homol');
    }
};
