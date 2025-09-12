<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DiplomaBachiller extends Model
{
    use HasFactory;

    protected $table = 'diploma_bachiller';

    protected $fillable = [
        'cod_ceta_est',
        'tipo_bachiller',
        'nro_serie_titulo',
        'emision',
        'fecha_emision',
        'observacion',
        'gestion_bachillerato',
        'nro_resolucion',
        'fecha_resolucion',
        'is_active',
    ];

    protected $casts = [
        'fecha_emision' => 'date',
        'fecha_resolucion' => 'date',
        'is_active' => 'boolean',
    ];

    public function documentoRequerido()
    {
        return $this->belongsTo(DocumentosRequeridos::class, 'id_doc_req');
    }
}
