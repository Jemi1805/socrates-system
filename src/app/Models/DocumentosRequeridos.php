<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentosRequeridos extends Model
{
    use HasFactory;

    protected $table = 'documentos_requeridos';

    protected $fillable = [
        'nombre_doc',
        'obligatorio',
    ];

    protected $casts = [
        'obligatorio' => 'boolean',
    ];

    public function adjuntos()
    {
        return $this->hasMany(DocumentosAdjuntos::class, 'tipo_doc_id');
    }
}
