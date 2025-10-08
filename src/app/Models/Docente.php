<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Docente extends Model
{
    use HasFactory;

    protected $table = 'docentes';

    protected $fillable = [
        'nombre',
        'apellido_p',
        'apellido_m',
        'ci',
        'profesion',
        'pertinencia_acad_id',
        'cod_carrera',
        'celular',
        'activo',
    ];

    // Normalizar CI en cada escritura (evita duplicados por espacios/caso)
    public function setCiAttribute($value)
    {
        $this->attributes['ci'] = strtoupper(trim((string)$value));
    }

    // Un Docente puede pertenecer a varias carreras
    public function carreras()
    {
        return $this->belongsToMany(Carrera::class, 'docente_carrera', 'docente_id', 'cod_carrera', 'id', 'cod_carrera');
    }

    // Un Docente puede (normalmente) tener un registro Tutor asociado
    public function tutor()
    {
        return $this->hasOne(Tutor::class, 'docente_id', 'id');
    }

    // Pertinencia Académica (FK)
    public function pertinenciaAcad()
    {
        return $this->belongsTo(PertinenciaAcad::class, 'pertinencia_acad_id', 'id');
    }

    // Carrera asignada principal (FK a carrera.cod_carrera)
    public function carrera()
    {
        return $this->belongsTo(Carrera::class, 'cod_carrera', 'cod_carrera');
    }
}
