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
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'Proyecto Sociocomunitario Productivo',
                'descripcion' => 'Experiencia aplicada a necesidades socioeconómicas de una comunidad, desarrollada de manera participativa.',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'Proyecto de Emprendimiento Productivo',
                'descripcion' => 'Propuesta de innovación basada en un emprendimiento exitoso, propio, familiar o comunitario.',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'Trabajo Dirigido Externo',
                'descripcion' => 'Sistematización de una experiencia laboral en una institución o empresa, con propuesta de solución viable.',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'Graduación por Excelencia Académica',
                'descripcion' => 'Modalidad para estudiantes con excelente rendimiento académico o reconocimiento en eventos de innovación.',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'nombre' => 'Graduación por Experiencia Laboral',
                'descripcion' => 'Dirigida a estudiantes que hayan trabajado durante su formación, presentando una propuesta de mejora avalada por la empresa.',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ];

        DB::table('modalidad')->insert($modalidades);
    }
}