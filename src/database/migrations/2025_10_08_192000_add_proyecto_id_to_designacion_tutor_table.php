<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddProyectoIdToDesignacionTutorTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('designacion_tutor')) {
            // Agregar columna proyecto_id si no existe
            if (!Schema::hasColumn('designacion_tutor', 'proyecto_id')) {
                Schema::table('designacion_tutor', function (Blueprint $table) {
                    $table->unsignedBigInteger('proyecto_id')->nullable()->after('cod_ceta');
                });

                Schema::table('designacion_tutor', function (Blueprint $table) {
                    $table->foreign('proyecto_id')
                        ->references('id')->on('proyecto')
                        ->onDelete('cascade');
                });

                // Un tutor por tema (opcional). Si en tu negocio se permiten co-tutores, comenta esta línea.
                Schema::table('designacion_tutor', function (Blueprint $table) {
                    $table->unique(['proyecto_id'], 'uq_designacion_proyecto');
                });
            }
        } else {
            // Si la tabla aún no existe (por si el proyecto no corrió la migración de creación), crearla completa
            Schema::create('designacion_tutor', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->unsignedBigInteger('tutor_id');
                $table->unsignedBigInteger('cod_ceta');
                $table->unsignedBigInteger('proyecto_id')->nullable();
                $table->unsignedBigInteger('user_id')->nullable();
                $table->date('fecha_designacion')->nullable();
                $table->timestamps();

                $table->index(['cod_ceta']);
                $table->index(['tutor_id']);
                $table->unique(['tutor_id', 'cod_ceta'], 'uq_designacion_tutor_est');
                $table->unique(['proyecto_id'], 'uq_designacion_proyecto');

                $table->foreign('tutor_id')->references('id')->on('tutores')->onDelete('cascade');
                $table->foreign('cod_ceta')->references('cod_ceta')->on('postulantes')->onDelete('cascade');
                $table->foreign('proyecto_id')->references('id')->on('proyecto')->onDelete('cascade');
                $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            });
        }
    }

    public function down()
    {
        if (Schema::hasTable('designacion_tutor')) {
            Schema::table('designacion_tutor', function (Blueprint $table) {
                if (Schema::hasColumn('designacion_tutor', 'proyecto_id')) {
                    $table->dropUnique('uq_designacion_proyecto');
                    $table->dropForeign(['proyecto_id']);
                    $table->dropColumn('proyecto_id');
                }
            });
        }
    }
}
