<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransitabilidadEduReg extends Model
{
    use HasFactory;

    protected $table = 'transitabilidad_edu_reg';

    protected $fillable = [
        'cod_ceta_est',
        'id_doc_req',
        'serie_titulo_tm',
        'numero_titulo_tm',
        'fecha_emision',
        'is_active',
    ];

    protected $casts = [
        'fecha_emision' => 'date',
    ];
}
