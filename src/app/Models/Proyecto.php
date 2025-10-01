<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Proyecto extends Model
{
    use HasFactory;

    protected $table = 'proyecto';

    protected $fillable = [
        'cod_ceta',
        'nombres',
        'apellidos',
        'ci',
        'expedicion',
        'celular',
        'instituto',
        'carrera',
        'nombre',
        'tipo',
        'objetivo',
        'estado',
        'porcentaje_avance',
        'inscrip_modalidad_id',
    ];

    protected $casts = [
        'porcentaje_avance' => 'integer',
    ];

    // Exponer modalidad_id derivado desde la relación inscripModalidad
    protected $appends = [
        'modalidad_id',
    ];

    /**
     * Relación: Proyecto pertenece a una Inscripción de Modalidad
     */
    public function inscripModalidad()
    {
        return $this->belongsTo(InscripModalidad::class, 'inscrip_modalidad_id');
    }

    /**
     * Accesor: modalidad_id proveniente de la inscripción relacionada
     */
    public function getModalidadIdAttribute()
    {
        return $this->inscripModalidad->modalidad_id ?? null;
    }
}
