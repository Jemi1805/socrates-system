<?php

namespace App\Http\Controllers\Api;

use App\Models\DocumentosAdjuntos;

class DocumentosAdjuntosController extends CrudController
{
    protected $modelClass = DocumentosAdjuntos::class;
    
    protected function rules()
    {
        return [
            'inscripcion_id' => 'nullable|exists:inscrip_modalidad,id',
            'tipo_doc_id' => 'nullable|exists:documentos_requeridos,id',
            'archivo_pdf' => 'nullable|string|max:255',
            'fecha_subida' => 'nullable|date',
            'validado' => 'nullable|boolean',
            'usuario_validador' => 'nullable|integer',
            'fecha_validacion' => 'nullable|date',
            'observaciones' => 'nullable|string',
        ];
    }
}
