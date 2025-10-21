<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateConvocatoriasTable extends Migration
{
    public function up()
    {
        Schema::create('convocatorias', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedSmallInteger('anio');
            $table->unsignedInteger('numero_convocatoria');
            $table->string('nombre', 30);
            $table->date('fecha_inicio');
            $table->date('fecha_fin');
            $table->string('descripcion', 100)->nullable();
            $table->boolean('es_activo')->default(true);
            $table->unsignedBigInteger('creado_por')->nullable();
            $table->timestamps();

            $table->index('es_activo', 'convocatorias_es_activo_index');
            $table->index('anio', 'convocatorias_anio_index');
            $table->index('fecha_inicio', 'convocatorias_fecha_inicio_index');
            $table->index('fecha_fin', 'convocatorias_fecha_fin_index');
            $table->unique(['anio', 'numero_convocatoria'], 'convocatorias_anio_numero_unique');

            $table->foreign('creado_por')
                ->references('id')
                ->on('usuario')
                ->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::dropIfExists('convocatorias');
    }
}
