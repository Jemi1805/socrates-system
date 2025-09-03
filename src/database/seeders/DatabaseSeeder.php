<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run()
    {
        // Ejecutar seeder de roles y permisos
        $this->call([
            RolePermissionSeeder::class,
            ModalidadSeeder::class,
            // Semillas base para carreras y pensums
            CarreraSeeder::class,
            PensumSeeder::class,
        ]);

        // Crear usuarios adicionales de prueba si es necesario
        // User::factory(10)->create();
    }
}
