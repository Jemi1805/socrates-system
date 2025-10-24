<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DesignacionTutor extends Model
{
    use HasFactory;

    protected $table = 'designacion_tutor';

    protected $fillable = [
        'tutor_id',
        'cod_ceta',
        'proyecto_id',
        'user_id',
        'user_name',
        'fecha_designacion',
        'convocatoria_id',
        'convocatoria_nom',
        'estudiante_nombre',
        'tutor_nombre',
    ];

    protected $casts = [
        'fecha_designacion' => 'date',
    ];

    public function tutor()
    {
        return $this->belongsTo(Tutor::class, 'tutor_id');
    }

    public function postulante()
    {
        return $this->belongsTo(Postulante::class, 'cod_ceta', 'cod_ceta');
    }

    public function convocatoria()
    {
        return $this->belongsTo(Convocatoria::class, 'convocatoria_id');
    }

    public function proyecto()
    {
        return $this->belongsTo(Proyecto::class, 'proyecto_id');
    }

    public function usuario()
    {
        return $this->belongsTo(Usuario::class, 'user_id');
    }
}
