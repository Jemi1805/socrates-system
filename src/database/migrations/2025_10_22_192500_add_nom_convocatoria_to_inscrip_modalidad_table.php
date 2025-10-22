<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddNomConvocatoriaToInscripModalidadTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('inscrip_modalidad')) {
            return;
        }

        Schema::table('inscrip_modalidad', function (Blueprint $table) {
            if (!Schema::hasColumn('inscrip_modalidad', 'nom_convocatoria')) {
                $table->string('nom_convocatoria', 150)->nullable()->after('convocatoria_id');
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('inscrip_modalidad')) {
            return;
        }

        Schema::table('inscrip_modalidad', function (Blueprint $table) {
            if (Schema::hasColumn('inscrip_modalidad', 'nom_convocatoria')) {
                $table->dropColumn('nom_convocatoria');
            }
        });
    }
}
