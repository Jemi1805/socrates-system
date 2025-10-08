<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AddUniqueCiToDocentes extends Migration {
    public function up()
    {
        // 1) Normalizar todos los CI existentes a UPPER(TRIM(ci))
        DB::statement("UPDATE docentes SET ci = UPPER(TRIM(ci)) WHERE ci IS NOT NULL");

        // 2) Reasignar tutores y eliminar duplicados por CI normalizado
        $dups = DB::table('docentes')
            ->selectRaw('ci as ci_norm, GROUP_CONCAT(id ORDER BY id ASC) as ids, COUNT(*) as c')
            ->groupBy('ci_norm')
            ->having('c', '>', 1)
            ->get();

        foreach ($dups as $row) {
            $ids = array_filter(array_map('intval', explode(',', (string)$row->ids)));
            if (count($ids) <= 1) continue;
            $keep = array_shift($ids); // conservar el primero
            // actualizar referencias en tutores
            DB::table('tutores')->whereIn('docente_id', $ids)->update(['docente_id' => $keep]);
            // eliminar duplicados
            DB::table('docentes')->whereIn('id', $ids)->delete();
        }

        // 3) Crear índice único en docentes.ci
        // (sin Doctrine) Revisar en INFORMATION_SCHEMA si existe ya el índice
        $exists = DB::selectOne(
            "SELECT COUNT(1) AS c FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
            ['docentes', 'docentes_ci_unique']
        );
        if (!$exists || (int)$exists->c === 0) {
            Schema::table('docentes', function (Blueprint $table) {
                $table->unique('ci', 'docentes_ci_unique');
            });
        }
    }

    public function down()
    {
        // (sin Doctrine) Eliminar índice si existe
        $exists = DB::selectOne(
            "SELECT COUNT(1) AS c FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
            ['docentes', 'docentes_ci_unique']
        );
        if ($exists && (int)$exists->c > 0) {
            DB::statement('ALTER TABLE docentes DROP INDEX docentes_ci_unique');
        }
    }
};
