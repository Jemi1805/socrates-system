<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AlterTraspasosInstitutoDropGradosGestionesColumns extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('traspasos_instituto')) {
            return;
        }
        Schema::table('traspasos_instituto', function (Blueprint $table) {
            if (Schema::hasColumn('traspasos_instituto', 'grados_cursados')) {
                $table->dropColumn('grados_cursados');
            }
            if (Schema::hasColumn('traspasos_instituto', 'gestiones_cursadas')) {
                $table->dropColumn('gestiones_cursadas');
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('traspasos_instituto')) {
            return;
        }
        Schema::table('traspasos_instituto', function (Blueprint $table) {
            if (!Schema::hasColumn('traspasos_instituto', 'grados_cursados')) {
                $table->text('grados_cursados')->nullable();
            }
            if (!Schema::hasColumn('traspasos_instituto', 'gestiones_cursadas')) {
                $table->text('gestiones_cursadas')->nullable();
            }
        });
    }
}
