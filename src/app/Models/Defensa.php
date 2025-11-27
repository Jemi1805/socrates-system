<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Defensa extends Model
{
    use HasFactory;

    protected $table = 'defensas';

    protected $fillable = [
        'proyecto_id',
        'cod_ceta',
        'convocatoria_id',
        'fecha_defensa',
        'hora_inicio',
        'hora_fin',
        'grupo',
        'aula',
        'estado_defensa',
        'observaciones',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'fecha_defensa' => 'date',
    ];

    public function proyecto()
    {
        return $this->belongsTo(Proyecto::class, 'proyecto_id');
    }

    public function convocatoria()
    {
        return $this->belongsTo(Convocatoria::class, 'convocatoria_id');
    }

    public function miembrosTribunal()
    {
        return $this->hasMany(DefensaTribunal::class, 'defensa_id');
    }
}
