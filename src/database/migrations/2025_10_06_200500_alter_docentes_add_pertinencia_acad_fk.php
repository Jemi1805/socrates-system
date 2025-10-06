<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class AlterDocentesAddPertinenciaAcadFk extends Migration
{
    public function up()
    {
        // Agregar columna FK
        Schema::table('docentes', function (Blueprint $table) {
            if (!Schema::hasColumn('docentes', 'pertinencia_acad_id')) {
                $table->unsignedBigInteger('pertinencia_acad_id')->nullable()->after('profesion');
            }
        });

        // Backfill: migrar valores existentes de docentes.pertinencia a pertinencia_acad y setear FK
        if (Schema::hasTable('docentes') && Schema::hasColumn('docentes', 'pertinencia')) {
            $distincts = DB::table('docentes')
                ->select('pertinencia')
                ->whereNotNull('pertinencia')
                ->where('pertinencia', '<>', '')
                ->distinct()
                ->get();

            foreach ($distincts as $row) {
                $name = trim((string)$row->pertinencia);
                if ($name === '') continue;
                $existing = DB::table('pertinencia_acad')->where('nombre_pert', $name)->first();
                if ($existing) {
                    $pertId = $existing->id;
                } else {
                    $pertId = DB::table('pertinencia_acad')->insertGetId([
                        'nombre_pert' => $name,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
                DB::table('docentes')->where('pertinencia', $name)->update(['pertinencia_acad_id' => $pertId]);
            }

            // Eliminar columna de texto anterior
            Schema::table('docentes', function (Blueprint $table) {
                $table->dropColumn('pertinencia');
            });
        }

        // Agregar la clave foránea
        Schema::table('docentes', function (Blueprint $table) {
            if (Schema::hasColumn('docentes', 'pertinencia_acad_id')) {
                $table->foreign('pertinencia_acad_id')
                    ->references('id')->on('pertinencia_acad')
                    ->onDelete('set null');
            }
        });
    }

    public function down()
    {
        // Eliminar FK y columna nueva
        Schema::table('docentes', function (Blueprint $table) {
            if (Schema::hasColumn('docentes', 'pertinencia_acad_id')) {
                // El nombre de la FK puede ser generado, intentamos forma convencional
                try {
                    $table->dropForeign(['pertinencia_acad_id']);
                } catch (\Throwable $e) {
                    // Ignorar si no existe
                }
                $table->dropColumn('pertinencia_acad_id');
            }
        });

        // Restaurar columna anterior
        Schema::table('docentes', function (Blueprint $table) {
            if (!Schema::hasColumn('docentes', 'pertinencia')) {
                $table->string('pertinencia')->nullable()->after('profesion');
            }
        });
    }
}
