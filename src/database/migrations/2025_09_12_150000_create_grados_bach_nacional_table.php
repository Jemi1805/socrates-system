<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateGradosBachNacionalTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('grados_bach_nacional')) {
            Schema::create('grados_bach_nacional', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('cod_ceta_est');
                $table->string('grado_sec', 50)->nullable();
                $table->string('gestion_sec', 10)->nullable();
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->index('cod_ceta_est');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('grados_bach_nacional');
    }
}
