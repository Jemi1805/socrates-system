<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HomologacionCambioPlan extends Model
{
    use HasFactory;

    protected $table = 'homologacion_cambio_plan';

    protected $fillable = [
        'cod_ceta_est',
        'nro_resolucion',
        'fecha_emision',
        'observacion',
        'is_active',
    ];

    protected $casts = [
        'fecha_emision' => 'date',
        'is_active' => 'boolean',
    ];

    public function postulante()
    {
        return $this->belongsTo(Postulante::class, 'cod_ceta_est', 'cod_ceta');
    }

    public function grados()
    {
        return $this->hasMany(GradosHomolCp::class, 'homologacion_cambio_plan_id');
    }
}
