<?php

use Faker\Generator as Faker;

$factory->define(App\Models\Modalidad::class, function (Faker $faker) {
    return [
        'nombre' => $faker->unique()->words(3, true),
        'descripcion' => $faker->paragraph(2),
        'created_at' => now(),
        'updated_at' => now(),
    ];
});