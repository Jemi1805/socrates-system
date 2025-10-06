<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateTutoresTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('tutores')) {
            Schema::create('tutores', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('docente_id');
                $table->boolean('activo')->default(true);
                $table->timestamps();

                $table->foreign('docente_id')
                    ->references('id')->on('docentes')
                    ->onDelete('cascade');
                $table->unique('docente_id');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('tutores');
    }
};
