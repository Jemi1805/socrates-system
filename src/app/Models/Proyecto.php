<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Proyecto extends Model
{
    use HasFactory;

    protected $table = 'proyecto';

    protected $fillable = [
        'cod_ceta',
        'nombres',
        'apellidos',
        'ci',
        'expedicion',
        'celular',
        'instituto',
        'carrera',
        'nombre',
        'tipo',
        'objetivo',
        'estado',
        'porcentaje_avance',
    ];

    protected $casts = [
        'porcentaje_avance' => 'integer',
    ];
}
