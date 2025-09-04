<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddMontoArancelToModalidadTable extends Migration
{
    public function up()
    {
        if (!Schema::hasColumn('modalidad', 'monto_arancel')) {
            Schema::table('modalidad', function (Blueprint $table) {
                $table->string('monto_arancel', 100)->nullable()->after('descripcion');
            });
        }
    }

    public function down()
    {
        if (Schema::hasColumn('modalidad', 'monto_arancel')) {
            Schema::table('modalidad', function (Blueprint $table) {
                $table->dropColumn('monto_arancel');
            });
        }
    }
};