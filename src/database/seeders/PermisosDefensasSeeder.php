<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Permiso;

class PermisosDefensasSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run()
    {
        // Permiso para programar defensas
        Permiso::firstOrCreate(
            ['codigo' => 'defensas.programar'],
            [
                'nombre' => 'Programar defensas',
                'descripcion' => 'Permite crear programación de defensas de proyecto',
            ]
        );

        // Permiso para reprogramar defensas
        Permiso::firstOrCreate(
            ['codigo' => 'defensas.reprogramar'],
            [
                'nombre' => 'Reprogramar defensas',
                'descripcion' => 'Permite reprogramar defensas de proyecto',
            ]
        );
    }
}
