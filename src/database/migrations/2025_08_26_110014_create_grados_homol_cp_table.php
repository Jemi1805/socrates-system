<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateGradosHomolCpTable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::create('grados_homol_cp', function (Blueprint $table) {
            $table->id();
            $table->foreignId('homol_cp_id')->nullable()->constrained('res_homol_cp')->onDelete('cascade');
            $table->string('grado', 255)->nullable();
            $table->integer('gestion')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::dropIfExists('grados_homol_cp');
    }
};
