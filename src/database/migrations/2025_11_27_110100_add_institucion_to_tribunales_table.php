<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddInstitucionToTribunalesTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('tribunales') && !Schema::hasColumn('tribunales', 'institucion')) {
            Schema::table('tribunales', function (Blueprint $table) {
                $table->string('institucion', 255)->nullable()->after('profesion');
            });
        }
    }

    public function down()
    {
        if (Schema::hasTable('tribunales') && Schema::hasColumn('tribunales', 'institucion')) {
            Schema::table('tribunales', function (Blueprint $table) {
                $table->dropColumn('institucion');
            });
        }
    }
}
