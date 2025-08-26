<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DocumentosAdjuntos extends Model
{
    use HasFactory;

    protected $table = 'documentos_adjuntos';

    protected $fillable = [
        'inscripcion_id',
        'tipo_doc_id',
        'archivo_pdf',
        'fecha_subida',
        'validado',
        'usuario_validador',
        'fecha_validacion',
        'observaciones',
    ];

    protected $casts = [
        'fecha_subida' => 'datetime',
        'validado' => 'boolean',
        'fecha_validacion' => 'datetime',
    ];

    public function inscripcion()
    {
        return $this->belongsTo(InscripModalidad::class, 'inscripcion_id');
    }

    public function tipoDocumento()
    {
        return $this->belongsTo(DocumentosRequeridos::class, 'tipo_doc_id');
    }
}
