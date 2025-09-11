<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AlterInscripModalidadAddUserAndSummary extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('inscrip_modalidad')) {
            return;
        }
        Schema::table('inscrip_modalidad', function (Blueprint $table) {
            // Resumen del estudiante
            if (!Schema::hasColumn('inscrip_modalidad', 'cod_ceta_est')) {
                $table->unsignedBigInteger('cod_ceta_est')->nullable()->after('id');
                $table->index('cod_ceta_est');
            }
            if (!Schema::hasColumn('inscrip_modalidad', 'nombres_est')) {
                $table->string('nombres_est', 150)->nullable();
            }
            if (!Schema::hasColumn('inscrip_modalidad', 'apellidos_est')) {
                $table->string('apellidos_est', 150)->nullable();
            }
            // Modalidad textual (además del id existente, si lo hubiera)
            if (!Schema::hasColumn('inscrip_modalidad', 'modalidad_nom')) {
                $table->string('modalidad_nom', 120)->nullable();
            }
            // Indicador de pago completo de aranceles seleccionados
            if (!Schema::hasColumn('inscrip_modalidad', 'aranceles_completos')) {
                $table->boolean('aranceles_completos')->default(false);
            }
            // Usuario registrador
            if (!Schema::hasColumn('inscrip_modalidad', 'user_id')) {
                $table->unsignedBigInteger('user_id')->nullable();
                $table->index('user_id');
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('inscrip_modalidad')) {
            return;
        }
        Schema::table('inscrip_modalidad', function (Blueprint $table) {
            if (Schema::hasColumn('inscrip_modalidad', 'user_id')) $table->dropColumn('user_id');
            if (Schema::hasColumn('inscrip_modalidad', 'aranceles_completos')) $table->dropColumn('aranceles_completos');
            if (Schema::hasColumn('inscrip_modalidad', 'modalidad_nom')) $table->dropColumn('modalidad_nom');
            if (Schema::hasColumn('inscrip_modalidad', 'apellidos_est')) $table->dropColumn('apellidos_est');
            if (Schema::hasColumn('inscrip_modalidad', 'nombres_est')) $table->dropColumn('nombres_est');
            if (Schema::hasColumn('inscrip_modalidad', 'cod_ceta_est')) $table->dropColumn('cod_ceta_est');
        });
    }
}
