<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Proyecto extends Model
{
    use HasFactory;

    protected $table = 'proyecto';

    protected $fillable = [
        'modalidad_id',
        'nombre',
        'tipo',
        'objetivo',
        'estado',
        'porcentaje_avance',
    ];

    protected $casts = [
        'porcentaje_avance' => 'integer',
    ];

    public function modalidad()
    {
        return $this->belongsTo(Modalidad::class, 'modalidad_id');
    }
}
