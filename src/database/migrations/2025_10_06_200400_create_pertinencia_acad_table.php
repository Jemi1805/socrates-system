<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreatePertinenciaAcadTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('pertinencia_acad')) {
            Schema::create('pertinencia_acad', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('nombre_pert');
                $table->timestamps();
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('pertinencia_acad');
    }
}
