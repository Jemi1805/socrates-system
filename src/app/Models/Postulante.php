<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Postulante extends Model
{
    use HasFactory;

    protected $primaryKey = 'cod_ceta';

    protected $fillable = [
        'nombres_est',
        'apellidos_est',
        'ci',
        'expedido',
        'celular',
        'carrera',
        'reg_ini_c',
        'gestion_ini',
        'reg_con_c',
        'gestion_fin',
        'incrip_uni'
    ];
}
