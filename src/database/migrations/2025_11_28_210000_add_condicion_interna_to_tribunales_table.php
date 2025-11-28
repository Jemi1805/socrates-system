<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddCondicionInternaToTribunalesTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('tribunales') && !Schema::hasColumn('tribunales', 'condicion_interna')) {
            Schema::table('tribunales', function (Blueprint $table) {
                $table->string('condicion_interna', 50)->nullable()->after('tipo');
            });
        }
    }

    public function down()
    {
        if (Schema::hasTable('tribunales') && Schema::hasColumn('tribunales', 'condicion_interna')) {
            Schema::table('tribunales', function (Blueprint $table) {
                $table->dropColumn('condicion_interna');
            });
        }
    }
}
