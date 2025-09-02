<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Carrera extends Model
{
    use HasFactory;

    protected $table = 'carrera';
    protected $primaryKey = 'cod_carrera';
    public $incrementing = false; // PK string
    protected $keyType = 'string';

    protected $fillable = [
        'cod_carrera',
        'nombre_carrera',
        'descripcion',
    ];

    public function pensums()
    {
        return $this->hasMany(Pensum::class, 'cod_carrera', 'cod_carrera');
    }
}
