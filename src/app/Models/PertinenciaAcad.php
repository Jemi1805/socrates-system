<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PertinenciaAcad extends Model
{
    use HasFactory;

    protected $table = 'pertinencia_acad';

    protected $fillable = [
        'nombre_pert',
        'cod_carrera',
        'activo',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    public function docentes()
    {
        return $this->hasMany(Docente::class, 'pertinencia_acad_id', 'id');
    }

    public function carrera()
    {
        return $this->belongsTo(Carrera::class, 'cod_carrera', 'cod_carrera');
    }
}
