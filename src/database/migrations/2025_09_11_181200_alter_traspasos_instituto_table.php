<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AlterTraspasosInstitutoTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('traspasos_instituto')) {
            return;
        }
        Schema::table('traspasos_instituto', function (Blueprint $table) {
            if (!Schema::hasColumn('traspasos_instituto', 'cod_ceta_est')) {
                $table->unsignedBigInteger('cod_ceta_est')->nullable()->after('id');
                $table->index('cod_ceta_est');
            }
            if (!Schema::hasColumn('traspasos_instituto', 'instituto_origen')) {
                $table->string('instituto_origen', 255)->nullable();
            }
            if (!Schema::hasColumn('traspasos_instituto', 'observacion')) {
                $table->text('observacion')->nullable();
            }
            if (!Schema::hasColumn('traspasos_instituto', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('traspasos_instituto')) {
            return;
        }
        Schema::table('traspasos_instituto', function (Blueprint $table) {
            if (Schema::hasColumn('traspasos_instituto', 'is_active')) $table->dropColumn('is_active');
            if (Schema::hasColumn('traspasos_instituto', 'observacion')) $table->dropColumn('observacion');
            if (Schema::hasColumn('traspasos_instituto', 'instituto_origen')) $table->dropColumn('instituto_origen');
            // cod_ceta_est se deja para no romper relaciones existentes
        });
    }
}
