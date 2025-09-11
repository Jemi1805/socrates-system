<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateGradosBachExtranjeroTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('grados_bach_extranjero')) {
            return;
        }
        Schema::create('grados_bach_extranjero', function (Blueprint $table) {
            $table->id();
            // Relación lógica al registro de diploma_bachiller (tipo_bachiller = 'extranjero')
            $table->unsignedBigInteger('diploma_bachiller_id');
            $table->string('grado', 50);
            $table->string('gestion', 9); // Ej.: "2018" o "1/2018"
            $table->timestamps();

            $table->index('diploma_bachiller_id');
            $table->unique(['diploma_bachiller_id', 'grado', 'gestion'], 'ux_bex_diploma_grado_gestion');
        });
    }

    public function down()
    {
        Schema::dropIfExists('grados_bach_extranjero');
    }
}
