<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class CreateRolTribunalTable extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('rol_tribunal')) {
            Schema::create('rol_tribunal', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->string('codigo', 50)->unique();
                $table->string('nombre', 150);
                $table->boolean('activo')->default(true);
                $table->timestamps();
            });
        }

        // Seed básico de roles estándar de tribunal
        if (Schema::hasTable('rol_tribunal')) {
            $now = now();
            $base = [
                ['codigo' => 'PRESIDENTE', 'nombre' => 'Presidente de tribunal'],
                ['codigo' => 'DELEGADO_INTERNO', 'nombre' => 'Delegado interno'],
                ['codigo' => 'DELEGADO_EXTERNO', 'nombre' => 'Delegado externo'],
                ['codigo' => 'VOCAL', 'nombre' => 'Vocal'],
            ];
            foreach ($base as $row) {
                $exists = DB::table('rol_tribunal')->where('codigo', $row['codigo'])->exists();
                if (!$exists) {
                    DB::table('rol_tribunal')->insert([
                        'codigo' => $row['codigo'],
                        'nombre' => $row['nombre'],
                        'activo' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }
    }

    public function down()
    {
        if (Schema::hasTable('rol_tribunal')) {
            Schema::dropIfExists('rol_tribunal');
        }
    }
}
