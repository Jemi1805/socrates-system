<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PertinenciaAcadSeeder extends Seeder
{
    public function run()
    {
        $now = now();

        // Mapear pertinencias por carrera (usar códigos existentes: EEA, MEA)
        $items = [
            // Electricidad y Electrónica Automotriz (EEA)
            ['nombre_pert' => 'Electricidad Automotriz',              'cod_carrera' => 'EEA'],
            ['nombre_pert' => 'Inyección Electrónica Diesel',         'cod_carrera' => 'EEA'],
            ['nombre_pert' => 'Sistemas de Seguridad y Confort automotriz', 'cod_carrera' => 'EEA'],
            ['nombre_pert' => 'Inyección Electrónica Gasolina',       'cod_carrera' => 'EEA'],

            // Mecánica Automotriz (MEA)
            ['nombre_pert' => 'Transmisión',                          'cod_carrera' => 'MEA'],
            ['nombre_pert' => 'Emprendimiento Productivo',            'cod_carrera' => 'MEA'],
        ];

        foreach ($items as $it) {
            DB::table('pertinencia_acad')->updateOrInsert(
                ['nombre_pert' => $it['nombre_pert'], 'cod_carrera' => $it['cod_carrera']],
                ['created_at' => $now, 'updated_at' => $now]
            );
        }
    }
}
