<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransitabilidadEduReg extends Model
{
    use HasFactory;

    protected $table = 'transitabilidad_edu_reg';

    protected $fillable = [
        'diploma_bachiller_id',
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

    /**
     * Diploma asociado
     */
    public function diplomaBachiller()
    {
        return $this->belongsTo(DiplomaBachiller::class, 'diploma_bachiller_id');
    }
}
