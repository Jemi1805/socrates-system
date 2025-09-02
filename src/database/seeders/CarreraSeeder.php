<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class CarreraSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run()
    {
        $now = date('Y-m-d H:i:s');

        // Mecánica Automotriz (MEA)
        DB::table('carrera')->updateOrInsert(
            ['cod_carrera' => 'MEA'],
            [
                'nombre_carrera' => 'Mecánica Automotriz',
                'descripcion' => 'Carrera de Mecánica Automotriz',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        // Electricidad y Electrónica Automotriz (EEA)
        DB::table('carrera')->updateOrInsert(
            ['cod_carrera' => 'EEA'],
            [
                'nombre_carrera' => 'Electricidad y Electrónica Automotriz',
                'descripcion' => 'Carrera de electricidad y electrónica automotriz',
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }
}

