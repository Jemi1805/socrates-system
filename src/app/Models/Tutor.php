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
}
