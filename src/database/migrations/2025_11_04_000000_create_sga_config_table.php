<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSgaConfigTable extends Migration
{
    public function up()
    {
        Schema::create('sga_config', function (Blueprint $table) {
            $table->increments('id');
            $table->string('web_user');
            $table->string('web_password');
            $table->unsignedBigInteger('emisor_id');
            $table->unsignedInteger('cargo_id');
            $table->string('cargo_nombre');
            $table->string('abreviatura')->default('CETA/DA/');
            $table->char('emisor_genero', 1)->default('M');
            $table->string('institucion')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('sga_config');
    }
}
