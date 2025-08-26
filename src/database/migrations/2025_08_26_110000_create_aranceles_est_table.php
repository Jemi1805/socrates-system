<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateArancelesEstTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('aranceles_est', function (Blueprint $table) {
            $table->id();
            $table->integer('cod_ceta_est')->nullable();
            $table->string('concepto', 255)->nullable();
            $table->decimal('monto', 10, 2)->nullable();
            $table->boolean('pagado')->nullable();
            $table->date('fecha_pago')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('aranceles_est');
    }
};
