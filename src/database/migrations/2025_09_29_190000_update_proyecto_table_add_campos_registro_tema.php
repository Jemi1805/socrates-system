<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class UpdateProyectoTableAddCamposRegistroTema extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        Schema::table('proyecto', function (Blueprint $table) {
            // Eliminar la FK y la columna modalidad_id si existen
            if (Schema::hasColumn('proyecto', 'modalidad_id')) {
                try {
                    $table->dropForeign(['modalidad_id']);
                } catch (\Throwable $e) {
                    // Ignorar si la constraint ya no existe
                }
                $table->dropColumn('modalidad_id');
            }

            // Campos visibles en la UI del registro de tema
            if (!Schema::hasColumn('proyecto', 'cod_ceta')) {
                $table->string('cod_ceta', 50)->nullable();
            }
            if (!Schema::hasColumn('proyecto', 'nombres')) {
                $table->string('nombres', 150)->nullable();
            }
            if (!Schema::hasColumn('proyecto', 'apellidos')) {
                $table->string('apellidos', 150)->nullable();
            }
            if (!Schema::hasColumn('proyecto', 'ci')) {
                $table->string('ci', 50)->nullable();
            }
            if (!Schema::hasColumn('proyecto', 'expedicion')) {
                $table->string('expedicion', 10)->nullable();
            }
            if (!Schema::hasColumn('proyecto', 'celular')) {
                $table->string('celular', 30)->nullable();
            }
            if (!Schema::hasColumn('proyecto', 'instituto')) {
                $table->string('instituto', 255)->nullable();
            }
            if (!Schema::hasColumn('proyecto', 'carrera')) {
                $table->string('carrera', 120)->nullable();
            }
            // Nota: El campo 'tipo' existente se usará para guardar el nombre de la modalidad seleccionada.
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::table('proyecto', function (Blueprint $table) {
            // Revertir los nuevos campos
            foreach (['cod_ceta','nombres','apellidos','ci','expedicion','celular','instituto','carrera'] as $col) {
                if (Schema::hasColumn('proyecto', $col)) {
                    $table->dropColumn($col);
                }
            }
            // Restaurar modalidad_id (sin datos previos)
            if (!Schema::hasColumn('proyecto', 'modalidad_id')) {
                $table->foreignId('modalidad_id')->nullable()->constrained('modalidad')->onDelete('set null');
            }
        });
    }
}
