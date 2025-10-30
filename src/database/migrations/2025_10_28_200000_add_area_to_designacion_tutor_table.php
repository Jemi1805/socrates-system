<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddAreaToDesignacionTutorTable extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('designacion_tutor') && !Schema::hasColumn('designacion_tutor', 'area')) {
            Schema::table('designacion_tutor', function (Blueprint $table) {
                $table->string('area', 255)->nullable()->after('convocatoria_nom');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('designacion_tutor') && Schema::hasColumn('designacion_tutor', 'area')) {
            Schema::table('designacion_tutor', function (Blueprint $table) {
                $table->dropColumn('area');
            });
        }
    }
}
