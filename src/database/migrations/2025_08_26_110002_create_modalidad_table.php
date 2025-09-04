<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateModalidadTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('modalidad', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 255)->nullable();
            $table->text('descripcion')->nullable();
            $table->string('monto_arancel', 100)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('modalidad');
    }
};
