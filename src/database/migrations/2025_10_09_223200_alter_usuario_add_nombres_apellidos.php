<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AlterUsuarioAddNombresApellidos extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::table('usuario', function (Blueprint $table) {
            if (!Schema::hasColumn('usuario', 'nombre')) {
                $table->string('nombre', 150)->nullable()->after('id');
            }
            if (!Schema::hasColumn('usuario', 'apellido_p')) {
                $table->string('apellido_p', 150)->nullable()->after('nombre');
            }
            if (!Schema::hasColumn('usuario', 'apellido_m')) {
                $table->string('apellido_m', 150)->nullable()->after('apellido_p');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::table('usuario', function (Blueprint $table) {
            if (Schema::hasColumn('usuario', 'nombre')) {
                $table->dropColumn('nombre');
            }
            if (Schema::hasColumn('usuario', 'apellido_p')) {
                $table->dropColumn('apellido_p');
            }
            if (Schema::hasColumn('usuario', 'apellido_m')) {
                $table->dropColumn('apellido_m');
            }
        });
    }
}
