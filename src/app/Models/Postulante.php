<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Postulante extends Model
{
    use HasFactory;

    protected $primaryKey = 'cod_ceta';

    protected $fillable = [
        // Datos biográficos
        'cod_ceta',
        'nombres_est',
        'ap_pat',
        'ap_mat',
        'apellidos_est', // redundante (compatibilidad), puede componerse de ap_pat + ap_mat
        'ci',
        'complemento',
        'fecha_nacimiento',
        'lugar_nacimiento',
        'procedencia',
        'carrera',
        'pensum',

        // Otros campos existentes
        'expedido',
        'reg_ini_c',
        'gestion_ini',
        'reg_con_c',
        'gestion_fin',
        'incrip_uni'
    ];
}
