<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Modalidad extends Model
{
    use HasFactory;

    protected $table = 'modalidad';

    protected $fillable = [
        'nombre',
        'descripcion',
        'monto_arancel',
    ];

    public function proyectos()
    {
        return $this->hasMany(Proyecto::class, 'modalidad_id');
    }

    public function inscripciones()
    {
        return $this->hasMany(InscripModalidad::class, 'modalidad_id');
    }
}
