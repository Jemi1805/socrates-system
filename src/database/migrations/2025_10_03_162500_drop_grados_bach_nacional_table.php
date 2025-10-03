<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class DropGradosBachNacionalTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('grados_bach_nacional')) {
            DB::statement('DROP TABLE IF EXISTS grados_bach_nacional');
        }
    }

    public function down()
    {
        // No se recrea la tabla deliberadamente
    }
}
