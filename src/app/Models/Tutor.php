<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tutor extends Model
{
    use HasFactory;

    protected $table = 'tutores';

    protected $fillable = [
        'docente_id',
        'activo',
        // Snapshot de datos del docente al momento de registro
        'nombre',
        'apellido_p',
        'apellido_m',
        'celular',
        'cod_carrera',
        'ci',
        'pertinencia_acad_id',
        'pertinencia_nom',
        // Gestión de registro ("1/YYYY" o "2/YYYY")
        'gestion_registro',
    ];

    public function docente()
    {
        return $this->belongsTo(Docente::class, 'docente_id', 'id');
    }

    public function postulantes()
    {
        return $this->belongsToMany(Postulante::class, 'designacion_tutor', 'tutor_id', 'cod_ceta', 'id', 'cod_ceta')
            ->withPivot(['fecha_designacion', 'user_id'])
            ->withTimestamps();
    }

    // Relación N:M con pertinencias académicas
    public function pertinencias()
    {
        return $this->belongsToMany(PertinenciaAcad::class, 'tutor_pertinencia', 'tutor_id', 'pertinencia_acad_id')
            ->withTimestamps();
    }
}
