<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class DropGestionBachillerFromDiplomaBachiller extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('diploma_bachiller')) {
            return;
        }
        Schema::table('diploma_bachiller', function (Blueprint $table) {
            if (Schema::hasColumn('diploma_bachiller', 'gestion_bachiller')) {
                $table->dropColumn('gestion_bachiller');
            }
            // Conservar gestion_bachillerato (no eliminar)
        });
    }

    public function down()
    {
        if (!Schema::hasTable('diploma_bachiller')) {
            return;
        }
        Schema::table('diploma_bachiller', function (Blueprint $table) {
            if (!Schema::hasColumn('diploma_bachiller', 'gestion_bachiller')) {
                $table->string('gestion_bachiller', 10)->nullable();
            }
        });
    }
}
