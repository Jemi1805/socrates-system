<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AlterArancelesEstAddSelectionAndLink extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('aranceles_est')) {
            return;
        }

        Schema::table('aranceles_est', function (Blueprint $table) {
            // Vínculo con inscripción (opcional)
            if (!Schema::hasColumn('aranceles_est', 'inscrip_modalidad_id')) {
                $table->unsignedBigInteger('inscrip_modalidad_id')->nullable()->after('cod_ceta_est');
                $table->index('inscrip_modalidad_id');
            }
            // Marcador de selección desde UI
            if (!Schema::hasColumn('aranceles_est', 'seleccionado')) {
                $table->boolean('seleccionado')->default(false);
            }
            // Origen del arancel (sga|manual)
            if (!Schema::hasColumn('aranceles_est', 'origen')) {
                $table->string('origen', 20)->nullable();
            }
            // Campos opcionales para registro manual/soporte
            if (!Schema::hasColumn('aranceles_est', 'gestion')) {
                $table->string('gestion', 10)->nullable(); // Ej.: 1/2025
            }
            if (!Schema::hasColumn('aranceles_est', 'fecha')) {
                $table->date('fecha')->nullable();
            }
            if (!Schema::hasColumn('aranceles_est', 'num_factura')) {
                $table->string('num_factura', 50)->nullable();
            }
            if (!Schema::hasColumn('aranceles_est', 'num_comprobante')) {
                $table->string('num_comprobante', 50)->nullable();
            }
            if (!Schema::hasColumn('aranceles_est', 'razon')) {
                $table->string('razon', 255)->nullable();
            }
            if (!Schema::hasColumn('aranceles_est', 'nit')) {
                $table->string('nit', 30)->nullable();
            }
            // Asegurar columnas de estado de pago
            if (!Schema::hasColumn('aranceles_est', 'pagado')) {
                $table->boolean('pagado')->default(false);
            }
            if (!Schema::hasColumn('aranceles_est', 'fecha_pago')) {
                $table->date('fecha_pago')->nullable();
            }
        });
    }

    public function down()
    {
        if (!Schema::hasTable('aranceles_est')) {
            return;
        }
        Schema::table('aranceles_est', function (Blueprint $table) {
            if (Schema::hasColumn('aranceles_est', 'inscrip_modalidad_id')) $table->dropColumn('inscrip_modalidad_id');
            if (Schema::hasColumn('aranceles_est', 'seleccionado')) $table->dropColumn('seleccionado');
            if (Schema::hasColumn('aranceles_est', 'origen')) $table->dropColumn('origen');
            if (Schema::hasColumn('aranceles_est', 'gestion')) $table->dropColumn('gestion');
            if (Schema::hasColumn('aranceles_est', 'fecha')) $table->dropColumn('fecha');
            if (Schema::hasColumn('aranceles_est', 'num_factura')) $table->dropColumn('num_factura');
            if (Schema::hasColumn('aranceles_est', 'num_comprobante')) $table->dropColumn('num_comprobante');
            if (Schema::hasColumn('aranceles_est', 'razon')) $table->dropColumn('razon');
            if (Schema::hasColumn('aranceles_est', 'nit')) $table->dropColumn('nit');
            if (Schema::hasColumn('aranceles_est', 'pagado')) $table->dropColumn('pagado');
            if (Schema::hasColumn('aranceles_est', 'fecha_pago')) $table->dropColumn('fecha_pago');
        });
    }
}
