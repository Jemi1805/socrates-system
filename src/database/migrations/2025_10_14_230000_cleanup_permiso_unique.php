<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class CleanupPermisoUnique extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        // 1) Asegurar que ningun codigo sea NULL (reemplazar NULL con "legacy.{id}")
        try {
            DB::statement("UPDATE permiso SET codigo = CONCAT('legacy.', id) WHERE codigo IS NULL");
        } catch (\Throwable $e) { /* ignore */ }

        // 2) Eliminar duplicados por codigo, conservando el menor id
        try {
            DB::statement(
                "DELETE p1 FROM permiso p1 INNER JOIN permiso p2 ON p1.codigo = p2.codigo AND p1.id > p2.id"
            );
        } catch (\Throwable $e) { /* ignore */ }

        // 3) Hacer NOT NULL y UNIQUE el codigo
        try {
            DB::statement("ALTER TABLE permiso MODIFY codigo VARCHAR(255) NOT NULL");
        } catch (\Throwable $e) { /* ignore */ }
        try {
            DB::statement("ALTER TABLE permiso ADD UNIQUE KEY permiso_codigo_unique (codigo)");
        } catch (\Throwable $e) { /* ignore */ }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        // Quitar unique; dejar como NULLABLE nuevamente
        try {
            DB::statement("ALTER TABLE permiso DROP INDEX permiso_codigo_unique");
        } catch (\Throwable $e) { /* ignore */ }
        try {
            DB::statement("ALTER TABLE permiso MODIFY codigo VARCHAR(255) NULL");
        } catch (\Throwable $e) { /* ignore */ }
    }
}
