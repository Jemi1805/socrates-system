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
        'cod_carrera',
        'regimen_ini',
        'regimen_fin',
        'gestion_ini',
        'gestion_fin',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Relación inversa con postulante
     */
    public function postulante()
    {
        return $this->belongsTo(Postulante::class, 'cod_ceta_est', 'cod_ceta');
    }

    /**
     * Relación con carrera (pivot por cod_carrera)
     */
    public function carrera()
    {
        return $this->belongsTo(Carrera::class, 'cod_carrera', 'cod_carrera');
    }
}
