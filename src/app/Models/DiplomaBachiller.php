<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DiplomaBachiller extends Model
{
    use HasFactory;

    protected $table = 'diploma_bachiller';
    protected $primaryKey = 'nro_serie';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'nro_serie',
        'id_doc_req',
        'emision',
        'fecha_emision',
        'observación',
        'gestion_bachiller',
    ];

    protected $casts = [
        'fecha_emision' => 'date',
        'gestion_bachiller' => 'integer',
    ];

    public function documentoRequerido()
    {
        return $this->belongsTo(DocumentosRequeridos::class, 'id_doc_req');
    }
}
