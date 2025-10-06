<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDocentesTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('docentes')) {
            Schema::create('docentes', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('nombre');
                $table->string('apellido_p')->nullable();
                $table->string('apellido_m')->nullable();
                $table->string('ci')->nullable()->index();
                $table->string('profesion')->nullable();
                $table->string('pertinencia')->nullable();
                $table->string('celular')->nullable();
                $table->boolean('activo')->default(true);
                $table->timestamps();
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('docentes');
    }
};
