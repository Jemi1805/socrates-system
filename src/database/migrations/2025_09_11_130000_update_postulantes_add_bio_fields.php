<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class UpdatePostulantesAddBioFields extends Migration
{
    public function up()
    {
        Schema::table('postulantes', function (Blueprint $table) {
            // Nuevos campos biográficos
            if (!Schema::hasColumn('postulantes', 'ap_pat')) {
                $table->string('ap_pat')->nullable()->after('nombres_est');
            }
            if (!Schema::hasColumn('postulantes', 'ap_mat')) {
                $table->string('ap_mat')->nullable()->after('ap_pat');
            }
            if (!Schema::hasColumn('postulantes', 'complemento')) {
                $table->string('complemento', 2)->nullable()->after('ci');
            }
            if (!Schema::hasColumn('postulantes', 'fecha_nacimiento')) {
                $table->date('fecha_nacimiento')->nullable()->after('ap_mat');
            }
            if (!Schema::hasColumn('postulantes', 'lugar_nacimiento')) {
                $table->string('lugar_nacimiento')->nullable()->after('fecha_nacimiento');
            }
            if (!Schema::hasColumn('postulantes', 'procedencia')) {
                $table->string('procedencia')->nullable()->after('lugar_nacimiento');
            }
            if (!Schema::hasColumn('postulantes', 'pensum')) {
                $table->string('pensum', 50)->nullable()->after('carrera');
            }
        });
    }

    public function down()
    {
        Schema::table('postulantes', function (Blueprint $table) {
            if (Schema::hasColumn('postulantes', 'pensum')) {
                $table->dropColumn('pensum');
            }
            if (Schema::hasColumn('postulantes', 'procedencia')) {
                $table->dropColumn('procedencia');
            }
            if (Schema::hasColumn('postulantes', 'lugar_nacimiento')) {
                $table->dropColumn('lugar_nacimiento');
            }
            if (Schema::hasColumn('postulantes', 'fecha_nacimiento')) {
                $table->dropColumn('fecha_nacimiento');
            }
            if (Schema::hasColumn('postulantes', 'complemento')) {
                $table->dropColumn('complemento');
            }
            if (Schema::hasColumn('postulantes', 'ap_mat')) {
                $table->dropColumn('ap_mat');
            }
            if (Schema::hasColumn('postulantes', 'ap_pat')) {
                $table->dropColumn('ap_pat');
            }
        });
    }
};
