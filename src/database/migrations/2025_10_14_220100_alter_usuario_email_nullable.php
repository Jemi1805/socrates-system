<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

class AlterUsuarioEmailNullable extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        try {
            DB::statement("ALTER TABLE `usuario` MODIFY `email` VARCHAR(255) NULL");
        } catch (\Throwable $e) {
            // La columna ya puede ser NULL o no existir; ignorar
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        try {
            DB::statement("ALTER TABLE `usuario` MODIFY `email` VARCHAR(255) NOT NULL");
        } catch (\Throwable $e) {
            // Revertir solo si aplica
        }
    }
}
