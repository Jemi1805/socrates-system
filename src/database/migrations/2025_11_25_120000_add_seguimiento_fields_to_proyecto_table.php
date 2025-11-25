<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddSeguimientoFieldsToProyectoTable extends Migration
{
    public function up()
    {
        Schema::table('proyecto', function (Blueprint $table) {
            if (!Schema::hasColumn('proyecto', 'seguimiento_estado')) {
                $table->string('seguimiento_estado', 30)->nullable()->after('inscrip_modalidad_id');
            }
            if (!Schema::hasColumn('proyecto', 'seguimiento_pdf')) {
                $table->string('seguimiento_pdf', 255)->nullable()->after('seguimiento_estado');
            }
        });
    }

    public function down()
    {
        Schema::table('proyecto', function (Blueprint $table) {
            if (Schema::hasColumn('proyecto', 'seguimiento_pdf')) {
                $table->dropColumn('seguimiento_pdf');
            }
            if (Schema::hasColumn('proyecto', 'seguimiento_estado')) {
                $table->dropColumn('seguimiento_estado');
            }
        });
    }
}
