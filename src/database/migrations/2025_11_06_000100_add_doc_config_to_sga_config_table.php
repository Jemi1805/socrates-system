<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddDocConfigToSgaConfigTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('sga_config') && !Schema::hasColumn('sga_config', 'doc_config')) {
            Schema::table('sga_config', function (Blueprint $table) {
                $table->longText('doc_config')->nullable()->after('cod_grupo');
            });
        }
    }

    public function down()
    {
        if (Schema::hasTable('sga_config') && Schema::hasColumn('sga_config', 'doc_config')) {
            Schema::table('sga_config', function (Blueprint $table) {
                $table->dropColumn('doc_config');
            });
        }
    }
}
