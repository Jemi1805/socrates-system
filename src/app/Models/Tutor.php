<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tutor extends Model
{
    use HasFactory;

    protected $table = 'tutores';

    protected $fillable = [
        'activo',
        'es_tribunal',
        'condicion_interna',
        // Snapshot de datos del docente al momento de registro
        'nombre',
        'apellido_p',
        'apellido_m',
        'celular',
        'titulo',
        'titulo_academico',
        'cod_carrera',
        'ci',
        'pertinencia_acad_id',
        'pertinencia_nom',
        'tipo_tutor_id',
    ];

    public function tipo()
    {
        return $this->belongsTo(TipoTutor::class, 'tipo_tutor_id');
    }

    public function postulantes()
    {
        return $this->belongsToMany(Postulante::class, 'designacion_tutor', 'tutor_id', 'cod_ceta', 'id', 'cod_ceta')
            ->withPivot(['proyecto_id', 'fecha_designacion', 'user_id', 'estudiante_nombre', 'tutor_nombre'])
            ->withTimestamps();
    }

    // Relación N:M con pertinencias académicas
    public function pertinencias()
    {
        return $this->belongsToMany(PertinenciaAcad::class, 'tutor_pertinencia', 'tutor_id', 'pertinencia_acad_id')
            ->withTimestamps();
    }
}
