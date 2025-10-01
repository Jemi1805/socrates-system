<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('proyecto', function (Blueprint $table) {
            if (!Schema::hasColumn('proyecto', 'inscrip_modalidad_id')) {
                $table->unsignedBigInteger('inscrip_modalidad_id')->nullable()->after('porcentaje_avance');
                $table->index('inscrip_modalidad_id', 'proyecto_inscrip_modalidad_id_idx');
                $table->foreign('inscrip_modalidad_id', 'proyecto_inscrip_modalidad_id_fk')
                    ->references('id')->on('inscrip_modalidad')
                    ->onDelete('cascade');
            }
        });
    }

    public function down(): void
    {
        Schema::table('proyecto', function (Blueprint $table) {
            if (Schema::hasColumn('proyecto', 'inscrip_modalidad_id')) {
                // Drop FK and index names used above to be explicit
                $table->dropForeign('proyecto_inscrip_modalidad_id_fk');
                $table->dropIndex('proyecto_inscrip_modalidad_id_idx');
                $table->dropColumn('inscrip_modalidad_id');
            }
        });
    }
};
