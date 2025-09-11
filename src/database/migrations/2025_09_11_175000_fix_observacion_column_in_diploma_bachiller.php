<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class FixObservacionColumnInDiplomaBachiller extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('diploma_bachiller')) {
            return;
        }

        // Asegurar columna estandar sin acento
        Schema::table('diploma_bachiller', function (Blueprint $table) {
            if (!Schema::hasColumn('diploma_bachiller', 'observacion')) {
                $table->text('observacion')->nullable();
            }
        });

        // Migrar datos desde posibles columnas legacy con acentos/encoding raros
        $legacyNames = ['observación', 'observaciÃ³n'];
        foreach ($legacyNames as $legacy) {
            if (Schema::hasColumn('diploma_bachiller', $legacy)) {
                // Copiar valores donde observacion esté NULL
                DB::statement("UPDATE diploma_bachiller SET observacion = COALESCE(observacion, `{$legacy}`)");
            }
        }

        // Eliminar columnas legacy si existen
        Schema::table('diploma_bachiller', function (Blueprint $table) use ($legacyNames) {
            foreach ($legacyNames as $legacy) {
                if (Schema::hasColumn('diploma_bachiller', $legacy)) {
                    $table->dropColumn($legacy);
                }
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('diploma_bachiller')) {
            return;
        }

        // Recrear columna legacy con acento (por compatibilidad de rollback)
        Schema::table('diploma_bachiller', function (Blueprint $table) {
            if (!Schema::hasColumn('diploma_bachiller', 'observación')) {
                $table->text('observación')->nullable();
            }
        });

        // Copiar los datos actuales a la columna legacy
        if (Schema::hasColumn('diploma_bachiller', 'observacion')) {
            DB::statement("UPDATE diploma_bachiller SET `observación` = observacion WHERE `observación` IS NULL");
        }
    }
}
