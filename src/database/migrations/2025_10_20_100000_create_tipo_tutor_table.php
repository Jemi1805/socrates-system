<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class CreateTipoTutorTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('tipo_tutor')) {
            Schema::create('tipo_tutor', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('nombre', 100);
                $table->boolean('is_active')->default(true);
            });
            DB::table('tipo_tutor')->insert([
                ['id' => 1, 'nombre' => 'Consultor', 'is_active' => true],
                ['id' => 2, 'nombre' => 'De Planta', 'is_active' => true],
            ]);
        }
    }

    public function down()
    {
        Schema::dropIfExists('tipo_tutor');
    }
}
