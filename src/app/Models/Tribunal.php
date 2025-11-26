<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Tribunal extends Model
{
    use HasFactory;

    protected $table = 'tribunales';

    protected $fillable = [
        'nombre',
        'apellido_p',
        'apellido_m',
        'ci',
        'celular',
        'profesion',
        'titulo_academico',
        'activo',
    ];
}
