<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ModalidadSeeder extends Seeder
{
    public function run()
    {
        $modalidades = [
            [
                'nombre' => 'Proyecto de Grado',
                'descripcion' => 'Trabajo aplicado o propuesta orientado a resolver un problema práctico, traducido en un documento final.',
                'monto_arancel' => '1500.00 - 1800.00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'Proyecto Sociocomunitario Productivo',
                'descripcion' => 'Experiencia aplicada a necesidades socioeconómicas de una comunidad, desarrollada de manera participativa.',
                'monto_arancel' => '1500.00 - 1800.00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'Proyecto de Emprendimiento Productivo',
                'descripcion' => 'Propuesta de innovación basada en un emprendimiento exitoso, propio, familiar o comunitario.',
                'monto_arancel' => '1500.00 - 1800.00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'Trabajo Dirigido Externo',
                'descripcion' => 'Sistematización de una experiencia laboral en una institución o empresa, con propuesta de solución viable.',
                'monto_arancel' => '1500.00 - 1800.00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'Graduación por Excelencia Académica',
                'descripcion' => 'Modalidad para estudiantes con excelente rendimiento académico o reconocimiento en eventos de innovación.',
                'monto_arancel' => '1200.00 - 1500.00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'Graduación por Experiencia Laboral',
                'descripcion' => 'Dirigida a estudiantes que hayan trabajado durante su formación, presentando una propuesta de mejora avalada por la empresa.',
                'monto_arancel' => '1500.00 - 1800.00',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        // Evitar duplicados si el seeder se ejecuta múltiples veces
        foreach ($modalidades as $data) {
            DB::table('modalidad')->updateOrInsert(
                ['nombre' => $data['nombre']],
                $data
            );
        }
    }
}