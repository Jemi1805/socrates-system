<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddConvocatoriaRelations extends Migration
{
    public function up()
    {
        if (Schema::hasTable('inscrip_modalidad') && !Schema::hasColumn('inscrip_modalidad', 'convocatoria_id')) {
            Schema::table('inscrip_modalidad', function (Blueprint $table) {
                $table->unsignedBigInteger('convocatoria_id')->nullable();
                $table->index('convocatoria_id', 'inscrip_modalidad_convocatoria_id_idx');
                $table->foreign('convocatoria_id', 'inscrip_modalidad_convocatoria_id_fk')
                    ->references('id')
                    ->on('convocatorias')
                    ->onDelete('set null');
            });
        }

        if (Schema::hasTable('designacion_tutor') && !Schema::hasColumn('designacion_tutor', 'convocatoria_id')) {
            Schema::table('designacion_tutor', function (Blueprint $table) {
                $table->unsignedBigInteger('convocatoria_id')->nullable();
                $table->index('convocatoria_id', 'designacion_tutor_convocatoria_id_idx');
                $table->foreign('convocatoria_id', 'designacion_tutor_convocatoria_id_fk')
                    ->references('id')
                    ->on('convocatorias')
                    ->onDelete('set null');
            });
        }
    }

    public function down()
    {
        if (Schema::hasTable('designacion_tutor') && Schema::hasColumn('designacion_tutor', 'convocatoria_id')) {
            Schema::table('designacion_tutor', function (Blueprint $table) {
                $table->dropForeign('designacion_tutor_convocatoria_id_fk');
                $table->dropIndex('designacion_tutor_convocatoria_id_idx');
                $table->dropColumn('convocatoria_id');
            });
        }

        if (Schema::hasTable('inscrip_modalidad') && Schema::hasColumn('inscrip_modalidad', 'convocatoria_id')) {
            Schema::table('inscrip_modalidad', function (Blueprint $table) {
                $table->dropForeign('inscrip_modalidad_convocatoria_id_fk');
                $table->dropIndex('inscrip_modalidad_convocatoria_id_idx');
                $table->dropColumn('convocatoria_id');
            });
        }
    }
}