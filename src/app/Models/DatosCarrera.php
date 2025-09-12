<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DatosCarrera extends Model
{
    use HasFactory;

    protected $table = 'datos_carrera';

    protected $fillable = [
        'cod_ceta_est',
        'regimen_ini',
        'regimen_fin',
        'gestion_ini',
        'gestion_fin',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}
