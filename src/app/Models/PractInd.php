<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PractInd extends Model
{
    use HasFactory;
    
    protected $table = 'pract_ind';
    
    protected $fillable = [
        'empresa',
        'fecha_inicio',
        'fecha_fin',
        'descripcion',
        'estado'
    ];
    
    protected $casts = [
        'fecha_inicio' => 'date',
        'fecha_fin' => 'date'
    ];
    
    // Relación con inscripción modalidad
    public function inscripcionModalidad()
    {
        return $this->hasOne(InscripModalidad::class, 'pract_ind_id');
    }
}
