<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AlterDiplomaBachillerDropLegacyColumns extends Migration
{
    public function up()
    {
        if (Schema::hasTable('diploma_bachiller')) {
            Schema::table('diploma_bachiller', function (Blueprint $table) {
                if (Schema::hasColumn('diploma_bachiller', 'nro_serie')) {
                    $table->dropColumn('nro_serie');
                }
                if (Schema::hasColumn('diploma_bachiller', 'id_doc_req')) {
                    $table->dropColumn('id_doc_req');
                }
            });
        }
    }

    public function down()
    {
        if (Schema::hasTable('diploma_bachiller')) {
            Schema::table('diploma_bachiller', function (Blueprint $table) {
                if (!Schema::hasColumn('diploma_bachiller', 'nro_serie')) {
                    $table->string('nro_serie')->nullable();
                }
                if (!Schema::hasColumn('diploma_bachiller', 'id_doc_req')) {
                    $table->unsignedBigInteger('id_doc_req')->nullable();
                }
            });
        }
    }
}
