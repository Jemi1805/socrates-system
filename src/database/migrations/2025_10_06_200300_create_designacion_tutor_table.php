<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateDesignacionTutorTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('designacion_tutor')) {
            Schema::create('designacion_tutor', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('tutor_id');
                $table->unsignedBigInteger('cod_ceta'); // FK a postulantes.cod_ceta
                $table->unsignedBigInteger('user_id')->nullable(); // usuario que designa
                $table->date('fecha_designacion')->nullable();
                $table->timestamps();

                $table->index(['cod_ceta']);
                $table->index(['tutor_id']);
                $table->unique(['tutor_id', 'cod_ceta'], 'uq_designacion_tutor_est');

                $table->foreign('tutor_id')
                    ->references('id')->on('tutores')
                    ->onDelete('cascade');

                $table->foreign('cod_ceta')
                    ->references('cod_ceta')->on('postulantes')
                    ->onDelete('cascade');

                $table->foreign('user_id')
                    ->references('id')->on('users')
                    ->onDelete('set null');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('designacion_tutor');
    }
};
