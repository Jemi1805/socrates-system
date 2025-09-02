<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Pensum extends Model
{
    use HasFactory;

    protected $table = 'pensum';
    protected $primaryKey = 'cod_pensum';
    public $incrementing = false; // PK string
    protected $keyType = 'string';

    protected $fillable = [
        'cod_pensum',
        'cod_carrera',
        'cantidadsemestre',
        'descripcion',
        'orden',
        'activo',
        'cod_secuencial',
        'nivel',
        'identificador',
        'resolucion',
    ];

    public function carrera()
    {
        return $this->belongsTo(Carrera::class, 'cod_carrera', 'cod_carrera');
    }
}
