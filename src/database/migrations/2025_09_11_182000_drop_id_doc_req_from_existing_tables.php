<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class DropIdDocReqFromExistingTables extends Migration
{
    public function up()
    {
        $candidateTables = array(
            'diploma_bachiller',
            'transitabilidad_edu_reg',
            'transitabilidad_inst_tec',
            'traspasos_instituto',
            'ra_homol_ex',            // puede haber sido eliminada; validamos existencia
            'res_homol_cp',           // puede haber sido eliminada; validamos existencia
            'documentos_adjuntos',    // por si hubiese referencia
            'documentos_requeridos',  // por si hubiese referencia
        );

        foreach ($candidateTables as $tbl) {
            if (Schema::hasTable($tbl) && Schema::hasColumn($tbl, 'id_doc_req')) {
                Schema::table($tbl, function (Blueprint $table) use ($tbl) {
                    // Eliminar columna legacy
                    $table->dropColumn('id_doc_req');
                });
            }
        }
    }

    public function down()
    {
        // Restaurar columna como nullable (sin FKs) solo para permitir rollback
        $candidateTables = array(
            'diploma_bachiller',
            'transitabilidad_edu_reg',
            'transitabilidad_inst_tec',
            'traspasos_instituto',
            'ra_homol_ex',
            'res_homol_cp',
            'documentos_adjuntos',
            'documentos_requeridos',
        );

        foreach ($candidateTables as $tbl) {
            if (Schema::hasTable($tbl) && !Schema::hasColumn($tbl, 'id_doc_req')) {
                Schema::table($tbl, function (Blueprint $table) use ($tbl) {
                    $table->unsignedBigInteger('id_doc_req')->nullable();
                });
            }
        }
    }
}
