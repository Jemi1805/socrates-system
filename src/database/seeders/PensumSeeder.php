<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class PensumSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run()
    {
        $now = date('Y-m-d H:i:s');

        $data = [
            // MEA - Mecánica Automotriz
            [
                'cod_pensum'      => 'MEA',
                'cod_carrera'     => 'MEA',
                'cantidadsemestre'=> 7,
                'descripcion'     => 'Carrera Mecánica Automotriz Antiguo Plan de Estudios',
                'orden'           => 5,
                'activo'          => true,
                'cod_secuencial'  => 1,
                'nivel'           => 'Tecnico Superior',
                'identificador'   => 'MEA',
                'resolucion'      => 'R.A. 513/2001',
                'created_at'      => $now,
                'updated_at'      => $now,
            ],
            [
                'cod_pensum'      => '04-MTZ',
                'cod_carrera'     => 'MEA',
                'cantidadsemestre'=> 7,
                'descripcion'     => 'Carrera Mecánica Automotriz Nuevo Plan de Estudios 1/2012',
                'orden'           => 4,
                'activo'          => true,
                'cod_secuencial'  => 1,
                'nivel'           => 'Tecnico Superior',
                'identificador'   => '04-MTZ',
                'resolucion'      => 'R.M. 066/2012',
                'created_at'      => $now,
                'updated_at'      => $now,
            ],
            [
                'cod_pensum'      => '04-MTZ-17',
                'cod_carrera'     => 'MEA',
                'cantidadsemestre'=> 6,
                'descripcion'     => 'Nuevo plan de estudios de Mecánica 1/2017',
                'orden'           => 2,
                'activo'          => true,
                'cod_secuencial'  => 1,
                'nivel'           => 'Tecnico Superior',
                'identificador'   => '04-MTZ',
                'resolucion'      => 'R.M. 082/2018',
                'created_at'      => $now,
                'updated_at'      => $now,
            ],
            [
                'cod_pensum'      => '04-MTZ-23',
                'cod_carrera'     => 'MEA',
                'cantidadsemestre'=> 6,
                'descripcion'     => 'Nuevo plan de estudios de Mecánica 1/2023',
                'orden'           => 1,
                'activo'          => true,
                'cod_secuencial'  => 1,
                'nivel'           => 'Tecnico Superior',
                'identificador'   => '04-MTZ',
                'resolucion'      => 'R.M. 210/2023',
                'created_at'      => $now,
                'updated_at'      => $now,
            ],



            // EEA - Electricidad y Electrónica Automotriz
            [
                'cod_pensum'      => 'EEA',
                'cod_carrera'     => 'EEA',
                'cantidadsemestre'=> 7,
                'descripcion'     => 'Carrera Electricidad y Electrónica Automotriz',
                'orden'           => 7,
                'activo'          => true,
                'cod_secuencial'  => 1001,
                'nivel'           => 'Tecnico Superior',
                'identificador'   => 'EEA',
                'resolucion'      => 'R.M. 341/2012',
                'created_at'      => $now,
                'updated_at'      => $now,
            ],
            [
                'cod_pensum'      => 'EEA-19',
                'cod_carrera'     => 'EEA',
                'cantidadsemestre'=> 7,
                'descripcion'     => 'Carrera de Electricidad y Electrónica Automotriz',
                'orden'           => 6,
                'activo'          => true,
                'cod_secuencial'  => 1001,
                'nivel'           => 'Tecnico Superior',
                'identificador'   => 'EEA',
                'resolucion'      => 'R.M. 595/2019',
                'created_at'      => $now,
                'updated_at'      => $now,
            ],
        ];

        foreach ($data as $row) {
            DB::table('pensum')->updateOrInsert(
                ['cod_pensum' => $row['cod_pensum']],
                $row
            );
        }
    }
}
