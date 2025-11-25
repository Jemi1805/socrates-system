<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

use App\Models\InscripModalidad;
use App\Models\DesignacionTutor;
use App\Models\Usuario;

class Convocatoria extends Model
{
    use HasFactory;

    protected $table = 'convocatorias';

    protected $fillable = [
        'anio',
        'numero_convocatoria',
        'nombre',
        'fecha_inicio',
        'fecha_fin',
        'mes_defensa',
        'descripcion',
        'es_activo',
        'creado_por',
    ];

    protected $casts = [
        'fecha_inicio' => 'date',
        'fecha_fin' => 'date',
        'es_activo' => 'boolean',
    ];

    public function creador()
    {
        return $this->belongsTo(Usuario::class, 'creado_por');
    }

    public function inscripciones()
    {
        return $this->hasMany(InscripModalidad::class, 'convocatoria_id');
    }

    public function designacionesTutor()
    {
        return $this->hasMany(DesignacionTutor::class, 'convocatoria_id');
    }
}
