<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddNroPostulanteAndSequences extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('inscrip_modalidad') && !Schema::hasColumn('inscrip_modalidad', 'nro_postulante')) {
            Schema::table('inscrip_modalidad', function (Blueprint $table) {
                $table->unsignedInteger('nro_postulante')->nullable()->after('nom_convocatoria');
                $table->index(['nro_postulante']);
            });
        }

        if (!Schema::hasTable('postulante_num_secuencias')) {
            Schema::create('postulante_num_secuencias', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('convocatoria_id');
                $table->unsignedInteger('last_numero')->default(0);
                $table->timestamps();
                $table->unique(['convocatoria_id']);
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('inscrip_modalidad') && Schema::hasColumn('inscrip_modalidad', 'nro_postulante')) {
            Schema::table('inscrip_modalidad', function (Blueprint $table) {
                $table->dropIndex(['nro_postulante']);
                $table->dropColumn('nro_postulante');
            });
        }

        if (Schema::hasTable('postulante_num_secuencias')) {
            Schema::dropIfExists('postulante_num_secuencias');
        }
    }
}
