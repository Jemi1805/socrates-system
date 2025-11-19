<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AddEstadoArancelToInscripModalidad extends Migration
{
    public function up()
    {
        if (Schema::hasTable('inscrip_modalidad')) {
            Schema::table('inscrip_modalidad', function (Blueprint $table) {
                if (!Schema::hasColumn('inscrip_modalidad', 'estado_arancel')) {
                    $table->string('estado_arancel', 20)->nullable()->after('aranceles_completos');
                }
            });
            // Backfill: derivar estado_arancel desde aranceles_completos si existe
            if (Schema::hasColumn('inscrip_modalidad', 'aranceles_completos')) {
                DB::table('inscrip_modalidad')->whereNull('estado_arancel')
                    ->update([
                        'estado_arancel' => DB::raw("CASE WHEN aranceles_completos = 1 THEN 'completo' ELSE 'sin_pagos' END")
                    ]);
            }
        }
    }

    public function down()
    {
        if (Schema::hasTable('inscrip_modalidad')) {
            Schema::table('inscrip_modalidad', function (Blueprint $table) {
                if (Schema::hasColumn('inscrip_modalidad', 'estado_arancel')) {
                    $table->dropColumn('estado_arancel');
                }
            });
        }
    }
}
